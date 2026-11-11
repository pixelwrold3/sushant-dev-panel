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
    process.exit(1);
  } else if (err.message && (err.message.includes("reading 'bind'") || err.message.includes('setHeader'))) {
    console.warn('\x1b[33m[DevPanel Warning] Non-fatal Next.js request/upgrade binding ignored.\x1b[0m');
    return;
  } else if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
    return;
  } else {
    console.error('\x1b[31m[DevPanel Fatal Error]:\x1b[0m', err);
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('\x1b[31m[DevPanel Unhandled Rejection]:\x1b[0m', reason);
});

// ============================================================================
// Global Persistent Terminal Sessions Manager
// Keeps background shell processes alive across web page reloads, tab switches,
// and reconnects. Caches output buffer so users never lose history or work.
// ============================================================================
const persistentTerminalSessions = new Map();
const MAX_BUFFER_CHARS = 1000000; // ~1MB text buffer per tab (~50,000 lines of history)

function getOrCreateTerminalSession(targetProject, tabId, effectivePath, isWin) {
  const sessionKey = `${targetProject}:::${tabId}`;
  let session = persistentTerminalSessions.get(sessionKey);

  // If session exists and process is still actively running, reuse it
  if (session && session.proc && session.proc.exitCode === null && !session.proc.killed) {
    return session;
  }

  const hasBwrap = !isWin && (fs.existsSync('/usr/bin/bwrap') || fs.existsSync('/bin/bwrap'));
  const bwrapBin = fs.existsSync('/usr/bin/bwrap') ? '/usr/bin/bwrap' : '/bin/bwrap';
  const pyPath = !isWin && (fs.existsSync('/usr/bin/python3') ? '/usr/bin/python3' : (fs.existsSync('/bin/python3') ? '/bin/python3' : null));

  let shell;
  let shellArgs;
  let isPty = false;

  if (isWin) {
    shell = 'powershell.exe';
    shellArgs = ['-NoLogo'];
    isPty = false;
  } else if (hasBwrap && pyPath) {
    // Priority 1: Real PTY inside Bubblewrap Virtual Sandbox Jail (CodeSandbox-style zero-RAM jail)
    const bwrapCmdList = [
      bwrapBin,
      '--ro-bind', '/usr', '/usr',
      '--ro-bind', '/lib', '/lib',
      '--ro-bind-try', '/lib64', '/lib64',
      '--ro-bind', '/bin', '/bin',
      '--ro-bind-try', '/sbin', '/sbin',
      '--ro-bind-try', '/etc/resolv.conf', '/etc/resolv.conf',
      '--ro-bind-try', '/etc/hosts', '/etc/hosts',
      '--ro-bind-try', '/etc/ssl', '/etc/ssl',
      '--ro-bind-try', '/etc/ca-certificates', '/etc/ca-certificates',
      '--proc', '/proc',
      '--dev', '/dev',
      '--tmpfs', '/tmp',
      '--bind', effectivePath, effectivePath,
      '--chdir', effectivePath,
      '--setenv', 'PATH', process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      '--setenv', 'HOME', effectivePath,
      '--setenv', 'USER', 'developer',
      '--setenv', 'TERM', 'xterm-256color',
      '--setenv', 'PS1', '\\[\\033[01;32m\\]developer@' + targetProject + '\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
      '--die-with-parent',
      '--unshare-all',
      '--share-net',
      '/bin/bash',
    ];

    shell = pyPath;
    shellArgs = [
      '-u',
      '-c',
      `import pty, os; os.environ['TERM']='xterm-256color'; pty.spawn(${JSON.stringify(bwrapCmdList)})`
    ];
    isPty = true;
  } else if (hasBwrap) {
    // Priority 2: Bubblewrap without Python PTY
    shell = bwrapBin;
    shellArgs = [
      '--ro-bind', '/usr', '/usr',
      '--ro-bind', '/lib', '/lib',
      '--ro-bind-try', '/lib64', '/lib64',
      '--ro-bind', '/bin', '/bin',
      '--ro-bind-try', '/sbin', '/sbin',
      '--ro-bind-try', '/etc/resolv.conf', '/etc/resolv.conf',
      '--ro-bind-try', '/etc/hosts', '/etc/hosts',
      '--ro-bind-try', '/etc/ssl', '/etc/ssl',
      '--ro-bind-try', '/etc/ca-certificates', '/etc/ca-certificates',
      '--proc', '/proc',
      '--dev', '/dev',
      '--tmpfs', '/tmp',
      '--bind', effectivePath, effectivePath,
      '--chdir', effectivePath,
      '--setenv', 'PATH', process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      '--setenv', 'HOME', effectivePath,
      '--setenv', 'USER', 'developer',
      '--setenv', 'TERM', 'xterm-256color',
      '--setenv', 'PS1', '\\[\\033[01;32m\\]developer@' + targetProject + '\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
      '--die-with-parent',
      '--unshare-all',
      '--share-net',
      '/bin/bash',
    ];
    isPty = false;
  } else if (pyPath) {
    // Priority 3: Python PTY without bwrap
    shell = pyPath;
    shellArgs = ['-u', '-c', "import pty, os; os.environ['TERM']='xterm-256color'; pty.spawn(['/bin/bash'])"];
    isPty = true;
  } else {
    // Priority 4: Direct shell
    shell = fs.existsSync('/bin/bash') ? '/bin/bash' : 'sh';
    shellArgs = ['-i'];
    isPty = false;
  }

  const banner = [
    `\r\n\x1b[1;36m DevPanel Project Terminal\x1b[0m\r\n`,
    `\x1b[90mConnected Project: ${targetProject}\x1b[0m\r\n`,
    `\x1b[90mTarget Directory: ${effectivePath}\x1b[0m\r\n`,
    hasBwrap
      ? `\x1b[1;32mSecurity: Virtual Container Jail Active (Filesystem & Root Isolated)\x1b[0m\r\n\r\n`
      : (!isWin ? `\x1b[33mSecurity Note: Run 'apt install -y bubblewrap' on VPS for virtual jail isolation\x1b[0m\r\n\r\n` : `\r\n`)
  ].join('');

  const proc = spawn(shell, shellArgs, {
    cwd: effectivePath,
    env: {
      ...process.env,
      WORKSPACE_ISOLATED: 'true',
      PATH: process.env.PATH,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      PWD: effectivePath,
    },
    shell: false,
  });

  if (proc.stdin && proc.stdin.writable && !isWin && !isPty) {
    try { proc.stdin.write('export PS1="\\u@devpanel:\\w\\$ "\n'); } catch {}
  }

  session = {
    targetProject,
    tabId,
    effectivePath,
    proc,
    isPty,
    buffer: [banner],
    totalBufferLength: banner.length,
    clients: new Set(),
    lastActive: Date.now(),
  };

  const handleData = (data) => {
    const str = data.toString();
    session.lastActive = Date.now();
    session.buffer.push(str);
    session.totalBufferLength += str.length;

    // Prune oldest buffer chunks if exceeding MAX_BUFFER_CHARS
    if (session.totalBufferLength > MAX_BUFFER_CHARS) {
      while (session.totalBufferLength > MAX_BUFFER_CHARS * 0.8 && session.buffer.length > 1) {
        const removed = session.buffer.shift();
        session.totalBufferLength -= (removed ? removed.length : 0);
      }
    }

    // Broadcast output chunk to all active connected clients for this session
    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(str); } catch {}
      }
    }
  };

  proc.stdout.on('data', handleData);
  proc.stderr.on('data', handleData);

  proc.on('close', (code) => {
    const exitMsg = `\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`;
    session.buffer.push(exitMsg);
    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(exitMsg); } catch {}
      }
    }
    persistentTerminalSessions.delete(sessionKey);
  });

  proc.on('error', (err) => {
    const errMsg = `\r\n\x1b[31m[Process error: ${err.message}]\x1b[0m\r\n`;
    session.buffer.push(errMsg);
    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(errMsg); } catch {}
      }
    }
    persistentTerminalSessions.delete(sessionKey);
  });

  persistentTerminalSessions.set(sessionKey, session);
  return session;
}

