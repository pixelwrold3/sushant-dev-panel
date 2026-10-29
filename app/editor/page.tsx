'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Folder,
  FolderPlus,
  FilePlus,
  FileCode,
  FileText,
  Trash2,
  Edit2,
  Save,
  Terminal as TerminalIcon,
  X,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  GitBranch,
  Layers,
  Check,
} from 'lucide-react';
import TerminalView from '@/components/terminal/TerminalView';

// Dynamic import Monaco Editor so it doesn't break SSR
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface OpenTab {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'go':
      return 'go';
    case 'sql':
      return 'sql';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'c':
    case 'cpp':
      return 'cpp';
    default:
      return 'plaintext';
  }
}

export default function EditorPage() {
  const [workspaceId, setWorkspaceId] = useState('main-website');
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // New item modal states
  const [createItemModal, setCreateItemModal] = useState<{ open: boolean; isDirectory: boolean } | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // Terminal height & resizing
  const [terminalHeight, setTerminalHeight] = useState(240);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const isDragging = useRef(false);

  // Load workspaces and file tree
  const loadFiles = async (ws: string) => {
    try {
      const res = await fetch(`/api/files?workspaceId=${encodeURIComponent(ws)}`);
      const data = await res.json();
      if (data.files) {
        setFileTree(data.files);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => r.json())
      .then((d) => {
        if (d.workspaces) {
          setWorkspaces(d.workspaces);
          if (d.workspaces.length > 0) {
            setWorkspaceId(d.workspaces[0].id);
            loadFiles(d.workspaces[0].id);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Open a file
  const handleOpenFile = async (path: string, name: string) => {
    // Check if already open
    const existing = openTabs.find((t) => t.path === path);
    if (existing) {
      setActiveTabPath(path);
      return;
    }

    try {
      const res = await fetch(`/api/files?workspaceId=${encodeURIComponent(workspaceId)}&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.content !== undefined) {
        const newTab: OpenTab = {
          path,
          name,
          content: data.content,
          savedContent: data.content,
          isDirty: false,
        };
        setOpenTabs((prev) => [...prev, newTab]);
        setActiveTabPath(path);
      }
    } catch (err) {
      alert(`Error reading file: ${err}`);
    }
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = openTabs.filter((t) => t.path !== path);
    setOpenTabs(remaining);
    if (activeTabPath === path) {
      setActiveTabPath(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || !activeTabPath) return;
    setOpenTabs((prev) =>
      prev.map((t) => (t.path === activeTabPath ? { ...t, content: value, isDirty: value !== t.savedContent } : t))
    );
  };

  const handleSaveFile = async () => {
    const activeTab = openTabs.find((t) => t.path === activeTabPath);
    if (!activeTab) return;

    setSaveStatus('Saving...');
    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          path: activeTab.path,
          content: activeTab.content,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOpenTabs((prev) =>
          prev.map((t) => (t.path === activeTabPath ? { ...t, savedContent: t.content, isDirty: false } : t))
        );
        setSaveStatus('Saved!');
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        alert(`Failed to save: ${data.error}`);
        setSaveStatus(null);
      }
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
      setSaveStatus(null);
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabPath, openTabs]);

  // Terminal drag resize handler
  const handleMouseDown = () => {
    isDragging.current = true;
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight >= 120 && newHeight <= 600) {
        setTerminalHeight(newHeight);
      }
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Create new file / folder
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createItemModal || !newItemName.trim()) return;

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          path: newItemName.trim(),
          isDirectory: createItemModal.isDirectory,
        }),
      });
      if (res.ok) {
        setCreateItemModal(null);
        setNewItemName('');
        loadFiles(workspaceId);
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteItem = async (itemPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${itemPath}"?`)) return;

    try {
      const res = await fetch('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, path: itemPath }),
      });
      if (res.ok) {
        // Close if open tab
        setOpenTabs((prev) => prev.filter((t) => t.path !== itemPath));
        if (activeTabPath === itemPath) setActiveTabPath(null);
        loadFiles(workspaceId);
      }
    } catch (err) {
      alert('Delete failed');
    }
  };

  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  // Render tree node recursively
  const renderTreeNode = (node: any, depth = 0) => {
    const isDir = node.type === 'directory';

    return (
      <div key={node.path} style={{ paddingLeft: `${depth * 14}px` }}>
        <div
          onClick={() => {
            if (!isDir) handleOpenFile(node.path, node.name);
          }}
          className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer group transition-colors ${activeTabPath === node.path ? 'bg-[#1e293b] text-blue-400 font-medium' : 'text-gray-300 hover:bg-[#131e36]'
            }`}
        >
          <div className="flex items-center space-x-2 truncate">
            {isDir ? (
              <Folder className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>

          <button
            onClick={(e) => handleDeleteItem(node.path, e)}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-rose-400 p-0.5"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {isDir && node.children && node.children.map((child: any) => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-[#090d16]">
      {/* Top Editor Bar */}
      <div className="h-10 border-b border-[#1e293b] bg-[#0d1322] flex items-center justify-between px-4">
        {/* Workspace selector */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-mono">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Workspace:</span>
          </div>
          <select
            value={workspaceId}
            onChange={(e) => {
              setWorkspaceId(e.target.value);
              setOpenTabs([]);
              setActiveTabPath(null);
              loadFiles(e.target.value);
            }}
            className="bg-[#090d16] border border-[#1e293b] text-xs text-gray-200 rounded px-2.5 py-1 focus:outline-none"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.branch})
              </option>
            ))}
          </select>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {saveStatus && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
              <Check className="w-3 h-3" /> {saveStatus}
            </span>
          )}
          <button
            onClick={handleSaveFile}
            disabled={!activeTab || !activeTab.isDirty}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${activeTab?.isDirty
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-[#1e293b] text-gray-400 cursor-not-allowed'
              }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save (Ctrl+S)</span>
          </button>
          <button
            onClick={() => setTerminalOpen(!terminalOpen)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs border transition-colors ${terminalOpen
                ? 'bg-[#1e293b] text-blue-400 border-blue-500/30'
                : 'bg-[#090d16] text-gray-400 border-[#1e293b]'
              }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>
        </div>
      </div>

      {/* Main workspace area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: File Tree */}
        <div className="w-64 border-r border-[#1e293b] bg-[#0a0e1a] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e293b] text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>Explorer</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCreateItemModal({ open: true, isDirectory: false })}
                className="p-1 hover:text-white text-gray-400 rounded hover:bg-[#1e293b]"
                title="New File"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCreateItemModal({ open: true, isDirectory: true })}
                className="p-1 hover:text-white text-gray-400 rounded hover:bg-[#1e293b]"
                title="New Folder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => loadFiles(workspaceId)}
                className="p-1 hover:text-white text-gray-400 rounded hover:bg-[#1e293b]"
                title="Refresh Files"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tree View */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {fileTree.length === 0 ? (
              <div className="text-xs text-gray-500 p-3 text-center">No files in workspace</div>
            ) : (
              fileTree.map((node) => renderTreeNode(node))
            )}
          </div>
        </div>

        {/* Center: Monaco Editor & Tabs */}
        <div className="flex-1 flex flex-col bg-[#090d16]">
          {/* Tabs bar */}
          <div className="flex items-center overflow-x-auto bg-[#0d1322] border-b border-[#1e293b] h-9">
            {openTabs.map((tab) => {
              const isActive = activeTabPath === tab.path;
              return (
                <div
                  key={tab.path}
                  onClick={() => setActiveTabPath(tab.path)}
                  className={`flex items-center space-x-2 px-3 h-full border-r border-[#1e293b] text-xs cursor-pointer select-none group transition-colors ${isActive ? 'bg-[#090d16] text-blue-400 font-medium' : 'text-gray-400 hover:bg-[#131e36]'
                    }`}
                >
                  <FileCode className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{tab.name}</span>
                  {tab.isDirty && <span className="w-2 h-2 rounded-full bg-blue-400" title="Unsaved changes" />}
                  <button
                    onClick={(e) => handleCloseTab(tab.path, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-white p-0.5 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Monaco Code Surface */}
          <div className="flex-1 relative overflow-hidden">
            {activeTab ? (
              <MonacoEditor
                height="100%"
                language={getLanguageFromPath(activeTab.path)}
                theme="vs-dark"
                value={activeTab.content}
                onChange={handleEditorChange}
                options={{
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, Menlo, monospace',
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm">
                <FileCode className="w-12 h-12 text-gray-600 mb-3" />
                <p>Select a file from the explorer or create a new file to start editing.</p>
                <div className="text-xs text-gray-600 mt-2 font-mono">
                  Press <kbd className="px-1.5 py-0.5 bg-[#1e293b] rounded text-gray-400">Ctrl+Shift+P</kbd> for commands
                </div>
              </div>
            )}
          </div>

          {/* Bottom Resizable Terminal */}
          {terminalOpen && (
            <div
              style={{ height: `${terminalHeight}px` }}
              className="border-t border-[#1e293b] relative flex flex-col bg-[#090d16]"
            >
              {/* Drag Handle */}
              <div
                onMouseDown={handleMouseDown}
                className="h-1.5 w-full bg-[#1e293b] hover:bg-blue-500 cursor-ns-resize transition-colors flex items-center justify-center"
              >
                <div className="w-8 h-0.5 bg-gray-500 rounded" />
              </div>
              <div className="flex-1 overflow-hidden">
                <TerminalView workspaceId={workspaceId} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New File/Folder Modal */}
      {createItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleCreateSubmit}
            className="w-full max-w-sm bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 shadow-2xl"
          >
            <h3 className="text-sm font-semibold text-white mb-3">
              Create New {createItemModal.isDirectory ? 'Folder' : 'File'}
            </h3>
            <input
              type="text"
              autoFocus
              placeholder={createItemModal.isDirectory ? 'e.g. components' : 'e.g. index.ts'}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
            />
            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setCreateItemModal(null)}
                className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

