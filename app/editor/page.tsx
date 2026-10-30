'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  FileCode,
  FileText,
  Save,
  Terminal as TerminalIcon,
  X,
  RefreshCw,
  Trash2,
  Check,
  FolderGit2,
  Plus,
  Server,
  ChevronRight,
  ChevronDown,
  FoldHorizontal,
  UnfoldHorizontal,
  Image as ImageIcon,
} from 'lucide-react';
import TerminalView from '@/components/terminal/TerminalView';

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

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'svg', 'ico', 'gif', 'webp'].includes(ext || '')) {
    return <ImageIcon className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
  }
  if (['ts', 'tsx'].includes(ext || '')) {
    return <FileCode className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
  }
  if (['js', 'jsx', 'mjs'].includes(ext || '')) {
    return <FileCode className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />;
  }
  if (['json'].includes(ext || '')) {
    return <FileText className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />;
  }
  if (['css', 'scss'].includes(ext || '')) {
    return <FileCode className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />;
  }
  if (['html'].includes(ext || '')) {
    return <FileCode className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />;
  }
  return <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
}

export default function EditorPage() {
  const [projectId, setProjectId] = useState('diet-ghazipur');
  const [projects, setProjects] = useState<any[]>([]);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // VS Code collapsible folder state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'client']));

  // Connect Project Modal
  const [connectModal, setConnectModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    path: '/var/www/',
    repoUrl: '',
    branch: 'main',
    runtime: 'Node.js',
    buildCommand: 'npm run build',
    restartCommand: 'systemctl restart ',
  });

  // Create Item Modal
  const [createItemModal, setCreateItemModal] = useState<{ open: boolean; isDirectory: boolean } | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // Terminal
  const [terminalHeight, setTerminalHeight] = useState(240);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const isDragging = useRef(false);

  const loadFiles = async (pId: string) => {
    try {
      const res = await fetch(`/api/files?projectId=${encodeURIComponent(pId)}`);
      const data = await res.json();
      if (data.files) {
        setFileTree(data.files);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
        const diet = data.projects.find((p: any) => p.id === 'diet-ghazipur');
        const active = diet ? diet.id : (data.projects[0]?.id || 'diet-ghazipur');
        setProjectId(active);
        loadFiles(active);
      }
    } catch {}
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const collapseAllFolders = () => {
    setExpandedFolders(new Set());
  };

  const expandAllFolders = () => {
    const allPaths: string[] = [];
    const traverse = (items: any[]) => {
      for (const item of items) {
        if (item.type === 'directory') {
          allPaths.push(item.path);
          if (item.children) traverse(item.children);
        }
      }
    };
    traverse(fileTree);
    setExpandedFolders(new Set(allPaths));
  };

  const handleOpenFile = async (path: string, name: string) => {
    const existing = openTabs.find((t) => t.path === path);
    if (existing) {
      setActiveTabPath(path);
      return;
    }

    try {
      const res = await fetch(`/api/files?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`);
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
          projectId,
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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createItemModal || !newItemName.trim()) return;

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          path: newItemName.trim(),
          isDirectory: createItemModal.isDirectory,
        }),
      });
      if (res.ok) {
        setCreateItemModal(null);
        setNewItemName('');
        loadFiles(projectId);
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
        body: JSON.stringify({ projectId, path: itemPath }),
      });
      if (res.ok) {
        setOpenTabs((prev) => prev.filter((t) => t.path !== itemPath));
        if (activeTabPath === itemPath) setActiveTabPath(null);
        loadFiles(projectId);
      }
    } catch {
      alert('Delete failed');
    }
  };

  const handleConnectProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProject,
          type: 'connected',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConnectModal(false);
        setNewProject({
          name: '',
          path: '/var/www/',
          repoUrl: '',
          branch: 'main',
          runtime: 'Node.js',
          buildCommand: 'npm run build',
          restartCommand: 'systemctl restart ',
        });
        fetchProjects();
        if (data.project) {
          setProjectId(data.project.id);
          loadFiles(data.project.id);
        }
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const currentProjectObj = projects.find((p) => p.id === projectId);
  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  // VS Code recursive tree renderer with collapsible folder state
  const renderTreeNode = (node: any, depth = 0) => {
    const isDir = node.type === 'directory';
    const isExpanded = expandedFolders.has(node.path);

    return (
      <div key={node.path} className="select-none">
        <div
          onClick={(e) => {
            if (isDir) {
              toggleFolder(node.path, e);
            } else {
              handleOpenFile(node.path, node.name);
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={`flex items-center justify-between pr-2 py-1 rounded text-xs cursor-pointer group transition-colors ${
            activeTabPath === node.path
              ? 'bg-[#1e293b] text-blue-400 font-medium'
              : 'text-gray-300 hover:bg-[#131e36] hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-1.5 truncate">
            {isDir ? (
              <>
                <span className="p-0.5 text-gray-400 hover:text-white">
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  )}
                </span>
                {isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                )}
              </>
            ) : (
              <>
                <span className="w-3" />
                {getFileIcon(node.name)}
              </>
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

        {isDir && isExpanded && node.children && (
          <div>
            {node.children.length === 0 ? (
              <div
                style={{ paddingLeft: `${(depth + 1) * 14 + 20}px` }}
                className="py-0.5 text-[11px] text-gray-500 italic"
              >
                (empty folder)
              </div>
            ) : (
              node.children.map((child: any) => renderTreeNode(child, depth + 1))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-[#090d16]">
      {/* Top Editor Control Bar */}
      <div className="h-11 border-b border-[#1e293b] bg-[#0d1322] flex items-center justify-between px-4">
        {/* Project Selector & Connect Button */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-mono">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>Target Project:</span>
          </div>

          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setOpenTabs([]);
              setActiveTabPath(null);
              loadFiles(e.target.value);
            }}
            className="bg-[#090d16] border border-[#1e293b] text-xs text-gray-200 rounded px-2.5 py-1 focus:outline-none font-medium"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                ● {p.name} ({p.path})
              </option>
            ))}
          </select>

          <button
            onClick={() => setConnectModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect Project
          </button>

          {currentProjectObj && (
            <span className="hidden xl:inline-block text-[11px] text-gray-400 font-mono bg-[#090d16] px-2 py-0.5 rounded border border-[#1e293b]">
              Path: {currentProjectObj.path}
            </span>
          )}
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
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab?.isDirty
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                : 'bg-[#1e293b] text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save (Ctrl+S)</span>
          </button>
          <button
            onClick={() => setTerminalOpen(!terminalOpen)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs border transition-colors ${
              terminalOpen
                ? 'bg-[#1e293b] text-blue-400 border-blue-500/30'
                : 'bg-[#090d16] text-gray-400 border-[#1e293b]'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: File Tree */}
        <div className="w-64 border-r border-[#1e293b] bg-[#0a0e1a] flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e293b] text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span className="truncate">{currentProjectObj?.name || 'Explorer'}</span>
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
                onClick={collapseAllFolders}
                className="p-1 hover:text-white text-gray-400 rounded hover:bg-[#1e293b]"
                title="Collapse All Folders"
              >
                <FoldHorizontal className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={expandAllFolders}
                className="p-1 hover:text-white text-gray-400 rounded hover:bg-[#1e293b]"
                title="Expand All Folders"
              >
                <UnfoldHorizontal className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => loadFiles(projectId)}
                className="p-1 hover:text-white text-gray-400 rounded hover:bg-[#1e293b]"
                title="Refresh Files"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {fileTree.length === 0 ? (
              <div className="text-xs text-gray-500 p-3 text-center">
                Directory empty or loading files for {currentProjectObj?.name}...
              </div>
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
                  className={`flex items-center space-x-2 px-3 h-full border-r border-[#1e293b] text-xs cursor-pointer select-none group transition-colors ${
                    isActive ? 'bg-[#090d16] text-blue-400 font-medium' : 'text-gray-400 hover:bg-[#131e36]'
                  }`}
                >
                  {getFileIcon(tab.name)}
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
                <p>Editing Target: <span className="text-white font-mono">{currentProjectObj?.path || projectId}</span></p>
                <p className="text-xs text-gray-600 mt-1">Select a file from the explorer to view or edit code directly on the server.</p>
              </div>
            )}
          </div>

          {/* Bottom Resizable Terminal targeting the Connected Project */}
          {terminalOpen && (
            <div
              style={{ height: `${terminalHeight}px` }}
              className="border-t border-[#1e293b] relative flex flex-col bg-[#090d16]"
            >
              <div
                onMouseDown={handleMouseDown}
                className="h-1.5 w-full bg-[#1e293b] hover:bg-blue-500 cursor-ns-resize transition-colors flex items-center justify-center"
              >
                <div className="w-8 h-0.5 bg-gray-500 rounded" />
              </div>
              <div className="flex-1 overflow-hidden">
                <TerminalView projectId={projectId} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connect Project Modal */}
      {connectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleConnectProject}
            className="w-full max-w-lg bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-emerald-400" />
                Connect Existing Server Project
              </h3>
              <button
                type="button"
                onClick={() => setConnectModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Project Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Diet Ghazipur"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-medium"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Directory Path on Server</label>
              <input
                type="text"
                required
                placeholder="e.g. /var/www/diet-website"
                value={newProject.path}
                onChange={(e) => setNewProject({ ...newProject, path: e.target.value })}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-mono"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                DevPanel will directly manage this directory without re-cloning over it.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Git Repository URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://github.com/..."
                  value={newProject.repoUrl}
                  onChange={(e) => setNewProject({ ...newProject, repoUrl: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Branch</label>
                <input
                  type="text"
                  value={newProject.branch}
                  onChange={(e) => setNewProject({ ...newProject, branch: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Build Command</label>
                <input
                  type="text"
                  placeholder="npm run build"
                  value={newProject.buildCommand}
                  onChange={(e) => setNewProject({ ...newProject, buildCommand: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Restart Command</label>
                <input
                  type="text"
                  placeholder="systemctl restart diet-website"
                  value={newProject.restartCommand}
                  onChange={(e) => setNewProject({ ...newProject, restartCommand: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={() => setConnectModal(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
              >
                Connect Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New File / Folder Modal */}
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