console.log(`> Initializing DevPanel production engine on ${hostname}:${port}...`);

app.prepare()
  .then(() => {
    const server = createServer(async (req, res) => {
      // Safety check: ensure response has setHeader and getHeader fallbacks
      if (res) {
        if (typeof res.setHeader !== 'function') res.setHeader = () => {};
        if (typeof res.getHeader !== 'function') res.getHeader = () => undefined;
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

    // Prepend listener to intercept WebSocket upgrades before Next.js routing can see them
    server.prependListener('upgrade', (request, socket, head) => {
      if (socket) {
        if (typeof socket.setHeader !== 'function') socket.setHeader = () => {};
        if (typeof socket.getHeader !== 'function') socket.getHeader = () => undefined;
      }

      const { pathname } = parse(request.url, true);

      if (pathname && (pathname.startsWith('/api/ws/terminal') || pathname.startsWith('/api/ws/metrics'))) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

  let lastServerCpu = null;
  let lastServerNet = null;

  function collectAccurateSystemMetrics() {
    // 1. Try Go Agent shared memory (/dev/shm/devpanel_metrics.json)
    const shmPath = '/dev/shm/devpanel_metrics.json';
    if (fs.existsSync(shmPath)) {
      try {
        const raw = fs.readFileSync(shmPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.cpu && parsed.memory) {
          return { type: 'metrics_update', ...parsed };
        }
      } catch {}
    }

    // 2. Direct Linux/OS calculation
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    const load = os.loadavg();

    // CPU usage delta
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const t in cpu.times) totalTick += cpu.times[t];
      totalIdle += cpu.times.idle;
    }
    let cpuUsage = Math.min(100, Math.round((load[0] / Math.max(1, cpus.length)) * 100));
    if (lastServerCpu) {
      const idleDiff = totalIdle - lastServerCpu.idle;
      const totalDiff = totalTick - lastServerCpu.total;
      if (totalDiff > 0) {
        cpuUsage = Math.min(100, Math.max(0, Math.round((100 - (100 * idleDiff) / totalDiff) * 10) / 10));
      }
    }
    lastServerCpu = { idle: totalIdle, total: totalTick };

    // Swap calculation from /proc/meminfo
    let swapTotal = 0;
    let swapFree = 0;
    if (process.platform === 'linux' && fs.existsSync('/proc/meminfo')) {
      try {
        const lines = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
        for (const line of lines) {
          if (line.startsWith('SwapTotal:')) swapTotal = parseInt(line.replace(/[^0-9]/g, ''), 10) * 1024;
          else if (line.startsWith('SwapFree:')) swapFree = parseInt(line.replace(/[^0-9]/g, ''), 10) * 1024;
        }
      } catch {}
    }
    const swapUsed = swapTotal >= swapFree ? swapTotal - swapFree : 0;
    const swapPercent = swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 1000) / 10 : 0;

    // Real disk from statfs
    let diskTotal = 50 * 1024 * 1024 * 1024;
    let diskFree = 35 * 1024 * 1024 * 1024;
    let diskUsed = 15 * 1024 * 1024 * 1024;
    let diskPercent = 30.0;
    try {
      if (typeof fs.statfsSync === 'function') {
        const mount = process.platform === 'win32' ? process.cwd().slice(0, 3) : '/';
        const stats = fs.statfsSync(mount);
        diskTotal = stats.blocks * stats.bsize;
        diskFree = stats.bavail * stats.bsize;
        diskUsed = diskTotal - diskFree;
        diskPercent = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 1000) / 10 : 0;
      }
    } catch {}

    // Real network delta
    let rxSec = 0;
    let txSec = 0;
    if (process.platform === 'linux' && fs.existsSync('/proc/net/dev')) {
      try {
        const lines = fs.readFileSync('/proc/net/dev', 'utf8').split('\n');
        let totalRx = 0, totalTx = 0;
        for (let i = 2; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || line.startsWith('lo:')) continue;
          const parts = line.split(':');
          if (parts.length === 2) {
            const fields = parts[1].trim().split(/\s+/);
            if (fields.length >= 9) {
              totalRx += parseInt(fields[0], 10) || 0;
              totalTx += parseInt(fields[8], 10) || 0;
            }
          }
        }
        const now = Date.now();
        if (lastServerNet && now > lastServerNet.time) {
          const sec = (now - lastServerNet.time) / 1000;
          rxSec = Math.max(0, Math.round((totalRx - lastServerNet.rx) / sec));
          txSec = Math.max(0, Math.round((totalTx - lastServerNet.tx) / sec));
        }
        lastServerNet = { rx: totalRx, tx: totalTx, time: now };
      } catch {}
    }

    return {
      type: 'metrics_update',
      timestamp: new Date().toISOString(),
      cpu: {
        usagePercent: cpuUsage,
        cores: cpus.length,
        model: cpus[0]?.model || 'Host Processor',
        avgLoad: load.map(l => Math.round(l * 100) / 100),
      },
      memory: {
        totalBytes: totalMem,
        usedBytes: usedMem,
        freeBytes: freeMem,
        usagePercent: totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0,
      },
      swap: {
        totalBytes: swapTotal,
        usedBytes: swapUsed,
        freeBytes: swapFree,
        usagePercent: swapPercent,
      },
      disk: {
        totalBytes: diskTotal,
        usedBytes: diskUsed,
        freeBytes: diskFree,
        usagePercent: diskPercent,
        mount: '/',
      },
      network: {
        rxSec,
        txSec,
      },
    };
  }

  wss.on('connection', (ws, request) => {
    const { pathname, query } = parse(request.url, true);

    if (pathname && pathname.startsWith('/api/ws/metrics')) {
      const sendMetrics = () => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            const payload = collectAccurateSystemMetrics();
            ws.send(JSON.stringify(payload));
          } catch (e) {
            // ignore
          }
        }
      };

      sendMetrics();
      // High-precision 0.5s (500ms) real-time streaming interval
      const interval = setInterval(sendMetrics, 500);
      ws.on('close', () => clearInterval(interval));
    }

    if (pathname === '/api/ws/terminal') {
      const targetProject = query.projectId || query.workspaceId || 'diet-ghazipur';
      const tabId = String(query.tabId || '1');
      const sessionKey = `${targetProject}:::${tabId}`;
      const projectPath = getProjectDir(targetProject);
      const effectivePath = fs.existsSync(projectPath) ? projectPath : __dirname;
      const isWin = process.platform === 'win32';

      try {
        const session = getOrCreateTerminalSession(targetProject, tabId, effectivePath, isWin);
        session.clients.add(ws);

        // Instantly replay all accumulated terminal output and history to the client!
        if (session.buffer.length > 0) {
          const replay = session.buffer.join('');
          if (replay) {
            ws.send(replay);
          }
        }

        ws.on('message', (msg) => {
          const str = msg.toString();
          const curSession = persistentTerminalSessions.get(sessionKey);
          if (!curSession || !curSession.proc) return;

          // Check for JSON control messages (e.g. resize, kill, clear, restart)
          if (str.startsWith('{') && str.endsWith('}')) {
            try {
              const parsed = JSON.parse(str);
              if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
                const cols = parseInt(parsed.cols, 10);
                const rows = parseInt(parsed.rows, 10);
                if (curSession.proc.stdout && typeof curSession.proc.stdout.setWindowSize === 'function') {
                  try { curSession.proc.stdout.setWindowSize(rows, cols); } catch {}
                }
                return;
              }
              if (parsed.type === 'kill') {
                try { curSession.proc.kill('SIGKILL'); } catch {}
                persistentTerminalSessions.delete(sessionKey);
                for (const client of curSession.clients) {
                  if (client.readyState === WebSocket.OPEN) {
                    try { client.send('\r\n\x1b[31m[Terminal session killed by user]\x1b[0m\r\n'); } catch {}
                  }
                }
                return;
              }
              if (parsed.type === 'clear') {
                curSession.buffer = [];
                curSession.totalBufferLength = 0;
                return;
              }
              if (parsed.type === 'restart') {
                try { curSession.proc.kill('SIGKILL'); } catch {}
                persistentTerminalSessions.delete(sessionKey);
                const freshSession = getOrCreateTerminalSession(targetProject, tabId, effectivePath, isWin);
                freshSession.clients.add(ws);
                if (freshSession.buffer.length > 0) {
                  ws.send(freshSession.buffer.join(''));
                }
                return;
              }
            } catch {}
          }

          // Echo keystrokes locally in non-PTY mode
          if (!curSession.isPty) {
            if (str === '\r') {
              ws.send('\r\n');
            } else if (str === '\x7f' || str === '\b') {
              ws.send('\b \b');
            } else if (str.length === 1 && str.charCodeAt(0) >= 32) {
              ws.send(str);
            }
          }

          if (curSession.proc.stdin && curSession.proc.stdin.writable) {
            const toWrite = (!curSession.isPty && str === '\r') ? '\n' : str;
            curSession.proc.stdin.write(toWrite);
          }
        });

        ws.on('close', () => {
          const curSession = persistentTerminalSessions.get(sessionKey);
          if (curSession) {
            curSession.clients.delete(ws);
            // DO NOT kill curSession.proc! It continues executing in the background.
          }
        });
      } catch (err) {
        try {
          ws.send(`\r\n\x1b[31mFailed to spawn terminal: ${err.message}\x1b[0m\r\n`);
        } catch {}
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
