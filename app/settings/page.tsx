'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Clock,
  Database,
  Lock,
  CheckCircle2,
  Bell,
  Cpu,
  Layers,
} from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({
    rateLimitingEnabled: true,
    ipBlockingEnabled: true,
    auditLogsEnabled: true,
    secureHeadersEnabled: true,
    loginProtectionEnabled: true,
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
    loginLockoutMinutes: 15,
    requestLogRetentionDays: 7,
    securityEventRetentionDays: 30,
    autoBlockRepeatOffenders: true,
  });

  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings(d.settings);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 3000);
      }
    } catch {
      alert('Failed to save settings');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            System &amp; Security Settings
            <Settings className="w-5 h-5 text-gray-400" />
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Global panel parameters, rate limiter thresholds, IP protection policies, and log retention.
          </p>
        </div>

        {savedMsg && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
            Settings saved successfully!
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Security Feature Toggles */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Active Protection Modules
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <label className="flex items-center justify-between p-3 bg-[#090d16] rounded-lg border border-[#1e293b] cursor-pointer">
              <div>
                <div className="font-semibold text-gray-200">Rate Limiting Engine</div>
                <div className="text-gray-400 text-[11px]">Enforce thresholds on inbound requests</div>
              </div>
              <input
                type="checkbox"
                checked={settings.rateLimitingEnabled}
                onChange={(e) => setSettings({ ...settings, rateLimitingEnabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded bg-[#090d16]"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-[#090d16] rounded-lg border border-[#1e293b] cursor-pointer">
              <div>
                <div className="font-semibold text-gray-200">Automated IP Blocking</div>
                <div className="text-gray-400 text-[11px]">Temporarily or permanently drop malicious IPs</div>
              </div>
              <input
                type="checkbox"
                checked={settings.ipBlockingEnabled}
                onChange={(e) => setSettings({ ...settings, ipBlockingEnabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded bg-[#090d16]"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-[#090d16] rounded-lg border border-[#1e293b] cursor-pointer">
              <div>
                <div className="font-semibold text-gray-200">Tamper-Proof Audit Logging</div>
                <div className="text-gray-400 text-[11px]">Log all file modifications, git pushes, and actions</div>
              </div>
              <input
                type="checkbox"
                checked={settings.auditLogsEnabled}
                onChange={(e) => setSettings({ ...settings, auditLogsEnabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded bg-[#090d16]"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-[#090d16] rounded-lg border border-[#1e293b] cursor-pointer">
              <div>
                <div className="font-semibold text-gray-200">Login Brute Force Lockout</div>
                <div className="text-gray-400 text-[11px]">Block after consecutive failed authentication attempts</div>
              </div>
              <input
                type="checkbox"
                checked={settings.loginProtectionEnabled}
                onChange={(e) => setSettings({ ...settings, loginProtectionEnabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded bg-[#090d16]"
              />
            </label>
          </div>
        </div>

        {/* Lockout & Thresholds */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Timeouts &amp; Lockout Thresholds
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-gray-400 block mb-1">Session Timeout (Minutes)</label>
              <input
                type="number"
                value={settings.sessionTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value, 10) })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-mono"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Max Login Attempts</label>
              <input
                type="number"
                value={settings.maxLoginAttempts}
                onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value, 10) })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-mono"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Lockout Duration (Minutes)</label>
              <input
                type="number"
                value={settings.loginLockoutMinutes}
                onChange={(e) => setSettings({ ...settings, loginLockoutMinutes: parseInt(e.target.value, 10) })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Data Retention & Repeat Offender Escalation */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-400" />
            Log Retention &amp; Escalating Penalty Policy
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-gray-400 block mb-1">Request Log Retention (Days)</label>
              <input
                type="number"
                value={settings.requestLogRetentionDays}
                onChange={(e) => setSettings({ ...settings, requestLogRetentionDays: parseInt(e.target.value, 10) })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-mono"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Security Event Retention (Days)</label>
              <input
                type="number"
                value={settings.securityEventRetentionDays}
                onChange={(e) => setSettings({ ...settings, securityEventRetentionDays: parseInt(e.target.value, 10) })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs">
            <div className="font-semibold text-gray-200 mb-1">Repeat Offender Escalation Ladder:</div>
            <div className="text-gray-400 font-mono text-[11px] space-x-2">
              <span className="text-emerald-400">1st: 5m</span> &rarr;
              <span className="text-blue-400">2nd: 15m</span> &rarr;
              <span className="text-amber-400">3rd: 1h</span> &rarr;
              <span className="text-purple-400">4th: 6h</span> &rarr;
              <span className="text-rose-400">5th: 24h</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-600/20 transition-colors"
          >
            Save All Settings
          </button>
        </div>
      </form>
    </div>
  );
}

