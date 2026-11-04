'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  Terminal as TerminalIcon,
  Plus,
  Trash2,
  RefreshCw,
  Maximize2,
  Minimize2,
  X,
  Eraser,
  RotateCw,
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

export interface TabHandle {
  clear: () => void;
  restart: () => void;
  kill: () => void;
  reconnect: () => void;
}

interface TabInstanceProps {
  tabId: string;
  projectId: string;
  isActive: boolean;
  onStatusChange: (tabId: string, status: 'connecting' | 'connected' | 'disconnected') => void;
}

const TerminalTabInstance = forwardRef<TabHandle, TabInstanceProps>(function TerminalTabInstance(
  { tabId, projectId, isActive, onStatusChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isKilledRef = useRef<boolean>(false);

  const safeFit = () => {
    try {
      if (fitAddonRef.current && termRef.current && containerRef.current) {
        fitAddonRef.current.fit();
        if (termRef.current.cols && termRef.current.rows && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'resize',
              cols: termRef.current.cols,
              rows: termRef.current.rows,
            })
          );
        }
      }
    } catch {}
  };

  const connectWs = (term: any) => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }

    onStatusChange(tabId, 'connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/terminal?projectId=${encodeURIComponent(
      projectId
    )}&tabId=${encodeURIComponent(tabId)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      onStatusChange(tabId, 'connected');
      safeFit();
      try { term.focus(); } catch {}
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      onStatusChange(tabId, 'disconnected');
      if (!isKilledRef.current) {
        term.write('\r\n\x1b[90m[Terminal disconnected - click Reconnect to resume session]\x1b[0m\r\n');
      }
    };

    ws.onerror = () => {
      onStatusChange(tabId, 'disconnected');
      term.write('\r\n\x1b[31m[WebSocket connection error - verify server port & permissions]\x1b[0m\r\n');
    };
  };

  useImperativeHandle(ref, () => ({
    clear: () => {
      try {
        termRef.current?.clear();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'clear' }));
        }
      } catch {}
    },
    restart: () => {
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'restart' }));
        } else if (termRef.current) {
          connectWs(termRef.current);
        }
      } catch {}
    },
    kill: () => {
      isKilledRef.current = true;
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'kill' }));
        }
      } catch {}
      try { wsRef.current?.close(); } catch {}
      try { termRef.current?.dispose(); } catch {}
    },
    reconnect: () => {
      if (termRef.current) {
        connectWs(termRef.current);
      }
    },
  }));

  // Initialize terminal once when tab mounts
  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!containerRef.current) return;

      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      if (!mounted || !containerRef.current) return;

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
        scrollback: 10000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      containerRef.current.innerHTML = '';
      term.open(containerRef.current);

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Click anywhere to focus terminal
      containerRef.current.onclick = () => {
        try { term.focus(); } catch {}
      };

      // Intercept terminal shortcuts (Windows & VS Code style):
      // - Ctrl+C (when text is highlighted) OR Ctrl+Shift+C: Copies text to clipboard
      // - Ctrl+C (when NO text is highlighted): Sends SIGINT interrupt to shell
      // - Ctrl+V OR Ctrl+Shift+V: Pastes clipboard text directly into terminal
      term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        if (event.type !== 'keydown') return true;

        const isCtrlOrCmd = event.ctrlKey || event.metaKey;

        // 1. Copy: Ctrl+C (with text selected) OR Ctrl+Shift+C
        if (
          (isCtrlOrCmd && event.shiftKey && (event.key === 'c' || event.key === 'C')) ||
          (isCtrlOrCmd && !event.shiftKey && (event.key === 'c' || event.key === 'C') && term.hasSelection())
        ) {
          const selection = term.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection).catch(() => {});
            term.clearSelection();
          }
          event.preventDefault();
          event.stopPropagation();
          return false;
        }

        // 2. Paste: Ctrl+V OR Ctrl+Shift+V (Windows natural paste)
        if (
          (isCtrlOrCmd && event.shiftKey && (event.key === 'v' || event.key === 'V')) ||
          (isCtrlOrCmd && !event.shiftKey && (event.key === 'v' || event.key === 'V'))
        ) {
          navigator.clipboard
            .readText()
            .then((clipText) => {
              if (clipText && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(clipText);
              }
            })
            .catch(() => {});
          // Do not fully cancel if browser needs native paste fallback
          event.preventDefault();
          event.stopPropagation();
          return false;
        }

        return true;
      });

      // Native DOM Paste Event Listener (Guarantees Ctrl+V works even if navigator.clipboard.readText is gated by browser)
      const handleNativePaste = (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text');
        if (text && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(text);
          e.preventDefault();
        }
      };
      containerRef.current.addEventListener('paste', handleNativePaste);

      // Windows Terminal / CMD Right-Click Behavior:
      // - If text is highlighted: Right-click copies text and clears selection
      // - If no text highlighted: Right-click pastes from clipboard
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        if (term.hasSelection()) {
          const selection = term.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection).catch(() => {});
            term.clearSelection();
          }
        } else {
          navigator.clipboard
            .readText()
            .then((text) => {
              if (text && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(text);
              }
            })
            .catch(() => {});
        }
      };
      containerRef.current.addEventListener('contextmenu', handleContextMenu);

      term.onData((data: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(data);
        }
      });

      connectWs(term);

      // Auto fit
      setTimeout(() => {
        if (mounted) safeFit();
      }, 50);

      const resizeObserver = new ResizeObserver(() => {
        if (mounted) safeFit();
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
        try {
          containerRef.current?.removeEventListener('paste', handleNativePaste);
          containerRef.current?.removeEventListener('contextmenu', handleContextMenu);
        } catch {}
      };
    }

    init();

    return () => {
      mounted = false;
      // When unmounting (e.g. terminal closed or tab changed), DO NOT send kill to backend!
      // Simply close WebSocket connection so process continues in background.
      try { wsRef.current?.close(); } catch {}
      try { termRef.current?.dispose(); } catch {}
    };
  }, [projectId, tabId]);

  // When tab becomes active, trigger fit and focus
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        safeFit();
        try { termRef.current?.focus(); } catch {}
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{
        display: isActive ? 'block' : 'none',
        minHeight: '100%',
        height: '100%',
        width: '100%',
      }}
    />
  );
});

