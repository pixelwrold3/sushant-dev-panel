'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  Clock,
  Activity,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  Lock,
} from 'lucide-react';

export default function SecurityPage() {
  const [tab, setTab] = useState<'rules' | 'ips' | 'requests' | 'events'>('rules');
  const [ipSubTab, setIpSubTab] = useState<'all' | 'temporary' | 'permanent' | 'allowlist'>('all');

  const [rules, setRules] = useState<any[]>([]);
  const [ipRecords, setIpRecords] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [requestsData, setRequestsData] = useState<any>(null);

  // New Rule Modal
  const [createRuleModal, setCreateRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    route: '/api/*',
    method: 'ALL',
    threshold: 60,
    windowSeconds: 60,
    blockDurationMinutes: 15,
  });

  // Manual IP Block Modal
  const [blockIpModal, setBlockIpModal] = useState(false);
  const [manualIp, setManualIp] = useState({
    ip: '',
    type: 'temporary',
    reason: 'Suspicious traffic',
    durationMinutes: '60',
    confirmSelfLockout: false,
  });
  const [selfLockoutWarning, setSelfLockoutWarning] = useState<string | null>(null);

  // Selected IP details modal
  const [selectedIpRecord, setSelectedIpRecord] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchSecurityData = async () => {
    try {
      const [rRes, ipRes, evRes, reqRes] = await Promise.all([
        fetch('/api/security/rules').then(r => r.json()),
        fetch('/api/security/ips').then(r => r.json()),
        fetch('/api/security/events').then(r => r.json()),
        fetch('/api/requests').then(r => r.json()),
      ]);

      if (rRes.rules) setRules(rRes.rules);
      if (ipRes.ipRecords) setIpRecords(ipRes.ipRecords);
      if (evRes.events) setSecurityEvents(evRes.events);
      if (reqRes) setRequestsData(reqRes);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSecurityData();
    const interval = setInterval(fetchSecurityData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Toggle Rule
  const handleToggleRule = async (rule: any) => {
    try {
      await fetch('/api/security/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
      });
      fetchSecurityData();
    } catch (err) {
      alert('Failed to update rule');
    }
  };

  // Delete Rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await fetch(`/api/security/rules?id=${ruleId}`, { method: 'DELETE' });
      fetchSecurityData();
    } catch (err) {
      alert('Failed to delete rule');
    }
  };

  // Submit Rule
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/security/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });
      if (res.ok) {
        setCreateRuleModal(false);
        setNewRule({
          name: '',
          route: '/api/*',
          method: 'ALL',
          threshold: 60,
          windowSeconds: 60,
          blockDurationMinutes: 15,
        });
        fetchSecurityData();
      }
    } catch (err) {
      alert('Failed to create rule');
    }
  };

  // Submit IP Block
  const handleBlockIpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSelfLockoutWarning(null);

    try {
      const res = await fetch('/api/security/ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualIp),
      });
      const data = await res.json();

      if (res.status === 400 && data.requiresConfirmation) {
        setSelfLockoutWarning(data.warning);
        return;
      }

      if (res.ok) {
        setBlockIpModal(false);
        setManualIp({
          ip: '',
          type: 'temporary',
          reason: 'Suspicious traffic',
          durationMinutes: '60',
          confirmSelfLockout: false,
        });
        setStatusMessage('IP action executed successfully.');
        fetchSecurityData();
      } else {
        alert(data.error || 'Failed to process IP');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Unblock IP
  const handleUnblockIp = async (ip: string) => {
    if (!confirm(`Unblock IP ${ip}?`)) return;
    try {
      await fetch(`/api/security/ips?ip=${encodeURIComponent(ip)}`, { method: 'DELETE' });
      fetchSecurityData();
      if (selectedIpRecord?.ip === ip) setSelectedIpRecord(null);
    } catch {
      alert('Failed to unblock IP');
    }
  };

  // Filter IPs
  const filteredIps = ipRecords.filter((rec) => {
    if (ipSubTab === 'temporary') return rec.type === 'temporary' && rec.status === 'active';
    if (ipSubTab === 'permanent') return rec.type === 'permanent' && rec.status === 'active';
    if (ipSubTab === 'allowlist') return rec.type === 'allowlist' && rec.status === 'active';
    return rec.status === 'active';
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Security &amp; DDoS Protection
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time rate limit evaluation, automated temporary &amp; permanent IP blocking, and request forensics.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setCreateRuleModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Rule
          </button>
          <button
            onClick={() => setBlockIpModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors"
          >
            <Ban className="w-3.5 h-3.5" />
            Block IP Manually
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-900/30 border border-emerald-500/40 text-emerald-200 text-xs">
          {statusMessage}
        </div>
      )}

      {/* Row 1: Security Overview KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Rate Limiting</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 my-1">ENABLED</div>
          <div className="text-[11px] text-gray-500">{rules.filter(r => r.enabled).length} active rule definitions</div>
        </div>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Blocked IPs</div>
          <div className="text-2xl font-bold font-mono text-rose-400 my-1">
            {ipRecords.filter(r => (r.type === 'permanent' || r.type === 'temporary') && r.status === 'active').length}
          </div>
          <div className="text-[11px] text-gray-500">
            {ipRecords.filter(r => r.type === 'temporary' && r.status === 'active').length} temp,{' '}
            {ipRecords.filter(r => r.type === 'permanent' && r.status === 'active').length} perm
          </div>
        </div>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Allowlisted IPs</div>
          <div className="text-2xl font-bold font-mono text-blue-400 my-1">
            {ipRecords.filter(r => r.type === 'allowlist' && r.status === 'active').length}
          </div>
          <div className="text-[11px] text-gray-500">Bypasses rate limit rules</div>
        </div>
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Blocked Requests</div>
          <div className="text-2xl font-bold font-mono text-amber-400 my-1">
            {requestsData?.stats?.blockedCount || 12}
          </div>
          <div className="text-[11px] text-gray-500">Last 500 sampled requests</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-[#1e293b] text-xs font-medium">
        {[
          { id: 'rules', label: 'Rate Limiting Rules' },
          { id: 'ips', label: 'IP Management' },
          { id: 'requests', label: 'Live Request Monitor' },
          { id: 'events', label: 'Security Events Log' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`pb-3 px-3 transition-colors relative ${tab === t.id ? 'text-blue-400 font-semibold border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Rate Limiting Rules */}
      {tab === 'rules' && (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Configured Rules</h2>
            <span className="text-xs text-gray-500">Evaluated on every incoming HTTP request</span>
          </div>

          <div className="divide-y divide-[#1e293b]">
            {rules.map((rule) => (
              <div key={rule.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <span className="text-sm font-medium text-gray-200">{rule.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {rule.method} {rule.route}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-3">
                    <span>
                      Threshold: <span className="text-white font-mono">{rule.threshold}</span> reqs /{' '}
                      <span className="text-white font-mono">{rule.windowSeconds}s</span>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Action:{' '}
                      <span className="text-rose-400 font-mono">
                        {rule.blockDurationMinutes === 0 ? 'Permanent Block' : `Block for ${rule.blockDurationMinutes} min`}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleToggleRule(rule)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${rule.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-gray-800 text-gray-400'
                      }`}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-[#131e36] rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: IP Management */}
      {tab === 'ips' && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex items-center space-x-2 text-xs">
            {['all', 'temporary', 'permanent', 'allowlist'].map((st) => (
              <button
                key={st}
                onClick={() => setIpSubTab(st as any)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-colors ${ipSubTab === st
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0f172a] border border-[#1e293b] text-gray-400 hover:text-gray-200'
                  }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1e293b] text-gray-400 font-mono">
                    <th className="pb-3">IP Address</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Reason</th>
                    <th className="pb-3">Block Expiration</th>
                    <th className="pb-3">Requests / Blocked</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b] font-mono text-gray-300">
                  {filteredIps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">
                        No IP records found in this category.
                      </td>
                    </tr>
                  ) : (
                    filteredIps.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#131e36] transition-colors">
                        <td className="py-3 font-semibold text-white">
                          <button
                            onClick={() => setSelectedIpRecord(rec)}
                            className="text-blue-400 hover:underline"
                          >
                            {rec.ip}
                          </button>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase ${rec.type === 'permanent'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : rec.type === 'temporary'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}
                          >
                            {rec.type}
                          </span>
                        </td>
                        <td className="py-3 text-gray-300 font-sans max-w-xs truncate">{rec.reason}</td>
                        <td className="py-3 text-gray-400">
                          {rec.expiresAt ? (
                            <span className="flex items-center gap-1 text-amber-400">
                              <Clock className="w-3 h-3" />
                              {new Date(rec.expiresAt).toLocaleTimeString()}
                            </span>
                          ) : rec.type === 'allowlist' ? (
                            <span className="text-emerald-400">Never</span>
                          ) : (
                            <span className="text-rose-400">Permanent</span>
                          )}
                        </td>
                        <td className="py-3 text-gray-400">
                          {rec.requestCount || 0} reqs / <span className="text-rose-400">{rec.blockedCount || 0} blk</span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setSelectedIpRecord(rec)}
                              className="px-2 py-1 rounded bg-[#131e36] hover:bg-[#1e293b] text-gray-300 text-[11px]"
                            >
                              Details
                            </button>
                            {rec.type !== 'allowlist' && (
                              <button
                                onClick={() => handleUnblockIp(rec.ip)}
                                className="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-[11px]"
                              >
                                Unblock
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Request Monitor */}
      {tab === 'requests' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-[#0f172a] border border-[#1e293b] rounded-xl text-center">
              <div className="text-[11px] text-gray-400">2xx Success</div>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                {requestsData?.stats?.status2xx || 0}
              </div>
            </div>
            <div className="p-3 bg-[#0f172a] border border-[#1e293b] rounded-xl text-center">
              <div className="text-[11px] text-gray-400">3xx Redirect</div>
              <div className="text-lg font-bold font-mono text-blue-400 mt-1">
                {requestsData?.stats?.status3xx || 0}
              </div>
            </div>
            <div className="p-3 bg-[#0f172a] border border-[#1e293b] rounded-xl text-center">
              <div className="text-[11px] text-gray-400">4xx Client Err</div>
              <div className="text-lg font-bold font-mono text-amber-400 mt-1">
                {requestsData?.stats?.status4xx || 0}
              </div>
            </div>
            <div className="p-3 bg-[#0f172a] border border-[#1e293b] rounded-xl text-center">
              <div className="text-[11px] text-gray-400">5xx Server Err</div>
              <div className="text-lg font-bold font-mono text-rose-400 mt-1">
                {requestsData?.stats?.status5xx || 0}
              </div>
            </div>
            <div className="p-3 bg-[#0f172a] border border-[#1e293b] rounded-xl text-center">
              <div className="text-[11px] text-gray-400">429 Rate Limited</div>
              <div className="text-lg font-bold font-mono text-purple-400 mt-1">
                {requestsData?.stats?.status429 || 0}
              </div>
            </div>
          </div>

          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Real-time Ingress Stream
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#1e293b] text-gray-500">
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Client IP</th>
                    <th className="pb-2">Method</th>
                    <th className="pb-2">Route</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b]">
                  {(!requestsData?.recentLogs || requestsData.recentLogs.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">
                        No requests recorded yet.
                      </td>
                    </tr>
                  ) : (
                    requestsData.recentLogs.map((req: any) => (
                      <tr key={req.id} className="hover:bg-[#131e36]">
                        <td className="py-2 text-gray-400">{new Date(req.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2 text-blue-400">{req.ip}</td>
                        <td className="py-2 font-bold text-gray-200">{req.method}</td>
                        <td className="py-2 text-gray-300">{req.route}</td>
                        <td className="py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${req.status < 300
                                ? 'text-emerald-400'
                                : req.status === 429
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                              }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-2 text-gray-400">{req.durationMs}ms</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Security Events */}
      {tab === 'events' && (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="divide-y divide-[#1e293b]">
            {securityEvents.map((ev) => (
              <div key={ev.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold ${ev.result === 'BLOCKED'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                  >
                    {ev.result}
                  </span>
                  <div>
                    <div className="font-medium text-gray-200">{ev.action}</div>
                    <div className="text-[11px] text-gray-400">{ev.reason}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-gray-400 font-mono text-[11px]">
                  <span>IP: {ev.ip}</span>
                  <span>{new Date(ev.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create Security Rule */}
      {createRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleCreateRule}
            className="w-full max-w-md bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-semibold text-white">Create Security Rate Limit Rule</h3>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Rule Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Sensitive API Protection"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Route Pattern</label>
                <input
                  type="text"
                  required
                  placeholder="/api/* or *"
                  value={newRule.route}
                  onChange={(e) => setNewRule({ ...newRule, route: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Method</label>
                <select
                  value={newRule.method}
                  onChange={(e) => setNewRule({ ...newRule, method: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200"
                >
                  <option value="ALL">ALL Methods</option>
                  <option value="POST">POST Only</option>
                  <option value="GET">GET Only</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Threshold (Requests)</label>
                <input
                  type="number"
                  required
                  value={newRule.threshold}
                  onChange={(e) => setNewRule({ ...newRule, threshold: parseInt(e.target.value, 10) })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Window (Seconds)</label>
                <input
                  type="number"
                  required
                  value={newRule.windowSeconds}
                  onChange={(e) => setNewRule({ ...newRule, windowSeconds: parseInt(e.target.value, 10) })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Block Duration (Minutes, 0 = permanent)</label>
              <input
                type="number"
                value={newRule.blockDurationMinutes}
                onChange={(e) => setNewRule({ ...newRule, blockDurationMinutes: parseInt(e.target.value, 10) })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200 font-mono"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={() => setCreateRuleModal(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg"
              >
                Save Rule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Block IP Manually */}
      {blockIpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleBlockIpSubmit}
            className="w-full max-w-md bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-semibold text-white">Manual IP Block or Allowlist</h3>

            {selfLockoutWarning && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
                <div className="font-semibold flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Self-Lockout Warning!
                </div>
                {selfLockoutWarning}
                <label className="flex items-center gap-2 mt-2 pt-2 border-t border-rose-500/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualIp.confirmSelfLockout}
                    onChange={(e) => setManualIp({ ...manualIp, confirmSelfLockout: e.target.checked })}
                    className="rounded bg-[#090d16]"
                  />
                  <span>Yes, I explicitly confirm blocking this IP</span>
                </label>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 block mb-1">IP Address</label>
              <input
                type="text"
                required
                placeholder="e.g. 192.168.1.100 or 103.45.2.1"
                value={manualIp.ip}
                onChange={(e) => setManualIp({ ...manualIp, ip: e.target.value })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Action Type</label>
                <select
                  value={manualIp.type}
                  onChange={(e) => setManualIp({ ...manualIp, type: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200"
                >
                  <option value="temporary">Temporary Block</option>
                  <option value="permanent">Permanent Block</option>
                  <option value="allowlist">Allowlist (Trusted)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Duration</label>
                <select
                  value={manualIp.durationMinutes}
                  onChange={(e) => setManualIp({ ...manualIp, durationMinutes: e.target.value })}
                  disabled={manualIp.type !== 'temporary'}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200 disabled:opacity-40"
                >
                  <option value="5">5 Minutes</option>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="60">1 Hour</option>
                  <option value="360">6 Hours</option>
                  <option value="1440">24 Hours</option>
                  <option value="10080">7 Days</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Reason</label>
              <input
                type="text"
                required
                placeholder="e.g. Suspicious brute force scanning"
                value={manualIp.reason}
                onChange={(e) => setManualIp({ ...manualIp, reason: e.target.value })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={() => setBlockIpModal(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium rounded-lg"
              >
                Confirm Action
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: IP Forensics Details */}
      {selectedIpRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <h3 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-400" />
                IP Forensics: {selectedIpRecord.ip}
              </h3>
              <button
                onClick={() => setSelectedIpRecord(null)}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-[#1e293b] rounded"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Requests:</span>
                <span className="font-mono text-white">{selectedIpRecord.requestCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Blocked Requests:</span>
                <span className="font-mono text-rose-400">{selectedIpRecord.blockedCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="font-mono uppercase text-rose-400 font-bold">{selectedIpRecord.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Reason:</span>
                <span className="text-gray-200">{selectedIpRecord.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Expires:</span>
                <span className="font-mono text-amber-400">
                  {selectedIpRecord.expiresAt ? new Date(selectedIpRecord.expiresAt).toLocaleString() : 'Never (Permanent)'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block mb-1">Targeted Routes:</span>
                <div className="p-2 bg-[#090d16] rounded border border-[#1e293b] font-mono text-[11px] text-gray-300">
                  {selectedIpRecord.routesHit && selectedIpRecord.routesHit.length > 0 ? (
                    selectedIpRecord.routesHit.map((r: string) => <div key={r}>&bull; {r}</div>)
                  ) : (
                    <div>No specific routes logged</div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1e293b] flex justify-end">
              <button
                onClick={() => handleUnblockIp(selectedIpRecord.ip)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium"
              >
                Unblock IP Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

