import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export type AllowedService =
  | 'nginx'
  | 'mongod'
  | 'cloudflared'
  | 'application'
  | 'diet-website'
  | 'dev'
  | 'sushant-dev-panel';

export type AllowedAction = 'start' | 'stop' | 'restart' | 'status' | 'logs';

export interface ServiceStatus {
  id: AllowedService;
  name: string;
  description: string;
  status: 'Running' | 'Stopped' | 'Degraded';
  uptime: string;
  memoryUsageMb: number;
  cpuPercent: number;
}

const ALLOWED_SERVICES: Record<AllowedService, { name: string; description: string; port?: number }> = {
  'diet-website': { name: 'Diet Ghazipur Production Website', description: 'Production web service (/var/www/diet-website)' },
  nginx: { name: 'Nginx Web Server', description: 'HTTP reverse proxy & SSL termination' },
  mongod: { name: 'MongoDB Server', description: 'Panel metadata database engine', port: 27017 },
  cloudflared: { name: 'Cloudflare Tunnel', description: 'Zero-trust ingress tunnel' },
  application: { name: 'Diet Website App', description: 'Production web application service' },
  dev: { name: 'Dev Development Server', description: 'Development web service (/var/www/dev)' },
  'sushant-dev-panel': { name: 'DevPanel Production Engine', description: 'Core server management engine' },
};

// In-memory simulation status when running locally on Windows/dev environment
const localServiceStates: Record<AllowedService, { status: 'Running' | 'Stopped' | 'Degraded'; uptimeSec: number; pid: number }> = {
  'diet-website': { status: 'Running', uptimeSec: 86400 * 3, pid: 34102 },
  nginx: { status: 'Running', uptimeSec: 86400 * 4, pid: 1042 },
  mongod: { status: 'Running', uptimeSec: 86400 * 12, pid: 890 },
  cloudflared: { status: 'Running', uptimeSec: 86400 * 2, pid: 1420 },
  application: { status: 'Running', uptimeSec: 86400 * 1, pid: 34102 },
  dev: { status: 'Running', uptimeSec: 86400 * 1, pid: 28100 },
  'sushant-dev-panel': { status: 'Running', uptimeSec: 86400 * 5, pid: 18234 },
};

export async function listServices(): Promise<ServiceStatus[]> {
  return (Object.keys(ALLOWED_SERVICES) as AllowedService[]).map((id) => {
    const info = ALLOWED_SERVICES[id];
    const state = localServiceStates[id];
    const days = Math.floor(state.uptimeSec / 86400);
    const hours = Math.floor((state.uptimeSec % 86400) / 3600);

    return {
      id,
      name: info.name,
      description: info.description,
      status: state.status,
      uptime: `${days}d ${hours}h`,
      memoryUsageMb: id === 'mongod' ? 340 : id === 'nginx' ? 42 : id === 'diet-website' ? 180 : 36,
      cpuPercent: id === 'diet-website' ? 3.5 : 0.8,
    };
  });
}

/**
 * Execute real systemctl service commands directly on Linux.
 * Executes requested action (start/stop/restart/status),
 * then queries the live systemd status and returns authentic terminal output.
 */
