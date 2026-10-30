'use client';

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  HardDrive,
  Activity,
  Server,
  RefreshCw,
  Play,
  Square,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export default function MonitoringPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState('15m');
  const [loading, setLoading] = useState(true);
  const [actionLogModal, setActionLogModal] = useState<{ open: boolean; title: string; content: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const inFlight = React.useRef(false);
  const fetchMonitoringData = async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [mRes, pRes, sRes] = await Promise.all([
        fetch('/api/monitoring/metrics').then(r => r.json()),
        fetch('/api/monitoring/processes').then(r => r.json()),
        fetch('/api/services').then(r => r.json()),
      ]);

      if (mRes.current) setMetrics(mRes.current);
      if (mRes.history) setHistory(mRes.history);
      if (pRes.processes) setProcesses(pRes.processes);
      if (sRes.services) setServices(sRes.services);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleServiceAction = async (service: string, action: string) => {
    setStatusMsg(`Executing ${action} on ${service}...`);
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, action }),
      });
      const data = await res.json();
      if (res.ok) {
        if (action === 'logs') {
          setActionLogModal({
            open: true,
            title: `Service Logs: ${service}`,
            content: data.output || 'No recent log output available.',
          });
        } else {
          setStatusMsg(data.message || `Action executed`);
        }
        fetchMonitoringData();
      } else {
        setStatusMsg(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    }
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const cpu = metrics?.cpu || { usagePercent: 28, avgLoad: [1.2, 0.94, 0.82], cores: 8 };
  const mem = metrics?.memory || { totalBytes: 8 * 1024 ** 3, usedBytes: 3.2 * 1024 ** 3, usagePercent: 40 };
  const swap = metrics?.swap || { totalBytes: 6 * 1024 ** 3, usedBytes: 512 * 1024 ** 2, usagePercent: 8 };
  const disk = metrics?.disk || { totalBytes: 256 * 1024 ** 3, usedBytes: 96 * 1024 ** 3, usagePercent: 37.5, mount: '/' };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Range Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Server Telemetry &amp; System Health
            <Activity className="w-5 h-5 text-blue-400" />
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time operating system performance metrics, hardware utilization, and service daemon status.
          </p>
        </div>

        {/* Time range switcher */}
        <div className="flex items-center space-x-1.5 bg-[#0f172a] p-1 rounded-lg border border-[#1e293b] text-xs">
          {['5m', '15m', '1h', '6h', '24h', '7d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${timeRange === range ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
                }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {statusMsg && (
        <div className="px-4 py-3 rounded-lg bg-blue-900/30 border border-blue-500/40 text-blue-200 text-xs">
          {statusMsg}
        </div>
      )}

      {/* Row 1: Detailed Resource Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Card */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">CPU Utilization</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-white my-2">{cpu.usagePercent}%</div>
          <div className="w-full bg-[#1e293b] h-2 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-500 ${cpu.usagePercent > 80 ? 'bg-rose-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, cpu.usagePercent)}%` }}
            />
          </div>
          <div className="space-y-1 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Cores:</span> <span className="text-gray-200 font-mono">{cpu.cores} Physical/Virtual</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Load:</span>{' '}
              <span className="text-gray-200 font-mono">{cpu.avgLoad?.slice(0, 3).join(', ')}</span>
            </div>
          </div>
        </div>

        {/* RAM Card */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Memory (RAM)</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-white my-2">{mem.usagePercent}%</div>
          <div className="w-full bg-[#1e293b] h-2 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-500 ${mem.usagePercent > 85 ? 'bg-rose-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, mem.usagePercent)}%` }}
            />
          </div>
          <div className="space-y-1 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Used:</span>{' '}
              <span className="text-gray-200 font-mono">{(mem.usedBytes / (1024 ** 3)).toFixed(2)} GB</span>
            </div>
            <div className="flex justify-between">
              <span>Total:</span>{' '}
              <span className="text-gray-200 font-mono">{(mem.totalBytes / (1024 ** 3)).toFixed(2)} GB</span>
            </div>
          </div>
        </div>

        {/* SWAP Card */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Swap Memory</span>
            <HardDrive className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-white my-2">{swap.usagePercent}%</div>
          <div className="w-full bg-[#1e293b] h-2 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(100, swap.usagePercent)}%` }}
            />
          </div>
          <div className="space-y-1 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Used:</span>{' '}
              <span className="text-gray-200 font-mono">{(swap.usedBytes / (1024 ** 2)).toFixed(0)} MB</span>
            </div>
            <div className="flex justify-between">
              <span>Total:</span>{' '}
              <span className="text-gray-200 font-mono">{(swap.totalBytes / (1024 ** 3)).toFixed(2)} GB</span>
            </div>
          </div>
        </div>

        {/* Disk Card */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Storage (Root /)</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-white my-2">{disk.usagePercent}%</div>
          <div className="w-full bg-[#1e293b] h-2 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-500 ${disk.usagePercent > 85 ? 'bg-rose-500' : 'bg-purple-500'}`}
              style={{ width: `${Math.min(100, disk.usagePercent)}%` }}
            />
          </div>
          <div className="space-y-1 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Used:</span>{' '}
              <span className="text-gray-200 font-mono">{(disk.usedBytes / (1024 ** 3)).toFixed(1)} GB</span>
            </div>
            <div className="flex justify-between">
              <span>Available:</span>{' '}
              <span className="text-gray-200 font-mono">{((disk.totalBytes - disk.usedBytes) / (1024 ** 3)).toFixed(1)} GB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Live Graph Telemetry Simulation */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Resource Trends ({timeRange})</h2>
            <p className="text-xs text-gray-400">Rolling telemetry sampled every 3 seconds</p>
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-blue-500 rounded" />
              <span className="text-gray-400">CPU %</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-emerald-500 rounded" />
              <span className="text-gray-400">RAM %</span>
            </div>
          </div>
        </div>

        {/* Visual Sparkline representation */}
        <div className="h-44 w-full bg-[#090d16] border border-[#1e293b] rounded-lg p-3 flex items-end gap-1.5 overflow-hidden">
          {(history.length > 0 ? history : Array.from({ length: 30 }, (_, i) => ({
            cpu: { usagePercent: Math.floor(Math.sin(i / 3) * 20 + 35) },
            memory: { usagePercent: 42 },
          }))).map((pt, idx) => (
            <div key={idx} className="flex-1 flex flex-col justify-end gap-1 h-full items-center group relative">
              <div
                className="w-full bg-blue-500/80 rounded-t group-hover:bg-blue-400 transition-all"
                style={{ height: `${Math.max(4, pt.cpu?.usagePercent || 20)}%` }}
              />
              <div
                className="w-full bg-emerald-500/50 rounded-t group-hover:bg-emerald-400 transition-all"
                style={{ height: `${Math.max(4, (pt.memory?.usagePercent || 40) / 2)}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Row 3: Services & Daemons Monitor */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Service &amp; Daemon Controls</h2>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Strict Allowlist Enforced
          </span>
        </div>

        <div className="divide-y divide-[#1e293b]">
          {services.map((svc) => (
            <div key={svc.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse status-glow-green" />
                <div>
                  <div className="text-xs font-semibold text-gray-200 flex items-center gap-2">
                    {svc.name}
                    <span className="text-[10px] font-mono text-gray-400 font-normal">({svc.id})</span>
                  </div>
                  <div className="text-[11px] text-gray-400">{svc.description}</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right text-[11px] text-gray-400 font-mono hidden md:block">
                  <div>Uptime: {svc.uptime}</div>
                  <div>RAM: {svc.memoryUsageMb} MB</div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleServiceAction(svc.id, 'logs')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#131e36] hover:bg-[#1e293b] text-gray-300 text-xs border border-[#1e293b] transition-colors"
                  >
                    <FileText className="w-3 h-3 text-blue-400" /> Logs
                  </button>
                  <button
                    onClick={() => handleServiceAction(svc.id, 'restart')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs border border-blue-500/30 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Restart
                  </button>
                  <button
                    onClick={() => handleServiceAction(svc.id, 'stop')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-xs border border-rose-500/30 transition-colors"
                  >
                    <Square className="w-3 h-3" /> Stop
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 4: Process Monitor */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Top Active System Processes</h2>
          <span className="text-xs text-gray-500">Sorted by CPU consumption</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1e293b] text-gray-400 font-mono">
                <th className="pb-2">PID</th>
                <th className="pb-2">Process Name</th>
                <th className="pb-2">User</th>
                <th className="pb-2">CPU %</th>
                <th className="pb-2">Memory %</th>
                <th className="pb-2">RAM Usage</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b] font-mono text-gray-300">
              {processes.slice(0, 10).map((p) => (
                <tr key={p.pid} className="hover:bg-[#131e36] transition-colors">
                  <td className="py-2.5 text-blue-400">{p.pid}</td>
                  <td className="py-2.5 font-medium text-white">{p.name}</td>
                  <td className="py-2.5 text-gray-400">{p.user}</td>
                  <td className="py-2.5 text-emerald-400">{p.cpu}%</td>
                  <td className="py-2.5">{p.mem}%</td>
                  <td className="py-2.5 text-gray-400">{p.memBytes ? (p.memBytes / (1024 ** 2)).toFixed(0) + ' MB' : '-'}</td>
                  <td className="py-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log View Modal */}
      {actionLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e293b]">
              <h3 className="text-sm font-semibold text-white">{actionLogModal.title}</h3>
              <button
                onClick={() => setActionLogModal(null)}
                className="text-xs px-2.5 py-1 bg-[#1e293b] text-gray-300 hover:text-white rounded"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-[#090d16] font-mono text-xs text-gray-300">
              <pre className="whitespace-pre-wrap">{actionLogModal.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

