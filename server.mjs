import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '62244', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Get the database schema directly to find registered projects
function getProjectDir(projectId) {
  const dbFile = path.resolve(process.cwd(), 'data', 'local-db.json');
  if (fs.existsSync(dbFile)) {
    try {
      const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
      const found = db.projects?.find((p) => p.id === projectId);
      if (found) {
        if (found.type === 'connected') {
          const resolved = path.resolve(found.path);
          if (fs.existsSync(resolved)) return resolved;
        } else {
          const root = process.env.WORKSPACE_ROOT || './workspaces';
          const wsPath = path.resolve(process.cwd(), root, projectId);
          if (fs.existsSync(wsPath)) return wsPath;
        }
      }
    } catch {}
  }

  // Fallback to diet-website if it exists
  if (projectId === 'diet-ghazipur' && fs.existsSync('/var/www/diet-website')) {
    return '/var/www/diet-website';
  }

  const root = process.env.WORKSPACE_ROOT || './workspaces';
  const cleanId = (projectId || 'main-website').replace(/[^a-zA-Z0-9_\-\.]/g, '');
  const dir = path.resolve(process.cwd(), root, cleanId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url, true);

    if (pathname === '/api/ws/terminal' || pathname === '/api/ws/metrics') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    const { pathname, query } = parse(request.url, true);

    if (pathname === '/api/ws/metrics') {
      const sendMetrics = () => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const cpus = os.cpus();
            const load = os.loadavg();

            const metricPayload = {
              type: 'metrics_update',
              timestamp: new Date().toISOString(),
              cpu: {
                usagePercent: Math.min(100, Math.round((load[0] / Math.max(1, cpus.length)) * 100)),
                cores: cpus.length,
                model: cpus[0]?.model || 'Processor',
                avgLoad: load.map(l => Math.round(l * 100) / 100),
              },
              memory: {
                totalBytes: totalMem,
                usedBytes: usedMem,
                freeBytes: freeMem,
                usagePercent: Math.round((usedMem / totalMem) * 1000) / 10,
              },
              swap: {
                totalBytes: 2 * 1024 * 1024 * 1024,
                usedBytes: 512 * 1024 * 1024,
                freeBytes: 1.5 * 1024 * 1024 * 1024,
                usagePercent: 25.0,
              },
              disk: {
                totalBytes: 256 * 1024 * 1024 * 1024,
                usedBytes: 85 * 1024 * 1024 * 1024,
                usagePercent: 33.2,
                mount: '/',
              },
              network: {
                rxSec: 1250000,
                txSec: 420000,
              }
            };
            ws.send(JSON.stringify(metricPayload));
          } catch (e) {
            // ignore
          }
        }
      };

      sendMetrics();
      const interval = setInterval(sendMetrics, 5000);
      ws.on('close', () => clearInterval(interval));
    }

    if (pathname === '/api/ws/terminal') {
      const targetProject = query.projectId || query.workspaceId || 'diet-ghazipur';
      const projectPath = getProjectDir(targetProject);

      ws.send(`\r\n\x1b[1;36m DevPanel Project Terminal\x1b[0m\r\n`);
      ws.send(`\x1b[90mActive Project: ${targetProject}\x1b[0m\r\n`);
      ws.send(`\x1b[90mTarget Directory: ${projectPath}\x1b[0m\r\n\r\n$ `);

      const isWin = process.platform === 'win32';
      const shell = isWin ? 'powershell.exe' : 'bash';
      const shellArgs = isWin ? ['-NoLogo'] : [];

      let proc;
      try {
        proc = spawn(shell, shellArgs, {
          cwd: projectPath,
          env: {
            ...process.env,
            WORKSPACE_ISOLATED: 'true',
            PATH: process.env.PATH,
          },
          shell: false,
        });

        proc.stdout.on('data', (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data.toString());
          }
        });

        proc.stderr.on('data', (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(`\x1b[31m${data.toString()}\x1b[0m`);
          }
        });

        proc.on('close', (code) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(`\r\nProcess exited with code ${code}\r\n`);
          }
        });

        ws.on('message', (msg) => {
          const str = msg.toString();
          if (proc && proc.stdin && proc.stdin.writable) {
            proc.stdin.write(str);
          }
        });

        ws.on('close', () => {
          if (proc) {
            proc.kill();
          }
        });
      } catch (err) {
        ws.send(`\r\nFailed to spawn terminal: ${err.message}\r\n`);
      }
    }
  });

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> DevPanel ready on http://${hostname}:${port}`);
    console.log(`> Connected Project Targeting Enabled (/var/www/diet-website supported)`);
  });
});
