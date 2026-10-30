'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Terminal as TerminalIcon } from 'lucide-react';

interface TerminalViewProps {
  projectId: string;
}

export default function TerminalView({ projectId }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setConnectionStatus('connecting');

    async function initTerminal() {
      if (!terminalRef.current) return;

      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      if (!mounted) return;

      if (termInstance.current) {
        termInstance.current.dispose();
      }

      const term = new Terminal({
        theme: {
          background: '#090d16',
          foreground: '#f1f5f9',
          cursor: '#38bdf8',
          selectionBackground: '#1e293b',
          black: '#090d16',
          red: '#f87171',
          green: '#4ade80',
          yellow: '#facc15',
          blue: '#60a5fa',
          magenta: '#c084fc',
          cyan: '#38bdf8',
          white: '#f8fafc',
        },
        fontFamily: 'JetBrains Mono, Menlo, monospace',
        fontSize: 13,
        lineHeight: 1.2,
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      terminalRef.current.innerHTML = '';
      term.open(terminalRef.current);
      fitAddon.fit();

      termInstance.current = term;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/terminal?projectId=${encodeURIComponent(projectId)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mounted) setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onclose = () => {
        if (mounted) setConnectionStatus('disconnected');
        term.write('\r\n\x1b[90m[Terminal session disconnected]\x1b[0m\r\n');
      };

      ws.onerror = () => {
        if (mounted) setConnectionStatus('disconnected');
        term.write('\r\n\x1b[31m[WebSocket connection error - verify server port & permissions]\x1b[0m\r\n');
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      const handleResize = () => {
        try {
          fitAddon.fit();
        } catch {}
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    initTerminal();

    return () => {
      mounted = false;
      if (wsRef.current) wsRef.current.close();
      if (termInstance.current) termInstance.current.dispose();
    };
  }, [projectId, reconnectKey]);

  return (
    <div className="w-full h-full bg-[#090d16] p-2 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 bg-[#0d1322] border-b border-[#1e293b] text-xs text-gray-400 font-mono">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500'
                : connectionStatus === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-rose-500'
            }`}
          />
          <span className="flex items-center gap-1.5 text-gray-200">
            <TerminalIcon className="w-3.5 h-3.5 text-blue-400" />
            project@{projectId}:~$
          </span>
          <span className="text-[10px] text-gray-500">
            ({connectionStatus})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setReconnectKey((k) => k + 1)}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-[#131e36] border border-[#1e293b] hover:border-gray-500 transition-colors"
            title="Reconnect terminal session"
          >
            <RefreshCw className="w-3 h-3" /> Reconnect
          </button>
          <div className="text-[11px] text-gray-500 hidden sm:block">Connected Project Execution &bull; Target Server Environment</div>
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 w-full h-full pt-1" />
    </div>
  );
}
