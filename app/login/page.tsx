'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@devpanel.local');
  const [password, setPassword] = useState('adminpassword123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.token) {
          localStorage.setItem('devpanel_session_token', data.token);
        }
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-md bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow decorative effect */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white font-bold text-lg mb-3">
            DP
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">DevPanel Access Portal</h1>
          <p className="text-xs text-gray-400 mt-1">Ubuntu Server &bull; Zero Host Exposure</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5 font-medium">Administrator Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@devpanel.local"
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1.5 font-medium">Master Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2"
          >
            {loading ? 'Authenticating Session...' : 'Sign In to Panel'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#1e293b] text-center text-[11px] text-gray-500">
          Default Dev Credentials: <span className="text-blue-400 font-mono">admin@devpanel.local</span> /{' '}
          <span className="text-emerald-400 font-mono">adminpassword123</span>
        </div>
      </div>
    </div>
  );
}

