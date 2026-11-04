import { createServer } from 'http';
import { parse, fileURLToPath } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always ensure the process runs from its own project root directory
try {
  process.chdir(__dirname);
} catch {}

dotenv.config();

// Ensure unbuffered log writes so nohup log files flush immediately
if (process.stdout._handle && typeof process.stdout._handle.setBlocking === 'function') {
  try { process.stdout._handle.setBlocking(true); } catch {}
}
if (process.stderr._handle && typeof process.stderr._handle.setBlocking === 'function') {
  try { process.stderr._handle.setBlocking(true); } catch {}
}

// Only enable dev mode if explicitly requested with --dev flag (prevents slow on-demand compilation in production)
const isDev = process.argv.includes('--dev');
process.env.NODE_ENV = isDev ? 'development' : 'production';
const dev = isDev;
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '62244', 10);

const app = next({ dev, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

function getProjectDir(projectId) {
  const dbFile = path.resolve(__dirname, 'data', 'local-db.json');
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
          const wsPath = path.resolve(__dirname, root, projectId);
          if (fs.existsSync(wsPath)) return wsPath;
        }
      }
    } catch {}
  }

  // Fallback to diet-website if it exists
  if (projectId === 'diet-ghazipur' && fs.existsSync('/var/www/diet-website')) {
    return '/var/www/diet-website';
  }

  // Fallback to dev if it exists
  if (projectId === 'dev' && fs.existsSync('/var/www/dev')) {
    return '/var/www/dev';
  }

  const root = process.env.WORKSPACE_ROOT || './workspaces';
  const cleanId = (projectId || 'main-website').replace(/[^a-zA-Z0-9_\-\.]/g, '');
  const dir = path.resolve(__dirname, root, cleanId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

process.on('uncaughtException', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\x1b[31m[DevPanel Error] Port ${port} is already in use by another process.\x1b[0m`);
    console.error(`Run: fuser -k ${port}/tcp to free the port and restart.`);
  } else {
    console.error('\x1b[31m[DevPanel Fatal Error]:\x1b[0m', err);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\x1b[31m[DevPanel Unhandled Rejection]:\x1b[0m', reason);
});

console.log(`> Initializing DevPanel production engine on ${hostname}:${port}...`);

app.prepare()
  .then(() => {
    const server = createServer(async (req, res) => {
      // Safety check: ensure response is a valid HTTP ServerResponse
      if (!res || typeof res.setHeader !== 'function') {
        if (res && typeof res.end === 'function') res.end();
        return;
      }

      const parsedUrl = parse(req.url, true);
      // Ignore WebSocket upgrade HTTP requests here so Next.js doesn't error
      if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/api/ws')) {
        res.writeHead(426, { 'Content-Type': 'text/plain' });
        res.end('Upgrade Required');
        return;
      }

      try {
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', req.url, err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\x1b[31m[DevPanel Error] Port ${port} is already in use by a background process.\x1b[0m`);
        console.error(`Please kill the process using port ${port} by running:\n  fuser -k ${port}/tcp\n`);
      } else {
        console.error('\x1b[31m[DevPanel Server Error]:\x1b[0m', err);
      }
      process.exit(1);
    });

    const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url, true);

    if (pathname && (pathname.startsWith('/api/ws/terminal') || pathname.startsWith('/api/ws/metrics'))) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    const { pathname, query } = parse(request.url, true);

    if (pathname && pathname.startsWith('/api/ws/metrics')) {
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
      ws.send(`\x1b[90mConnected Project: ${targetProject}\x1b[0m\r\n`);
      ws.send(`\x1b[90mTarget Directory: ${projectPath}\x1b[0m\r\n\r\n`);

      const isWin = process.platform === 'win32';
      const shell = isWin ? 'powershell.exe' : 'bash';
      const shellArgs = isWin ? ['-NoLogo'] : ['-i'];

      let proc;
      try {
        proc = spawn(shell, shellArgs, {
          cwd: projectPath,
          env: {
            ...process.env,
            WORKSPACE_ISOLATED: 'true',
            PATH: process.env.PATH,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            PWD: projectPath,
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
            ws.send(data.toString());
          }
        });

        proc.on('close', (code) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`);
          }
        });

        proc.on('error', (err) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(`\r\n\x1b[31m[Process error: ${err.message}]\x1b[0m\r\n`);
          }
        });

        ws.on('message', (msg) => {
          let str = msg.toString();
          // Convert carriage return (\r) from xterm into newline (\n) for linux shells
          if (str === '\r') {
            str = '\n';
          }
          if (proc && proc.stdin && proc.stdin.writable) {
            proc.stdin.write(str);
          }
        });

        ws.on('close', () => {
          if (proc) {
            try { proc.kill(); } catch {}
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
    console.log(`> Connected Project Targeting Enabled (/var/www/diet-website & /var/www/dev supported)`);
  });
}).catch((err) => {
  console.error('\x1b[31m[DevPanel Init Error]:\x1b[0m Failed to initialize Next.js app:');
  console.error(err.message || err);
  if (err.message && err.message.includes("Could not find a production build in the '.next' directory")) {
    console.error('\x1b[33mFix: Run "npm run build" first before starting the production server.\x1b[0m');
  }
  process.exit(1);
});
