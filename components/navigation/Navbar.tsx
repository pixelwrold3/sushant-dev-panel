'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/navigation';
import { usePathname } from 'next/navigation';
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
  Server,
  ChevronDown,
  UserCheck,
  ShieldCheck,
  Wifi,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [currentUserEmail, setCurrentUserEmail] = useState('admin@devpanel.local');
  const [currentRole, setCurrentRole] = useState('OWNER');
  const [users, setUsers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<{ cpu: number; mem: number; status: string }>({
    cpu: 24,
    mem: 41,
    status: 'Online',
  });
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    // Load current user and list of roles
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUserEmail(data.user.email);
          setCurrentRole(data.user.role);
        }
        if (data.availableUsers) {
          setUsers(data.availableUsers);
        }
      })
      .catch(() => { });

    // Polling or websocket for live stats
    const fetchQuickMetrics = () => {
      fetch('/api/monitoring/metrics')
        .then((res) => res.json())
        .then((data) => {
          if (data.current) {
            setMetrics({
              cpu: data.current.cpu?.usagePercent || 24,
              mem: data.current.memory?.usagePercent || 41,
              status: 'Online',
            });
          }
        })
        .catch(() => { });
    };

    fetchQuickMetrics();
    const interval = setInterval(fetchQuickMetrics, 4000);
    return () => clearInterval(interval);
  }, []);

  const switchUser = (user: any) => {
    setCurrentUserEmail(user.email);
    setCurrentRole(user.role);
    setUserDropdownOpen(false);
    // Reload or store in sessionStorage
    sessionStorage.setItem('active_user_email', user.email);
    window.location.reload();
  };

  const navLinks = [
    { name: 'Dashboard', href: '/', icon: Activity },
    { name: 'Editor', href: '/editor', icon: FileCode },
    { name: 'Git', href: '/git', icon: GitBranch },
    { name: 'Security', href: '/security', icon: ShieldAlert },
    { name: 'Monitoring', href: '/monitoring', icon: Server },
    { name: 'Deploy', href: '/deploy', icon: Rocket },
    { name: 'Team', href: '/team', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1e293b] bg-[#090d16]/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center space-x-6">
          <a href="/" className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-sm tracking-wider">
              DP
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-wide text-gray-100 flex items-center gap-1.5">
                DevPanel
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Ubuntu
                </span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono">Self-Hosted Engine</span>
            </div>
          </a>

          {/* Nav Items */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isActive
                      ? 'bg-[#1e293b] text-blue-400 border border-blue-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-[#131e36]'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.name}</span>
                </a>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Telemetry & User Controls */}
        <div className="flex items-center space-x-3">
          {/* Live Telemetry Pill */}
          <div className="hidden lg:flex items-center space-x-3 px-3 py-1 bg-[#0f172a] rounded-full border border-[#1e293b] text-xs font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse status-glow-green" />
              <span className="text-gray-400">Server</span>
              <span className="text-emerald-400 font-semibold">{metrics.status}</span>
            </div>
            <span className="text-gray-600">|</span>
            <div className="flex items-center space-x-1">
              <span className="text-gray-400">CPU</span>
              <span className={metrics.cpu > 80 ? 'text-rose-400' : 'text-blue-400'}>{metrics.cpu}%</span>
            </div>
            <span className="text-gray-600">|</span>
            <div className="flex items-center space-x-1">
              <span className="text-gray-400">RAM</span>
              <span className={metrics.mem > 85 ? 'text-rose-400' : 'text-emerald-400'}>{metrics.mem}%</span>
            </div>
          </div>

          {/* Command Palette Trigger */}
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, shiftKey: true }));
            }}
            className="flex items-center space-x-2 px-2.5 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] text-gray-400 hover:text-gray-200 border border-[#1e293b] rounded-md text-xs transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-[#090d16] text-[10px] rounded border border-gray-800 font-mono text-gray-400">
              Ctrl+Shift+P
            </kbd>
          </button>

          {/* User & Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] text-xs transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-400/50 flex items-center justify-center text-blue-300 font-bold text-[10px]">
                {currentRole[0]}
              </div>
              <div className="flex flex-col text-left leading-none">
                <span className="font-medium text-gray-200">{currentUserEmail.split('@')[0]}</span>
                <span className="text-[10px] text-blue-400 font-mono">{currentRole}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg bg-[#0f172a] border border-[#1e293b] shadow-xl py-1 z-50 text-xs">
                <div className="px-3 py-2 border-b border-[#1e293b]">
                  <div className="font-semibold text-gray-200">Test Role Switcher</div>
                  <div className="text-[11px] text-gray-400">Verify server-side RBAC enforcement</div>
                </div>
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => switchUser(u)}
                    className={`w-full flex items-center justify-between px-3 py-2 hover:bg-[#1e293b] text-left transition-colors ${u.email === currentUserEmail ? 'bg-[#131e36] text-blue-400 font-medium' : 'text-gray-300'
                      }`}
                  >
                    <div>
                      <div>{u.name}</div>
                      <div className="text-[10px] text-gray-400">{u.email}</div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

