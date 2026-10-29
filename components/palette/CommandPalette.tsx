'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Terminal,
  FileCode,
  GitBranch,
  ShieldAlert,
  Activity,
  Users,
  Settings,
  Rocket,
  Search,
  X,
  Server,
  Ban,
  CheckCircle2,
} from 'lucide-react';

interface CommandItem {
  id: string;
  name: string;
  category: string;
  icon: any;
  shortcut?: string;
  action: () => void;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const commands: CommandItem[] = [
    {
      id: 'cmd_dash',
      name: 'Open Dashboard',
      category: 'Navigation',
      icon: Activity,
      shortcut: 'G D',
      action: () => { router.push('/'); setOpen(false); },
    },
    {
      id: 'cmd_editor',
      name: 'Open Web Code Editor',
      category: 'Editor',
      icon: FileCode,
      shortcut: 'G E',
      action: () => { router.push('/editor'); setOpen(false); },
    },
    {
      id: 'cmd_git',
      name: 'Open Git Source Control',
      category: 'Git',
      icon: GitBranch,
      shortcut: 'G G',
      action: () => { router.push('/git'); setOpen(false); },
    },
    {
      id: 'cmd_security',
      name: 'Open Security & Rate Limiting',
      category: 'Security',
      icon: ShieldAlert,
      shortcut: 'G S',
      action: () => { router.push('/security'); setOpen(false); },
    },
    {
      id: 'cmd_monitoring',
      name: 'Open Server Monitoring',
      category: 'System',
      icon: Activity,
      shortcut: 'G M',
      action: () => { router.push('/monitoring'); setOpen(false); },
    },
    {
      id: 'cmd_deploy',
      name: 'Open Deployment Pipeline',
      category: 'Deploy',
      icon: Rocket,
      shortcut: 'G P',
      action: () => { router.push('/deploy'); setOpen(false); },
    },
    {
      id: 'cmd_team',
      name: 'Manage Team & Permissions',
      category: 'Admin',
      icon: Users,
      action: () => { router.push('/team'); setOpen(false); },
    },
    {
      id: 'cmd_settings',
      name: 'Open System Settings',
      category: 'Settings',
      icon: Settings,
      action: () => { router.push('/settings'); setOpen(false); },
    },
    {
      id: 'cmd_block_ip',
      name: 'Quick Block IP Address',
      category: 'Security',
      icon: Ban,
      action: () => { router.push('/security?tab=ips'); setOpen(false); },
    },
    {
      id: 'cmd_restart_app',
      name: 'Restart Application Service',
      category: 'Server Actions',
      icon: Server,
      action: async () => {
        try {
          await fetch('/api/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: 'application', action: 'restart' }),
          });
          alert('Application service restarted successfully');
        } catch {
          alert('Failed to restart application service');
        }
        setOpen(false);
      },
    },
  ];

  const filtered = commands.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl overflow-hidden">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-[#1e293b]">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            type="text"
            className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
            placeholder="Type a command or search... (Ctrl+Shift+P)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No matching commands found.</div>
          ) : (
            filtered.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm text-gray-200 hover:bg-[#1e293b] hover:text-white transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 rounded-md bg-[#131e36] text-blue-400 group-hover:text-blue-300">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">{cmd.name}</div>
                      <div className="text-xs text-gray-400">{cmd.category}</div>
                    </div>
                  </div>
                  {cmd.shortcut && (
                    <kbd className="px-2 py-0.5 text-xs bg-[#090d16] text-gray-400 rounded border border-[#1e293b] font-mono">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#1e293b] bg-[#0a0f1d] flex items-center justify-between text-xs text-gray-400">
          <div>DevPanel Command Center</div>
          <div className="flex items-center space-x-2">
            <span>Use</span>
            <kbd className="px-1.5 py-0.5 bg-[#131e36] rounded font-mono">↑↓</kbd>
            <span>to navigate,</span>
            <kbd className="px-1.5 py-0.5 bg-[#131e36] rounded font-mono">esc</kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

