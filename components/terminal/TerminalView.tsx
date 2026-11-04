'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Terminal as TerminalIcon,
  Plus,
  Trash2,
  RefreshCw,
  Maximize2,
  Minimize2,
  X,
  Eraser,
  ChevronDown,
} from 'lucide-react';

interface TerminalTab {
  id: string;
  name: string;
}

interface TerminalViewProps {
  projectId: string;
  onClose?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export default function TerminalView({
  projectId,
  onClose,
  isMaximized,
  onToggleMaximize,
}: TerminalViewProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: '1', name: 'Terminal 1' },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('1');

  // Ref per tab: { [tabId]: { container, term, fitAddon, ws, status } }
  const sessionsRef = useRef<{
    [tabId: string]: {
      container?: HTMLDivElement | null;
      term?: any;
      fitAddon?: any;
      ws?: WebSocket | null;
      status: 'connecting' | 'connected' | 'disconnected';
    };
  }>({});

  const [, setRenderTrigger] = useState(0);

  // Initialize a session for activeTabId
  useEffect(() => {
    let mounted = true;
    const tabId = activeTabId;

    if (!sessionsRef.current[tabId]) {
      sessionsRef.current[tabId] = { status: 'connecting' };
    }

    async function initSession() {
      const session = sessionsRef.current[tabId];
      if (!session || !session.container) return;

      // Clean up previous terminal if any for this tab
      if (session.term) {
        try { session.term.dispose(); } catch {}
      }
      if (session.ws) {
        try { session.ws.close(); } catch {}
      }

      session.status = 'connecting';
      setRenderTrigger((r) => r + 1);

      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      if (!mounted) return;

      const term = new Terminal({
        theme: {
          background: '#090d16',
          foreground: '#f1f5f9',
          cursor: '#38bdf8',
          cursorAccent: '#090d16',
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
        cursorStyle: 'block',
        convertEol: true,
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      session.container.innerHTML = '';
      term.open(session.container);

      session.term = term;
      session.fitAddon = fitAddon;

      // Click to focus
      session.container.onclick = () => {
        try { term.focus(); } catch {}
      };

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/terminal?projectId=${encodeURIComponent(
        projectId
      )}&tabId=${tabId}`;
      const ws = new WebSocket(wsUrl);
      session.ws = ws;

      const safeFit = () => {
        try {
          fitAddon.fit();
          if (term.cols && term.rows && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
          }
        } catch {}
      };

      // Auto fit on mount
      setTimeout(() => {
        safeFit();
        try { term.focus(); } catch {}
      }, 50);

      // Robust ResizeObserver: guarantees xterm automatically fills 100% of newly dragged height & width
      const resizeObserver = new ResizeObserver(() => {
        safeFit();
      });
      resizeObserver.observe(session.container);

      ws.onopen = () => {
        if (!mounted) return;
        session.status = 'connected';
        setRenderTrigger((r) => r + 1);
        safeFit();
        try { term.focus(); } catch {}
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onclose = () => {
        if (!mounted) return;
        session.status = 'disconnected';
        setRenderTrigger((r) => r + 1);
        term.write('\r\n\x1b[90m[Terminal process exited / disconnected]\x1b[0m\r\n');
      };

      ws.onerror = () => {
        if (!mounted) return;
        session.status = 'disconnected';
        setRenderTrigger((r) => r + 1);
        term.write('\r\n\x1b[31m[WebSocket connection error - verify port & permissions]\x1b[0m\r\n');
      };

      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    }

    initSession();

    return () => {
      mounted = false;
    };
  }, [projectId, activeTabId]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      Object.values(sessionsRef.current).forEach((session) => {
        try { session.ws?.send(JSON.stringify({ type: 'kill' })); } catch {}
        try { session.ws?.close(); } catch {}
        try { session.term?.dispose(); } catch {}
      });
    };
  }, []);

  const handleAddNewTab = () => {
    const newId = `${Date.now()}`;
    const newIndex = tabs.length + 1;
    const newTab = { id: newId, name: `Terminal ${newIndex}` };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleKillActiveTab = () => {
    const session = sessionsRef.current[activeTabId];
    if (session) {
      try {
        session.ws?.send(JSON.stringify({ type: 'kill' }));
      } catch {}
      try { session.ws?.close(); } catch {}
      try { session.term?.dispose(); } catch {}
      delete sessionsRef.current[activeTabId];
    }

    if (tabs.length === 1) {
      // Re-initialize single tab
      const newId = `${Date.now()}`;
      setTabs([{ id: newId, name: 'Terminal 1' }]);
      setActiveTabId(newId);
    } else {
      const remaining = tabs.filter((t) => t.id !== activeTabId);
      setTabs(remaining);
      setActiveTabId(remaining[remaining.length - 1].id);
    }
  };

  const handleClear = () => {
    const session = sessionsRef.current[activeTabId];
    if (session?.term) {
      try {
        session.term.clear();
      } catch {}
    }
  };

  const handleRestart = () => {
    const session = sessionsRef.current[activeTabId];
    if (session) {
      try { session.ws?.send(JSON.stringify({ type: 'kill' })); } catch {}
      try { session.ws?.close(); } catch {}
      try { session.term?.dispose(); } catch {}
      delete sessionsRef.current[activeTabId];
    }
    setRenderTrigger((r) => r + 1);
  };

  const activeSession = sessionsRef.current[activeTabId];
  const activeStatus = activeSession?.status || 'connecting';

  return (
    <div className="w-full h-full bg-[#090d16] flex flex-col overflow-hidden select-none">
      {/* VS Code Style Header Bar */}
      <div className="h-9 min-h-[36px] bg-[#0d1322] border-b border-[#1e293b] flex items-center justify-between px-2 text-xs">
        {/* Left: Terminal Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto max-w-[65%]">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded cursor-pointer transition-colors text-xs font-mono shrink-0 ${
                  isActive
                    ? 'bg-[#1e293b] text-white font-medium shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#131e36]'
                }`}
              >
                <TerminalIcon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
                <span>{tab.name}</span>
                {isActive && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeStatus === 'connected'
                        ? 'bg-emerald-400'
                        : activeStatus === 'connecting'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-rose-400'
                    }`}
                  />
                )}
              </div>
            );
          })}

          {/* Add New Terminal Tab Button */}
          <button
            onClick={handleAddNewTab}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1e293b] transition-colors"
            title="New Terminal Session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Action Tools: Clear, Restart, Kill, Maximize, Close */}
        <div className="flex items-center space-x-1 shrink-0 text-gray-400">
          <button
            onClick={handleClear}
            className="p-1 rounded hover:text-white hover:bg-[#1e293b] transition-colors flex items-center gap-1 text-[11px]"
            title="Clear Terminal Screen"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Clear</span>
          </button>

          <button
            onClick={handleRestart}
            className="p-1 rounded hover:text-white hover:bg-[#1e293b] transition-colors flex items-center gap-1 text-[11px]"
            title="Restart Terminal Session"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Restart</span>
          </button>

          <button
            onClick={handleKillActiveTab}
            className="p-1 rounded hover:text-rose-400 hover:bg-[#1e293b] transition-colors flex items-center gap-1 text-[11px]"
            title="Kill Active Terminal (Terminates process)"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden md:inline text-rose-400">Kill</span>
          </button>

          <div className="w-[1px] h-3.5 bg-[#1e293b] mx-1" />

          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              className="p-1 rounded hover:text-white hover:bg-[#1e293b] transition-colors"
              title={isMaximized ? 'Restore Terminal Size' : 'Maximize Terminal Panel'}
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:text-white hover:bg-[#1e293b] transition-colors"
              title="Close Terminal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Viewports Container */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-[#090d16] p-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              ref={(el) => {
                if (!sessionsRef.current[tab.id]) {
                  sessionsRef.current[tab.id] = { status: 'connecting' };
                }
                sessionsRef.current[tab.id].container = el;
              }}
              className={`w-full h-full ${isActive ? 'block' : 'hidden'}`}
              style={{ minHeight: '100%', height: '100%', width: '100%' }}
            />
          );
        })}
      </div>
    </div>
  );
}
