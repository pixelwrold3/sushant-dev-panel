'use client';

import React, { useEffect, useRef } from 'react';

interface TerminalViewProps {
  workspaceId: string;
}

export default function TerminalView({ workspaceId }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initTerminal() {
      if (!terminalRef.current) return;

      // Dynamically import xterm and fit addon
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      if (!mounted) return;

      // Clean existing
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

      // Connect to secure WebSocket terminal endpoint
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/terminal?workspaceId=${encodeURIComponent(workspaceId)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onclose = () => {
        term.write('\r\n\x1b[90m[Terminal disconnected]\x1b[0m\r\n');
      };

      ws.onerror = () => {
        term.write('\r\n\x1b[31m[WebSocket connection error]\x1b[0m\r\n');
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
  }, [workspaceId]);

  return (
    <div className="w-full h-full bg-[#090d16] p-2 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 bg-[#0d1322] border-b border-[#1e293b] text-xs text-gray-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>workspace@{workspaceId}:~$</span>
        </div>
        <div className="text-[11px] text-gray-500">Isolated Workspace Shell &bull; Host filesystem protected</div>
      </div>
      <div ref={terminalRef} className="flex-1 w-full h-full pt-1" />
    </div>
  );
}