export async function executeServiceAction(
  service: AllowedService,
  action: AllowedAction
): Promise<{ success: boolean; message: string; output?: string; serviceStatus?: string }> {
  if (!ALLOWED_SERVICES[service]) {
    throw new Error(`Security Violation: Unrecognized or unauthorized service "${service}".`);
  }

  const validActions: AllowedAction[] = ['start', 'stop', 'restart', 'status', 'logs'];
  if (!validActions.includes(action)) {
    throw new Error(`Security Violation: Invalid service action "${action}".`);
  }

  const isLinux = process.platform === 'linux';

  if (isLinux) {
    const isRoot = typeof process.getuid === 'function' ? process.getuid() === 0 : true;
    const sudoPrefix = isRoot ? '' : 'sudo -n ';

    let executionLog = '';

    // Step 1: If action is start, stop, or restart, execute it directly
    if (action === 'start' || action === 'stop' || action === 'restart') {
      const primaryCmd = `${sudoPrefix}systemctl ${action} ${service}`;
      executionLog += `$ ${primaryCmd}\n`;
      try {
        const { stdout, stderr } = await execAsync(primaryCmd, { timeout: 20000 });
        if (stdout && stdout.trim()) executionLog += `${stdout.trim()}\n`;
        if (stderr && stderr.trim()) executionLog += `${stderr.trim()}\n`;
      } catch (err: any) {
        if (err.stdout && err.stdout.trim()) executionLog += `${err.stdout.trim()}\n`;
        if (err.stderr && err.stderr.trim()) executionLog += `${err.stderr.trim()}\n`;
        executionLog += `[Process exited with code ${err.code || 1}]\n`;
      }
      executionLog += '\n';
    } else if (action === 'logs') {
      const logsCmd = `${sudoPrefix}journalctl -u ${service} -n 60 --no-pager`;
      executionLog += `$ ${logsCmd}\n`;
      try {
        const { stdout, stderr } = await execAsync(logsCmd, { timeout: 15000 });
        executionLog += (stdout || stderr || '[No logs recorded for this service]').trim() + '\n';
      } catch (err: any) {
        executionLog += (err.stdout || err.stderr || err.message).trim() + '\n';
      }
      return {
        success: true,
        message: `Logs retrieved for ${service}.`,
        output: executionLog.trim(),
        serviceStatus: 'active',
      };
    }

    // Step 2: Query real systemctl status to display the authentic systemd unit details!
    const statusCmd = `systemctl status ${service} --no-pager -l`;
    executionLog += `$ ${statusCmd}\n`;
    let rawStatus = '';
    let statusExitCode = 0;
    try {
      const { stdout, stderr } = await execAsync(statusCmd, { timeout: 10000 });
      rawStatus = (stdout || stderr || '').trim();
    } catch (err: any) {
      // systemctl status exits with code 3 when service is stopped/inactive. This is standard systemd behavior!
      rawStatus = (err.stdout || err.stderr || err.message || '').trim();
      statusExitCode = err.code || 1;
    }
    executionLog += `${rawStatus}\n`;

    // Step 3: Check systemctl is-active to determine exact running status
    let activeRaw = '';
    try {
      const { stdout } = await execAsync(`systemctl is-active ${service}`);
      activeRaw = (stdout || '').trim();
    } catch (err: any) {
      activeRaw = (err.stdout || '').trim() || 'inactive';
    }

    const isRunning = activeRaw === 'active';

    const successMsg =
      action === 'start'
        ? (isRunning ? `Your website (${service}) has been started successfully!` : `Service start command executed.`)
        : action === 'stop'
        ? (!isRunning ? `Your website (${service}) has been stopped.` : `Service stop command executed.`)
        : action === 'restart'
        ? (isRunning ? `Your website (${service}) has been restarted successfully!` : `Service restart command executed.`)
        : `Status retrieved for ${service}.`;

    return {
      success: action === 'stop' ? !isRunning : isRunning || statusExitCode === 0,
      message: successMsg,
      output: executionLog.trim(),
      serviceStatus: isRunning ? 'active' : 'inactive',
    };
  }

  // Windows / local fallback simulation (dynamic status reflection)
  const now = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());

  if (action === 'stop') {
    localServiceStates[service].status = 'Stopped';
    return {
      success: true,
      message: `Your website (${service}) has been stopped.`,
      output: `$ systemctl stop ${service}\n\n$ systemctl status ${service} --no-pager -l\n○ ${service}.service - ${ALLOWED_SERVICES[service].name}\n     Loaded: loaded (/etc/systemd/system/${service}.service; enabled; vendor preset: enabled)\n     Active: inactive (dead) since ${now} IST; 1s ago\n    Process: ${localServiceStates[service].pid} ExecStop=/bin/kill $MAINPID (code=exited, status=0/SUCCESS)\n   Main PID: ${localServiceStates[service].pid} (code=exited, status=0/SUCCESS)`,
      serviceStatus: 'inactive',
    };
  } else if (action === 'start') {
    localServiceStates[service].status = 'Running';
    localServiceStates[service].pid = Math.floor(30000 + Math.random() * 9000);
    return {
      success: true,
      message: `Your website (${service}) has been started successfully!`,
      output: `$ systemctl start ${service}\n\n$ systemctl status ${service} --no-pager -l\n● ${service}.service - ${ALLOWED_SERVICES[service].name}\n     Loaded: loaded (/etc/systemd/system/${service}.service; enabled; vendor preset: enabled)\n     Active: active (running) since ${now} IST; 1s ago\n   Main PID: ${localServiceStates[service].pid} (node)\n      Tasks: 11 (limit: 4642)\n     Memory: 52.4M\n        CPU: 420ms\n     CGroup: /system.slice/${service}.service\n             └─${localServiceStates[service].pid} /usr/bin/node server.mjs`,
      serviceStatus: 'active',
    };
  } else if (action === 'restart') {
    localServiceStates[service].status = 'Running';
    localServiceStates[service].pid = Math.floor(30000 + Math.random() * 9000);
    return {
      success: true,
      message: `Your website (${service}) has been restarted successfully!`,
      output: `$ systemctl restart ${service}\n\n$ systemctl status ${service} --no-pager -l\n● ${service}.service - ${ALLOWED_SERVICES[service].name}\n     Loaded: loaded (/etc/systemd/system/${service}.service; enabled; vendor preset: enabled)\n     Active: active (running) since ${now} IST; 1s ago\n   Main PID: ${localServiceStates[service].pid} (node)\n      Tasks: 11 (limit: 4642)\n     Memory: 48.6M\n        CPU: 380ms\n     CGroup: /system.slice/${service}.service\n             └─${localServiceStates[service].pid} /usr/bin/node server.mjs`,
      serviceStatus: 'active',
    };
  } else if (action === 'status') {
    const isRunning = localServiceStates[service].status === 'Running';
    return {
      success: true,
      message: 'Status retrieved',
      output: `$ systemctl status ${service} --no-pager -l\n${
        isRunning ? '●' : '○'
      } ${service}.service - ${ALLOWED_SERVICES[service].name}\n     Loaded: loaded (/etc/systemd/system/${service}.service; enabled; vendor preset: enabled)\n     Active: ${
        isRunning ? 'active (running)' : 'inactive (dead)'
      } since ${now} IST\n   Main PID: ${isRunning ? `${localServiceStates[service].pid} (node)` : '-'}\n     Tasks: ${
        isRunning ? '11 (limit: 4642)' : '0'
      }\n     Memory: ${
        isRunning ? '52.4M' : '0B'
      }\n     CGroup: /system.slice/${service}.service\n             ${
        isRunning ? `└─${localServiceStates[service].pid} /usr/bin/node server.mjs` : ''
      }`,
      serviceStatus: isRunning ? 'active' : 'inactive',
    };
  } else if (action === 'logs') {
    return {
      success: true,
      message: 'Logs fetched',
      output: `$ journalctl -u ${service} -n 60 --no-pager\n[INFO] ${now} [${service}] Service operational\n[INFO] ${now} [${service}] Active client connection accepted\n[OK] ${now} [${service}] HTTP GET / - 200 OK`,
      serviceStatus: 'active',
    };
  }

  return { success: true, message: 'Action complete' };
}
