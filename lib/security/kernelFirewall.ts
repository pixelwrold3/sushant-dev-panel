import http from 'http';

const AGENT_URL = 'http://127.0.0.1:9191';

/**
 * Sends a request to the Go Kernel Agent running on 127.0.0.1:9191
 */
function sendAgentRequest(path: string, payload: any): Promise<{ success: boolean; data?: any; error?: string }> {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const req = http.request(
      `${AGENT_URL}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 800, // 800ms fast timeout
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({ success: res.statusCode === 200, data: parsed });
          } catch {
            resolve({ success: res.statusCode === 200 });
          }
        });
      }
    );

    req.on('error', (err) => {
      // Go agent not running or connection refused - fail gracefully without breaking app
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Agent timeout' });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Drops an IP address at the kernel / iptables level so incoming packets never hit Node.js
 */
export async function blockIpAtKernel(ip: string, reason: string): Promise<boolean> {
  const cleanIp = ip.trim();
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') {
    return false;
  }

  const res = await sendAgentRequest('/api/block', { ip: cleanIp, reason });
  if (res.success) {
    console.log(`[Kernel Firewall] Successfully dropped IP ${cleanIp} via Go agent`);
    return true;
  }
  return false;
}

/**
 * Removes an IP address from the kernel iptables DROP rule
 */
export async function unblockIpAtKernel(ip: string): Promise<boolean> {
  const cleanIp = ip.trim();
  const res = await sendAgentRequest('/api/unblock', { ip: cleanIp });
  if (res.success) {
    console.log(`[Kernel Firewall] Successfully unblocked IP ${cleanIp} via Go agent`);
    return true;
  }
  return false;
}

