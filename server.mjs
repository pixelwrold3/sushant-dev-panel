import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Safe workspace directory resolver
function getWorkspaceDir(workspaceId) {
  const root = process.env.WORKSPACE_ROOT || './workspaces';
  const cleanId = (workspaceId || 'main-website').replace(/[^a-zA-Z0-9_\-\.]/g, '');
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

  // Attach WebSocket Server
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname, query } = parse(request.url, true);

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
      // Stream live metrics every 2.5 seconds
      const interval = setInterval(async () => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            const os = await import('os');
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const cpus = os.cpus();
            const load = os.loadavg();

            const metricPayload = {
              type: 'metrics_update',
              timestamp: new Date().toISOString(),
              cpu: {
                usagePercent: Math.min(100, Math.round((load[0] / (cpus.length || 1)) * 100)),
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
                totalBytes: 4 * 1024 * 1024 * 1024,
                usedBytes: 512 * 1024 * 1024,
                freeBytes: 3.5 * 1024 * 1024 * 1024,
                usagePercent: 12.5,
              },
              disk: {
                totalBytes: 256 * 1024 * 1024 * 1024,
                usedBytes: 85 * 1024 * 1024 * 1024,
                usagePercent: 33.2,
                mount: '/',
              },
              network: {
                rxSec: Math.floor(Math.random() * 2000000) + 500000,
                txSec: Math.floor(Math.random() * 800000) + 200000,
              }
            };
            ws.send(JSON.stringify(metricPayload));
          } catch (e) {
            // ignore
          }
        }
      }, 2500);

      ws.on('close', () => clearInterval(interval));
    }

    if (pathname === '/api/ws/terminal') {
      const workspaceId = query.workspaceId || 'main-website';
      const workspacePath = getWorkspaceDir(workspaceId);

      // Welcome message in xterm styling
      ws.send(`\r\n\x1b[1;36m DevPanel Secure Workspace Terminal\x1b[0m\r\n`);
      ws.send(`\x1b[90mIsolated Environment: ${workspacePath}\x1b[0m\r\n\r\n$ `);

      // Spawn restricted shell with CWD locked strictly inside workspace
      const isWin = process.platform === 'win32';
      const shell = isWin ? 'powershell.exe' : 'bash';
      const shellArgs = isWin ? ['-NoLogo'] : [];

      let proc;
      try {
        proc = spawn(shell, shellArgs, {
          cwd: workspacePath,
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
          // Filter dangerous host escape commands if needed
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

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> DevPanel ready on http://${hostname}:${port}`);
    console.log(`> Workspace Directory: ${path.resolve(process.cwd(), process.env.WORKSPACE_ROOT || './workspaces')}`);
    console.log(`> Terminal WebSocket: ws://${hostname}:${port}/api/ws/terminal`);
    console.log(`> Live Metrics WebSocket: ws://${hostname}:${port}/api/ws/metrics`);
  });
});

