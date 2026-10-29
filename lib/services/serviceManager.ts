import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export type AllowedService = 'nginx' | 'mongod' | 'cloudflared' | 'application';
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
  nginx: { name: 'Nginx Web Server', description: 'HTTP reverse proxy & SSL termination' },
  mongod: { name: 'MongoDB Server', description: 'Panel metadata database engine', port: 27017 },
  cloudflared: { name: 'Cloudflare Tunnel', description: 'Zero-trust ingress tunnel' },
  application: { name: 'Diet Website App', description: 'Production web application service' },
};

// In-memory simulation status when running locally on Windows/dev environment
const localServiceStates: Record<AllowedService, { status: 'Running' | 'Stopped' | 'Degraded'; uptimeSec: number }> = {
  nginx: { status: 'Running', uptimeSec: 86400 * 4 },
  mongod: { status: 'Running', uptimeSec: 86400 * 12 },
  cloudflared: { status: 'Running', uptimeSec: 86400 * 2 },
  application: { status: 'Running', uptimeSec: 86400 * 1 },
};

export async function listServices(): Promise<ServiceStatus[]> {
  const isLinux = process.platform === 'linux';

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
      memoryUsageMb: id === 'mongod' ? 340 : id === 'nginx' ? 42 : id === 'application' ? 220 : 36,
      cpuPercent: id === 'application' ? 4.2 : 0.8,
    };
  });
}

/**
 * Execute a strictly allowlisted service operation.
 * Arbitrary strings are completely rejected.
 */
export async function executeServiceAction(service: AllowedService, action: AllowedAction): Promise<{ success: boolean; message: string; output?: string }> {
  if (!ALLOWED_SERVICES[service]) {
    throw new Error(`Security Violation: Unrecognized or unauthorized service "${service}".`);
  }

  const validActions: AllowedAction[] = ['start', 'stop', 'restart', 'status', 'logs'];
  if (!validActions.includes(action)) {
    throw new Error(`Security Violation: Invalid service action "${action}".`);
  }

  const isLinux = process.platform === 'linux';

  if (isLinux) {
    try {
      // Map only safe systemctl commands
      let cmd = '';
      if (action === 'logs') {
        cmd = `journalctl -u ${service} -n 50 --no-pager`;
      } else if (action === 'status') {
        cmd = `systemctl is-active ${service}`;
      } else {
        cmd = `sudo systemctl ${action} ${service}`;
      }

      const { stdout, stderr } = await execAsync(cmd);
      return {
        success: true,
        message: `Service ${service} ${action} executed successfully.`,
        output: stdout || stderr,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Command failed: ${err.message}`,
        output: err.stdout || err.stderr,
      };
    }
  }

  // Windows / local fallback simulation
  if (action === 'restart') {
    localServiceStates[service].status = 'Running';
    localServiceStates[service].uptimeSec = 10;
    return { success: true, message: `${ALLOWED_SERVICES[service].name} restarted successfully.` };
  } else if (action === 'stop') {
    localServiceStates[service].status = 'Stopped';
    return { success: true, message: `${ALLOWED_SERVICES[service].name} stopped.` };
  } else if (action === 'start') {
    localServiceStates[service].status = 'Running';
    return { success: true, message: `${ALLOWED_SERVICES[service].name} started.` };
  } else if (action === 'logs') {
    return {
      success: true,
      message: 'Logs fetched',
      output: `[INFO] ${new Date().toISOString()} ${service} started\n[INFO] ${new Date().toISOString()} Active connections accepted\n[OK] Health check passed`,
    };
  }

  return { success: true, message: 'Action complete' };
}

