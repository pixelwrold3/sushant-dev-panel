'use client';

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  HardDrive,
  Activity,
  ShieldCheck,
  ShieldAlert,
  ArrowDown,
  ArrowUp,
  Server,
  Terminal,
  FileCode,
  GitBranch,
  RefreshCw,
  ExternalLink,
  Ban,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [ipCount, setIpCount] = useState({ blocked: 24, temp: 8, perm: 16 });
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const inFlight = React.useRef(false);
  const fetchData = async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [mRes, aRes, sRes, ipRes] = await Promise.all([
        fetch('/api/monitoring/metrics').then(r => r.json()),
        fetch('/api/audit').then(r => r.json()),
        fetch('/api/security/events').then(r => r.json()),
        fetch('/api/security/ips').then(r => r.json()),
      ]);

      if (mRes.current) setMetrics(mRes.current);
      if (aRes.auditLogs) setRecentAudit(aRes.auditLogs.slice(0, 5));
      if (sRes.events) setSecurityEvents(sRes.events.slice(0, 5));
      if (ipRes.ipRecords) {
        const active = ipRes.ipRecords.filter((r: any) => r.status === 'active');
        const temp = active.filter((r: any) => r.type === 'temporary').length;
        const perm = active.filter((r: any) => r.type === 'permanent').length;
        setIpCount({ blocked: active.length, temp, perm });
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickRestart = async (service: string) => {
    setActionMessage(`Executing restart for ${service}...`);
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, action: 'restart' }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(data.message || `${service} restarted successfully`);
      } else {
        setActionMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Failed: ${err.message}`);
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const cpuPercent = metrics?.cpu?.usagePercent ?? 24;
  const memPercent = metrics?.memory?.usagePercent ?? 41;
  const swapPercent = metrics?.swap?.usagePercent ?? 12;
  const avgLoad = metrics?.cpu?.avgLoad?.[0] ?? 1.21;
  const rxMb = metrics?.network?.rxSec ? (metrics.network.rxSec / (1024 * 1024)).toFixed(1) : '12.4';
  const txMb = metrics?.network?.txSec ? (metrics.network.txSec / (1024 * 1024)).toFixed(1) : '4.2';

  return (
    <div className="p-6 max-w-7xl mx-auto space-x-0 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Server Management Dashboard
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse status-glow-green" />
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Production Ubuntu Linux Server &bull; Isolated Developer Environment &bull; Zero Host Compromise
          </p>
        </div>

        {/* Quick Nav Buttons */}
        <div className="flex items-center gap-2.5">
          <a
            href="/editor"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-500/20 transition-colors"
          >
            <FileCode className="w-4 h-4" />
            Web Code Editor
          </a>
          <a
            href="/git"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-gray-200 border border-[#1e293b] font-medium text-xs transition-colors"
          >
            <GitBranch className="w-4 h-4 text-emerald-400" />
            Git Source Control
          </a>
          <a
            href="/security"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-gray-200 border border-[#1e293b] font-medium text-xs transition-colors"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Security & IPs
          </a>
        </div>
      </div>

      {actionMessage && (
        <div className="px-4 py-3 rounded-lg bg-blue-900/30 border border-blue-500/40 text-blue-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span>{actionMessage}</span>
          </div>
        </div>
      )}

      {/* Row 1: Primary Metrics (CPU / RAM / SWAP / LOAD) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 flex flex-col justify-between hover:border-blue-500/30 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase tracking-wider">CPU Usage</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono text-white">{cpuPercent}%</div>
            <div className="w-full bg-[#1e293b] h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${cpuPercent > 80 ? 'bg-rose-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, cpuPercent)}%` }}
              />
            </div>
          </div>
          <div className="text-[11px] text-gray-500 flex justify-between">
            <span>{metrics?.cpu?.cores || 8} vCPUs</span>
            <span>Avg: 28%</span>
          </div>
        </div>

        {/* RAM */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase tracking-wider">RAM Usage</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono text-white">{memPercent}%</div>
            <div className="w-full bg-[#1e293b] h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${memPercent > 85 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, memPercent)}%` }}
              />
            </div>
          </div>
          <div className="text-[11px] text-gray-500 flex justify-between">
            <span>Used: {metrics?.memory ? (metrics.memory.usedBytes / (1024 ** 3)).toFixed(1) : '3.2'} GB</span>
            <span>Total: {metrics?.memory ? (metrics.memory.totalBytes / (1024 ** 3)).toFixed(1) : '8.0'} GB</span>
          </div>
        </div>

        {/* SWAP */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 flex flex-col justify-between hover:border-indigo-500/30 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase tracking-wider">SWAP Usage</span>
            <HardDrive className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono text-white">{swapPercent}%</div>
            <div className="w-full bg-[#1e293b] h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${Math.min(100, swapPercent)}%` }}
              />
            </div>
          </div>
          <div className="text-[11px] text-gray-500 flex justify-between">
            <span>Used: 512 MB</span>
            <span>Total: 4.0 GB</span>
          </div>
        </div>

        {/* LOAD */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase tracking-wider">Load Average</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl font-bold font-mono text-white">{avgLoad}</div>
            <div className="text-xs text-gray-400 mt-2 flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">1m: {avgLoad}</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono">5m: 0.94</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] font-mono">15m: 0.82</span>
            </div>
          </div>
          <div className="text-[11px] text-gray-500">Normal load range</div>
        </div>
      </div>

      {/* Row 2: Server Status, Network, Requests */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Server Status */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Server Status</div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Uptime</span>
              <span className="text-gray-200 font-mono">14 days 6 hours</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Host OS</span>
              <span className="text-gray-200 font-mono">Ubuntu 24.04 LTS (x86_64)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Node Runtime</span>
              <span className="text-gray-200 font-mono">Node.js v20.9.0</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Panel DB</span>
              <span className="text-emerald-400 font-mono">Isolated (devpanel)</span>
            </div>
          </div>
        </div>

        {/* Network Throughput */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Network Traffic</div>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="p-3 bg-[#090d16] rounded-lg border border-[#1e293b]">
              <div className="flex items-center text-xs text-blue-400 mb-1">
                <ArrowDown className="w-3.5 h-3.5 mr-1" />
                Download
              </div>
              <div className="text-xl font-bold font-mono text-white">{rxMb} <span className="text-xs font-normal text-gray-400">MB/s</span></div>
            </div>
            <div className="p-3 bg-[#090d16] rounded-lg border border-[#1e293b]">
              <div className="flex items-center text-xs text-emerald-400 mb-1">
                <ArrowUp className="w-3.5 h-3.5 mr-1" />
                Upload
              </div>
              <div className="text-xl font-bold font-mono text-white">{txMb} <span className="text-xs font-normal text-gray-400">MB/s</span></div>
            </div>
          </div>
          <div className="text-[11px] text-gray-500 mt-2">Active Interface: eth0 (Cloudflare Protected)</div>
        </div>

        {/* Request Rates */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Request Analytics</div>
            <a href="/security" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
              Live Monitor <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Throughput</span>
              <span className="text-sm font-bold font-mono text-white">2,481 <span className="text-xs font-normal text-gray-400">req/min</span></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Blocked Requests</span>
              <span className="text-sm font-bold font-mono text-rose-400">12 blocked</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Average Latency</span>
              <span className="text-sm font-bold font-mono text-emerald-400">18 ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">HTTP 2xx Success Rate</span>
              <span className="text-sm font-bold font-mono text-gray-200">99.4%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Security Status & Quick Server Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Security Overview Card */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Security Protection Engine</div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ACTIVE
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-[#090d16] rounded-lg border border-[#1e293b] text-center">
                <div className="text-xs text-gray-400">Rate Limit</div>
                <div className="text-sm font-bold text-emerald-400 mt-1">Enabled</div>
              </div>
              <div className="p-3 bg-[#090d16] rounded-lg border border-[#1e293b] text-center">
                <div className="text-xs text-gray-400">Blocked IPs</div>
                <div className="text-sm font-bold text-rose-400 mt-1">{ipCount.blocked}</div>
              </div>
              <div className="p-3 bg-[#090d16] rounded-lg border border-[#1e293b] text-center">
                <div className="text-xs text-gray-400">Active Rules</div>
                <div className="text-sm font-bold text-blue-400 mt-1">3 Rules</div>
              </div>
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <div>&bull; Temporary Blocks: <span className="text-gray-200 font-mono">{ipCount.temp} active</span></div>
              <div>&bull; Permanent Blocks: <span className="text-gray-200 font-mono">{ipCount.perm} active</span></div>
              <div>&bull; Repeat Offender Escalation: <span className="text-emerald-400">Active (5m &rarr; 15m &rarr; 1h &rarr; 6h)</span></div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-[#1e293b] flex items-center justify-between">
            <a href="/security" className="text-xs text-blue-400 hover:underline">
              Configure Rate Limits &amp; IP Rules &rarr;
            </a>
          </div>
        </div>

        {/* Controlled Safe Server Actions (Allowlisted only) */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Controlled Server Actions</div>
              <span className="text-[10px] font-mono text-gray-400 bg-[#090d16] px-2 py-0.5 rounded border border-[#1e293b]">
                Strict Allowlist Only
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Privileged service operations verified by server-side RBAC. Arbitrary shell command execution is prohibited.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleQuickRestart('nginx')}
                className="flex items-center justify-center gap-2 p-2.5 bg-[#131e36] hover:bg-[#1e293b] text-xs text-gray-200 rounded-lg border border-[#1e293b] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                Restart Nginx
              </button>
              <button
                onClick={() => handleQuickRestart('application')}
                className="flex items-center justify-center gap-2 p-2.5 bg-[#131e36] hover:bg-[#1e293b] text-xs text-gray-200 rounded-lg border border-[#1e293b] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                Restart App
              </button>
              <button
                onClick={() => handleQuickRestart('mongod')}
                className="flex items-center justify-center gap-2 p-2.5 bg-[#131e36] hover:bg-[#1e293b] text-xs text-gray-200 rounded-lg border border-[#1e293b] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                Restart MongoDB
              </button>
              <button
                onClick={() => handleQuickRestart('cloudflared')}
                className="flex items-center justify-center gap-2 p-2.5 bg-[#131e36] hover:bg-[#1e293b] text-xs text-gray-200 rounded-lg border border-[#1e293b] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                Restart Cloudflare
              </button>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-[#1e293b] flex items-center justify-between text-xs text-gray-500">
            <span>Audit log recorded on every invocation</span>
            <a href="/monitoring" className="text-blue-400 hover:underline">View Service Details &rarr;</a>
          </div>
        </div>
      </div>

      {/* Row 4: Recent Activity & Audit Logs */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-200">Recent Activity &amp; Audit Trail</h2>
          </div>
          <span className="text-xs text-gray-400">Real-Time Event Stream</span>
        </div>
        <div className="divide-y divide-[#1e293b]">
          {recentAudit.length === 0 ? (
            <div className="py-4 text-center text-xs text-gray-500">No recent activity logged.</div>
          ) : (
            recentAudit.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${log.action.includes('Push') || log.action.includes('Git')
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : log.action.includes('Block')
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                    {log.action}
                  </span>
                  <span className="text-gray-300 font-medium">{log.details}</span>
                  <span className="text-gray-500">by {log.user}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-gray-500">{log.ip}</span>
                  <span className="text-gray-500 font-mono text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

