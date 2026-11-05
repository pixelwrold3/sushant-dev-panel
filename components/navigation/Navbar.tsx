'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
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
  LogOut,
  FolderGit2,
  Plus,
  Info,
  X,
  Sparkles,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUserEmail, setCurrentUserEmail] = useState('admin@devpanel.local');
  const [currentRole, setCurrentRole] = useState('OWNER');
  const [users, setUsers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<{ cpu: number; mem: number; status: string }>({
    cpu: 24,
    mem: 41,
    status: 'Online',
  });
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [copiedVersion, setCopiedVersion] = useState(false);

  // If on login page, don't show full navigation
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (isLoginPage) return;

    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setCurrentUserEmail(data.user.email);
          setCurrentRole(data.user.role);
        }
        if (data?.availableUsers) {
          setUsers(data.availableUsers);
        }
      })
      .catch(() => {});

    const fetchQuickMetrics = () => {
      if (typeof document !== 'undefined' && document.hidden) return;

      fetch('/api/monitoring/metrics')
        .then((res) => {
          if (res.status === 401) {
            router.push('/login');
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (data?.current) {
            setMetrics({
              cpu: data.current.cpu?.usagePercent || 24,
              mem: data.current.memory?.usagePercent || 41,
              status: 'Online',
            });
          }
        })
        .catch(() => {});
    };

    fetchQuickMetrics();
    const interval = setInterval(fetchQuickMetrics, 12000);
    return () => clearInterval(interval);
  }, [isLoginPage, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('devpanel_session_token');
    router.push('/login');
    router.refresh();
  };

  const navLinks = [
    { name: 'Dashboard', href: '/', icon: Activity },
    { name: 'Workspaces', href: '/workspaces', icon: FolderGit2, extraActive: ['/editor'] },
    { name: 'Security', href: '/security', icon: ShieldAlert },
    { name: 'Monitoring', href: '/monitoring', icon: Server },
    { name: 'Deploy', href: '/deploy', icon: Rocket },
    { name: 'Team', href: '/team', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  if (isLoginPage) return null;

  return (
    <>
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
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href)) ||
                  (item.extraActive && item.extraActive.some((ea) => pathname.startsWith(ea)));
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#1e293b] text-blue-400 border border-blue-500/30'
                        : 'text-gray-300 hover:text-white hover:bg-[#131e36]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.name}</span>
                  </a>
                );
              })}

              {/* Info / About Popup Button next to Settings */}
              <button
                onClick={() => setInfoModalOpen(true)}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-[#131e36] transition-colors border border-blue-500/20 bg-blue-500/10 ml-1"
                title="DevPanel System Information & Credits (v1.21.131)"
              >
                <Info className="w-3.5 h-3.5" />
                <span className="font-mono text-[11px] font-semibold">v1.21.131</span>
              </button>
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

            {/* User Profile & Logout */}
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
                <div className="absolute right-0 mt-2 w-52 rounded-lg bg-[#0f172a] border border-[#1e293b] shadow-xl py-1 z-50 text-xs">
                  <div className="px-3 py-2 border-b border-[#1e293b]">
                    <div className="font-semibold text-gray-200">{currentUserEmail}</div>
                    <div className="text-[11px] text-emerald-400">Session Active (Saved)</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-rose-400 hover:bg-[#1e293b] text-left transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Info & Credits Modal - Rendered outside <header> so it is centered in the exact center of screen */}
      {infoModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0d1322] border border-[#1e293b] rounded-xl shadow-2xl max-w-md w-full overflow-hidden m-auto relative z-10">
            {/* Header */}
            <div className="p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#090d16]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20">
                  DP
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    DevPanel Professional
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      v1.21.131
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-400 font-mono">Self-Hosted Server &amp; Web Engine</p>
                </div>
              </div>
              <button
                onClick={() => setInfoModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#1e293b] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Studio & Developer Cards */}
              <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3.5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#1e293b]">
                  <span className="text-gray-400">Version</span>
                  <span className="font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                    1.21.131
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[#1e293b]">
                  <span className="text-gray-400">Developed By</span>
                  <span className="font-semibold text-white flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Angara Studio
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[#1e293b]">
                  <span className="text-gray-400">Developers</span>
                  <span className="font-semibold text-blue-400 font-mono">Sushant Rai</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Developer Under</span>
                  <span className="font-semibold text-purple-400">
                    Pixels <span className="text-gray-400 text-[11px] font-normal">(Owner: Sushant)</span>
                  </span>
                </div>
              </div>

              {/* Server & Security Environment Details */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-[#090d16] border border-[#1e293b] rounded p-2.5">
                  <div className="text-gray-500 text-[10px]">INFRASTRUCTURE</div>
                  <div className="text-gray-200 mt-0.5">Oracle Cloud (OCI)</div>
                </div>
                <div className="bg-[#090d16] border border-[#1e293b] rounded p-2.5">
                  <div className="text-gray-500 text-[10px]">SECURITY JAIL</div>
                  <div className="text-emerald-400 mt-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Bubblewrap Active
                  </div>
                </div>
                <div className="bg-[#090d16] border border-[#1e293b] rounded p-2.5">
                  <div className="text-gray-500 text-[10px]">TIMEZONE</div>
                  <div className="text-blue-300 mt-0.5">Asia/Kolkata (IST)</div>
                </div>
                <div className="bg-[#090d16] border border-[#1e293b] rounded p-2.5">
                  <div className="text-gray-500 text-[10px]">NODE RUNTIME</div>
                  <div className="text-gray-200 mt-0.5">v22.x LTS Production</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-[#090d16] border-t border-[#1e293b] flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    'DevPanel v1.21.131 (Developed by Angara Studio, Developers - Sushant Rai, Developer under Pixels (Owner: Sushant))'
                  );
                  setCopiedVersion(true);
                  setTimeout(() => setCopiedVersion(false), 2000);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#131e36] hover:bg-[#1e293b] text-gray-300 hover:text-white transition-colors border border-[#1e293b] text-[11px]"
              >
                {copiedVersion ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-gray-400" />
                    <span>Copy Info</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setInfoModalOpen(false)}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