export default function TerminalView({
  projectId,
  onClose,
  isMaximized,
  onToggleMaximize,
}: TerminalViewProps) {
  const tabsStorageKey = `devpanel_term_tabs_${projectId}`;
  const activeTabStorageKey = `devpanel_term_active_${projectId}`;

  const [tabs, setTabs] = useState<TerminalTab[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(tabsStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [{ id: '1', name: 'Terminal 1' }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(activeTabStorageKey);
        if (stored) return stored;
      } catch {}
    }
    return '1';
  });

  const [tabStatuses, setTabStatuses] = useState<{
    [tabId: string]: 'connecting' | 'connected' | 'disconnected';
  }>({});

  const tabRefs = useRef<{ [tabId: string]: TabHandle | null }>({});

  // Ensure activeTabId always points to a valid tab
  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTabId)) {
      if (tabs.length > 0) {
        setActiveTabId(tabs[0].id);
      }
    }
  }, [tabs, activeTabId]);

  // Persist tabs
  useEffect(() => {
    try {
      localStorage.setItem(tabsStorageKey, JSON.stringify(tabs));
    } catch {}
  }, [tabs, tabsStorageKey]);

  // Persist active tab
  useEffect(() => {
    try {
      localStorage.setItem(activeTabStorageKey, activeTabId);
    } catch {}
  }, [activeTabId, activeTabStorageKey]);

  const handleAddNewTab = () => {
    const newId = `${Date.now()}`;
    const nextIndex = tabs.length + 1;
    const newTab = { id: newId, name: `Terminal ${nextIndex}` };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleKillActiveTab = () => {
    const handle = tabRefs.current[activeTabId];
    if (handle) {
      handle.kill();
      delete tabRefs.current[activeTabId];
    }

    if (tabs.length <= 1) {
      const freshId = `${Date.now()}`;
      setTabs([{ id: freshId, name: 'Terminal 1' }]);
      setActiveTabId(freshId);
    } else {
      const remaining = tabs.filter((t) => t.id !== activeTabId);
      setTabs(remaining);
      setActiveTabId(remaining[remaining.length - 1].id);
    }
  };

  const handleClear = () => {
    tabRefs.current[activeTabId]?.clear();
  };

  const handleRestart = () => {
    tabRefs.current[activeTabId]?.restart();
  };

  const handleReconnect = () => {
    tabRefs.current[activeTabId]?.reconnect();
  };

  const activeStatus = tabStatuses[activeTabId] || 'connecting';

  return (
    <div className="w-full h-full bg-[#090d16] flex flex-col overflow-hidden select-none">
      {/* VS Code Style Header Bar */}
      <div className="h-9 min-h-[36px] bg-[#0d1322] border-b border-[#1e293b] flex items-center justify-between px-2 text-xs">
        {/* Left: Terminal Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto max-w-[65%]">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const status = tabStatuses[tab.id] || 'connecting';
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
                      status === 'connected'
                        ? 'bg-emerald-400'
                        : status === 'connecting'
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

        {/* Right Action Tools: Reconnect, Clear, Restart, Kill, Maximize, Close */}
        <div className="flex items-center space-x-1 shrink-0 text-gray-400">
          {activeStatus === 'disconnected' && (
            <button
              onClick={handleReconnect}
              className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 transition-colors flex items-center gap-1 text-[11px] border border-blue-500/30"
              title="Reconnect Terminal Session"
            >
              <RotateCw className="w-3 h-3" />
              <span>Reconnect</span>
            </button>
          )}

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
        {tabs.map((tab) => (
          <TerminalTabInstance
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            tabId={tab.id}
            projectId={projectId}
            isActive={tab.id === activeTabId}
            onStatusChange={(id, status) => {
              setTabStatuses((prev) => ({ ...prev, [id]: status }));
            }}
          />
        ))}
      </div>
    </div>
  );
}
