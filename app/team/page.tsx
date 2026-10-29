'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Shield,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  User,
} from 'lucide-react';

export default function TeamPage() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    role: 'DEVELOPER',
    password: '',
  });
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchTeam = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.users) setTeam(data.users);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateModal(false);
        setNewMember({ name: '', email: '', role: 'DEVELOPER', password: '' });
        setStatusMsg('Team member created successfully.');
        fetchTeam();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleToggleActive = async (user: any) => {
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, active: !user.active }),
      });
      fetchTeam();
    } catch {
      alert('Failed to update status');
    }
  };

  const roleColors: Record<string, string> = {
    OWNER: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    ADMIN: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    DEVELOPER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    VIEWER: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Team &amp; Role-Based Access Control (RBAC)
            <Users className="w-5 h-5 text-blue-400" />
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Enforce strict server-side authorization: Developers cannot access host shells or server actions.
          </p>
        </div>

        <button
          onClick={() => setCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      {statusMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-900/30 border border-emerald-500/40 text-emerald-200 text-xs">
          {statusMsg}
        </div>
      )}

      {/* Permissions Matrix Overview */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Role Permission Matrix
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-lg">
            <div className="font-semibold text-purple-400 mb-2">OWNER</div>
            <ul className="text-gray-400 space-y-1 text-[11px]">
              <li>&bull; Full server operations</li>
              <li>&bull; User management &amp; billing</li>
              <li>&bull; Security rule definitions</li>
              <li>&bull; Code edit &amp; terminal</li>
              <li>&bull; Deployment authority</li>
            </ul>
          </div>
          <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-lg">
            <div className="font-semibold text-blue-400 mb-2">ADMIN</div>
            <ul className="text-gray-400 space-y-1 text-[11px]">
              <li>&bull; Security management</li>
              <li>&bull; IP blocking &amp; unblocking</li>
              <li>&bull; Service restarts</li>
              <li>&bull; Workspace configuration</li>
              <li>&bull; Telemetry monitoring</li>
            </ul>
          </div>
          <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-lg">
            <div className="font-semibold text-emerald-400 mb-2">DEVELOPER</div>
            <ul className="text-gray-400 space-y-1 text-[11px]">
              <li>&bull; Web code editor access</li>
              <li>&bull; Git pull, commit, push</li>
              <li>&bull; Isolated workspace terminal</li>
              <li>&times; No host shell access</li>
              <li>&times; No service restart access</li>
            </ul>
          </div>
          <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-lg">
            <div className="font-semibold text-gray-300 mb-2">VIEWER</div>
            <ul className="text-gray-400 space-y-1 text-[11px]">
              <li>&bull; Read-only code viewing</li>
              <li>&bull; Read-only monitoring stats</li>
              <li>&times; No code editing</li>
              <li>&times; No git push or terminal</li>
              <li>&times; No security adjustments</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Team Member Table */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Active Team Accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1e293b] text-gray-400">
                <th className="pb-3">Name</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Last Active</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b] text-gray-300">
              {team.map((u) => (
                <tr key={u.id} className="hover:bg-[#131e36]">
                  <td className="py-3 font-semibold text-white font-sans">{u.name}</td>
                  <td className="py-3 text-gray-400">{u.email}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleColors[u.role] || 'bg-gray-800 text-gray-400'
                        }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${u.active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                    >
                      {u.active ? 'ACTIVE' : 'SUSPENDED'}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500 text-[11px]">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3 text-right">
                    {u.role !== 'OWNER' && (
                      <button
                        onClick={() => handleToggleActive(u)}
                        className="px-2.5 py-1 bg-[#131e36] hover:bg-[#1e293b] text-gray-300 rounded text-[11px]"
                      >
                        {u.active ? 'Suspend' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Team Member */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleCreateMember}
            className="w-full max-w-md bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-semibold text-white">Add New Team Member</h3>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Alex Rivera"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="alex@company.com"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Role</label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200"
                >
                  <option value="DEVELOPER">DEVELOPER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newMember.password}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={() => setCreateModal(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg"
              >
                Add Member
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

