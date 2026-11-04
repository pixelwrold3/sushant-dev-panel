'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  Save,
  Plus,
  Trash2,
  X,
  Check,
  Terminal as TerminalIcon,
  RefreshCw,
  FolderPlus,
  FilePlus,
  FolderGit2,
  Server,
  ChevronRight,
  ChevronDown,
  FoldHorizontal,
  UnfoldHorizontal,
  Image as ImageIcon,
  GitBranch,
  ArrowDown,
  ArrowUp,
  RotateCcw,
  RotateCw,
  History,
  Shield,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Edit2,
  ArrowLeft,
  MoreHorizontal,
  Layers,
  Database,
  Scissors,
  Copy,
  ClipboardPaste,
  Download,
  Archive,
  FileEdit,
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

// Indian Standard Time (IST - Asia/Kolkata) Formatter
function formatIST(dateStringOrIso: string | Date | undefined): string {
  if (!dateStringOrIso) return 'N/A';
  try {
    const date = new Date(dateStringOrIso);
    if (isNaN(date.getTime())) return String(dateStringOrIso);
    return (
      new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date) + ' IST'
    );
  } catch {
    return String(dateStringOrIso);
  }
}

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get('projectId') || searchParams.get('project');

  const [projectId, setProjectId] = useState<string>(queryProjectId || 'diet-ghazipur');
  const [projects, setProjects] = useState<any[]>([]);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // VS Code collapsible folder state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'client']));

  // Git state
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [pullHistory, setPullHistory] = useState<any[]>([]);
  const [gitModalOpen, setGitModalOpen] = useState(false);
  const [gitModalTab, setGitModalTab] = useState<'history' | 'commit' | 'branch' | 'diff'>('history');

  // Git Repo URL Modal
  const [repoUrlModalOpen, setRepoUrlModalOpen] = useState(false);
  const [editingRepoUrl, setEditingRepoUrl] = useState('');

  // Safe Pull Modal
  const [pullConfirmOpen, setPullConfirmOpen] = useState(false);
  const [protectEnv, setProtectEnv] = useState(true);

  // Undo / Redo confirmation modal
  const [undoRedoModal, setUndoRedoModal] = useState<{
    open: boolean;
    type: 'undo' | 'redo';
    pullId: string;
    commitHash?: string;
    description: string;
  } | null>(null);

  // Commit & Branch state
  const [commitMessage, setCommitMessage] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [expandedPullFiles, setExpandedPullFiles] = useState<Record<string, boolean>>({});
  const [diffView, setDiffView] = useState<{ open: boolean; file?: string; content: string }>({
    open: false,
    content: '',
  });

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Create Item Modal
  const [createItemModal, setCreateItemModal] = useState<{ open: boolean; isDirectory: boolean } | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // Terminal
  const [terminalHeight, setTerminalHeight] = useState(240);
  const [terminalOpen, setTerminalOpen] = useState(searchParams.get('focus') === 'terminal');
  const [terminalMaximized, setTerminalMaximized] = useState(false);
  const isDragging = useRef(false);

  // Recycle Bin / Trash states
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<any[]>([]);

  // File Explorer Right-Click Context Menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: any | null;
  } | null>(null);

  // File Clipboard (Cut / Copy / Paste)
  const [clipboard, setClipboard] = useState<{
    action: 'copy' | 'cut';
    path: string;
    name: string;
    isDir: boolean;
  } | null>(null);

  // Rename File/Folder Modal
  const [renameModal, setRenameModal] = useState<{
    open: boolean;
    oldPath: string;
    currentName: string;
  } | null>(null);
  const [renameNewName, setRenameNewName] = useState('');

  // VS Code Sidebar Resizing state (slide left/right to resize)
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isDraggingSidebar = useRef(false);

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebar.current = true;
    document.addEventListener('mousemove', handleSidebarMouseMove);
    document.addEventListener('mouseup', handleSidebarMouseUp);
  };

  const handleSidebarMouseMove = (e: MouseEvent) => {
    if (!isDraggingSidebar.current) return;
    const newWidth = Math.max(160, Math.min(e.clientX, 650));
    setSidebarWidth(newWidth);
  };

  const handleSidebarMouseUp = () => {
    isDraggingSidebar.current = false;
    document.removeEventListener('mousemove', handleSidebarMouseMove);
    document.removeEventListener('mouseup', handleSidebarMouseUp);
  };

  const loadTrashItems = async (pId: string) => {
    try {
      const res = await fetch(`/api/files/trash?projectId=${encodeURIComponent(pId)}`);
      if (res.ok) {
        const data = await res.json();
        setTrashItems(data.items || []);
      }
    } catch {}
  };

  const loadFiles = async (pId: string) => {
    try {
      const res = await fetch(`/api/files?projectId=${encodeURIComponent(pId)}`);
      const data = await res.json();
      if (data.files) {
        setFileTree(data.files);
      }
      loadTrashItems(pId);
    } catch (err) {
      console.error(err);
    }
  };

  // Close context menu on any global click
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const loadGitData = async (pId: string) => {
    try {
      const [statusRes, histRes] = await Promise.all([
        fetch(`/api/git/status?projectId=${encodeURIComponent(pId)}`),
        fetch('/api/git/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: pId, action: 'pull_history' }),
        }),
      ]);
      const statusData = await statusRes.json();
      const histData = await histRes.json();

      setGitStatus(statusData);
      if (histData?.history) {
        setPullHistory(histData.history);
      }
      if (statusData?.remoteUrl) {
        setEditingRepoUrl(statusData.remoteUrl);
      }
    } catch (err) {
      console.error('Git load error:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
        const targetId = queryProjectId || (data.projects.find((p: any) => p.id === 'diet-ghazipur') ? 'diet-ghazipur' : data.projects[0]?.id || 'diet-ghazipur');
        setProjectId(targetId);
        loadFiles(targetId);
        loadGitData(targetId);
      }
    } catch {}
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (queryProjectId && queryProjectId !== projectId) {
      setProjectId(queryProjectId);
      setOpenTabs([]);
      setActiveTabPath(null);
      loadFiles(queryProjectId);
      loadGitData(queryProjectId);
    }
  }, [queryProjectId]);

  // Terminal resizing
  const handleMouseDown = () => {
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const newHeight = window.innerHeight - e.clientY;
    if (newHeight > 100 && newHeight < window.innerHeight - 200) {
      setTerminalHeight(newHeight);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

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
    const allDirs = new Set<string>();
    const collectDirs = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          allDirs.add(node.path);
          if (node.children) collectDirs(node.children);
        }
      }
    };
    collectDirs(fileTree);
    setExpandedFolders(allDirs);
  };

  const handleOpenFile = async (filePath: string, fileName: string) => {
    const existing = openTabs.find((t) => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      return;
    }

    try {
      const res = await fetch(
        `/api/files?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(filePath)}`
      );
      const data = await res.json();
      if (data.content !== undefined) {
        const newTab: OpenTab = {
          path: filePath,
          name: fileName,
          content: data.content,
          savedContent: data.content,
          isDirty: false,
        };
        setOpenTabs((prev) => [...prev, newTab]);
        setActiveTabPath(filePath);
      }
    } catch (err) {
      alert('Failed to read file content');
    }
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tabToClose = openTabs.find((t) => t.path === path);
    if (tabToClose?.isDirty) {
      if (!confirm(`"${tabToClose.name}" has unsaved changes. Close anyway?`)) {
        return;
      }
    }
    const filtered = openTabs.filter((t) => t.path !== path);
    setOpenTabs(filtered);
    if (activeTabPath === path) {
      setActiveTabPath(filtered.length > 0 ? filtered[filtered.length - 1].path : null);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!activeTabPath || value === undefined) return;
    setOpenTabs((prev) =>
      prev.map((t) => {
        if (t.path === activeTabPath) {
          return {
            ...t,
            content: value,
            isDirty: value !== t.savedContent,
          };
        }
        return t;
      })
    );
  };

  const handleSaveFile = async () => {
    const tab = openTabs.find((t) => t.path === activeTabPath);
    if (!tab) return;

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          path: tab.path,
          content: tab.content,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOpenTabs((prev) =>
          prev.map((t) => (t.path === tab.path ? { ...t, savedContent: t.content, isDirty: false } : t))
        );
        setSaveStatus('Saved!');
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabPath, openTabs, projectId]);

  // Move item to Recycle Bin
  const handleMoveToTrash = async (filePath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Move "${filePath}" to Recycle Bin? (You can restore it anytime)`)) return;

    try {
      const res = await fetch('/api/files/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'trash',
          path: filePath,
        }),
      });
      if (res.ok) {
        setOpenTabs((prev) => prev.filter((t) => !t.path.startsWith(filePath)));
        if (activeTabPath?.startsWith(filePath)) setActiveTabPath(null);
        loadFiles(projectId);
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to move to Recycle Bin');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRestoreFromTrash = async (trashId: string) => {
    try {
      const res = await fetch('/api/files/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'restore',
          trashId,
        }),
      });
      if (res.ok) {
        loadTrashItems(projectId);
        loadFiles(projectId);
      } else {
        const d = await res.json();
        alert(d.error || 'Restore failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePermanent = async (trashId: string) => {
    if (!confirm('Permanently delete this item? This CANNOT be restored!')) return;
    try {
      const res = await fetch('/api/files/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'delete_permanent',
          trashId,
        }),
      });
      if (res.ok) {
        loadTrashItems(projectId);
      } else {
        const d = await res.json();
        alert(d.error || 'Permanent delete failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEmptyRecycleBin = async () => {
    if (!confirm('Are you sure you want to permanently delete ALL items in the Recycle Bin?')) return;
    try {
      const res = await fetch('/api/files/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'empty',
        }),
      });
      if (res.ok) {
        loadTrashItems(projectId);
      } else {
        const d = await res.json();
        alert(d.error || 'Empty bin failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Right-Click Context Menu Trigger
  const handleContextMenu = (e: React.MouseEvent, node: any | null) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 190;
    const menuHeight = 260;
    const x = e.clientX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : e.clientX;
    const y = e.clientY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : e.clientY;
    setContextMenu({ x, y, node });
  };

  // Paste Action
  const handlePaste = async (targetFolder: string) => {
    if (!clipboard) return;

    try {
      const destPath = targetFolder ? `${targetFolder}/${clipboard.name}` : clipboard.name;
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: clipboard.action === 'copy' ? 'copy' : 'move',
          srcPath: clipboard.path,
          destPath,
        }),
      });

      if (res.ok) {
        if (clipboard.action === 'cut') {
          setClipboard(null);
        }
        loadFiles(projectId);
      } else {
        const d = await res.json();
        alert(d.error || 'Paste failed');
      }
    } catch (err: any) {
      alert(`Paste error: ${err.message}`);
    }
  };

  // Download File Action
  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      const res = await fetch(
        `/api/files?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(filePath)}`
      );
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([data.content || ''], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  // Rename Action
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameModal || !renameNewName.trim()) return;

    const parentDir = renameModal.oldPath.includes('/')
      ? renameModal.oldPath.substring(0, renameModal.oldPath.lastIndexOf('/'))
      : '';
    const newPath = parentDir ? `${parentDir}/${renameNewName.trim()}` : renameNewName.trim();

    try {
      const res = await fetch('/api/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          oldPath: renameModal.oldPath,
          newPath,
        }),
      });

      if (res.ok) {
        setOpenTabs((prev) =>
          prev.map((t) =>
            t.path === renameModal.oldPath
              ? { ...t, path: newPath, name: renameNewName.trim() }
              : t
          )
        );
        if (activeTabPath === renameModal.oldPath) {
          setActiveTabPath(newPath);
        }
        setRenameModal(null);
        setRenameNewName('');
        loadFiles(projectId);
      } else {
        const d = await res.json();
        alert(d.error || 'Rename failed');
      }
    } catch (err: any) {
      alert(`Rename error: ${err.message}`);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !createItemModal) return;

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          path: newItemName,
          content: createItemModal.isDirectory ? undefined : '',
          isDirectory: createItemModal.isDirectory,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateItemModal(null);
        setNewItemName('');
        loadFiles(projectId);
        if (!createItemModal.isDirectory) {
          handleOpenFile(newItemName, newItemName.split('/').pop() || newItemName);
        }
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Save Git Repository URL
  const handleSaveRepoUrl = async () => {
    if (!editingRepoUrl.trim()) return;
    setActionMessage('Saving Git repository URL...');
    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'set_repo_url',
          repoUrl: editingRepoUrl.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage('Git repository URL saved permanently!');
        setRepoUrlModalOpen(false);
        loadGitData(projectId);
        fetchProjects();
      } else {
        alert(data.error || 'Failed to save repository URL');
      }
    } catch (err: any) {
      alert(err.message);
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Safe Git Pull Execution
  const handleExecutePull = async () => {
    setPullConfirmOpen(false);
    setActionMessage('Executing safe pull with .env protection...');
    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'pull',
          protectEnv,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage('Safe Git Pull succeeded! Reloading files...');
        loadFiles(projectId);
        loadGitData(projectId);
      } else {
        alert(data.error || 'Git pull failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
    setTimeout(() => setActionMessage(null), 4500);
  };

  // Undo or Redo Execution
  const handleExecuteUndoRedo = async () => {
    if (!undoRedoModal) return;
    const { type, pullId } = undoRedoModal;
    setUndoRedoModal(null);

    const action = type === 'undo' ? 'undo_pull' : 'redo_pull';
    setActionMessage(`Executing ${type === 'undo' ? 'Undo Rollback' : 'Redo Restore'}...`);

    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action,
          pullId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(
          type === 'undo'
            ? 'Pull Undone successfully! Code restored to pre-pull state.'
            : 'Pull Re-applied successfully! Pulled files restored.'
        );
        loadFiles(projectId);
        loadGitData(projectId);
      } else {
        alert(data.error || 'Failed to execute operation');
      }
    } catch (err: any) {
      alert(err.message);
    }
    setTimeout(() => setActionMessage(null), 4500);
  };

  // Git Commit Action
  const handleCommit = async (andPush = false) => {
    if (!commitMessage.trim()) return;
    setActionMessage(andPush ? 'Committing and pushing changes...' : 'Committing changes...');
    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'commit',
          message: commitMessage.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (andPush) {
          const pushRes = await fetch('/api/git/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, action: 'push' }),
          });
          const pushData = await pushRes.json();
          if (pushRes.ok) {
            setActionMessage('Changes committed and pushed successfully!');
          } else {
            alert(pushData.error || 'Push failed');
          }
        } else {
          setActionMessage('Changes committed successfully!');
        }
        setCommitMessage('');
        loadGitData(projectId);
      } else {
        alert(data.error || 'Commit failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
    setTimeout(() => setActionMessage(null), 4500);
  };

  const handleBranchAction = async (branchName: string, create = false) => {
    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'branch',
          branchName,
          createBranch: create,
        }),
      });
      if (res.ok) {
        setNewBranchName('');
        loadGitData(projectId);
        loadFiles(projectId);
      } else {
        const d = await res.json();
        alert(d.error || 'Branch switch failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleViewDiff = async (filePath?: string) => {
    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'diff', filePath }),
      });
      const data = await res.json();
      setDiffView({
        open: true,
        file: filePath || 'All Changes',
        content: data.diff || '(No diff or untracked changes)',
      });
    } catch (err) {
      alert('Failed to load diff');
    }
  };

  const currentProjectObj = projects.find((p) => p.id === projectId);
  const activeTab = openTabs.find((t) => t.path === activeTabPath);
  const repoUrl = gitStatus?.remoteUrl || currentProjectObj?.repoUrl || '';

  // Calculate Git stats
  const totalPulls = pullHistory.length;
  const undonePulls = pullHistory.filter((p) => p.status === 'undone').length;
  const activePulls = totalPulls - undonePulls;

  // VS Code recursive tree renderer
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
          onContextMenu={(e) => handleContextMenu(e, node)}
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
            onClick={(e) => handleMoveToTrash(node.path, e)}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-rose-400 p-0.5"
            title="Move to Recycle Bin"
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
      <div className="h-11 border-b border-[#1e293b] bg-[#0d1322] flex items-center justify-between px-3 gap-2">
        {/* Left: Back to Workspaces & Project Selector */}
        <div className="flex items-center space-x-2.5 overflow-x-auto">
          {/* Back to Workspaces Hub */}
          <button
            onClick={() => router.push('/workspaces')}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#090d16] hover:bg-[#1e293b] border border-[#1e293b] text-xs text-gray-300 hover:text-white transition-colors shrink-0"
            title="Back to Workspaces Directory"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-medium">Workspaces</span>
          </button>

          {/* Project Dropdown */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <select
              value={projectId}
              onChange={(e) => {
                const newId = e.target.value;
                setProjectId(newId);
                setOpenTabs([]);
                setActiveTabPath(null);
                loadFiles(newId);
                loadGitData(newId);
              }}
              className="bg-[#090d16] border border-[#1e293b] text-xs text-gray-200 rounded px-2.5 py-1 focus:outline-none font-medium"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  ● {p.name || p.id}
                </option>
              ))}
            </select>
          </div>

          {/* Git Remote URL Button / Display (User requested top Git link) */}
          <div className="flex items-center shrink-0">
            {repoUrl ? (
              <div className="flex items-center bg-[#090d16] border border-[#1e293b] rounded-md px-2 py-0.5 text-xs text-gray-300 gap-1.5 max-w-[280px]">
                <FolderGit2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline truncate text-[11px] font-mono"
                  title={`Connected Git Remote: ${repoUrl}`}
                >
                  {repoUrl.replace('https://github.com/', 'github:').replace('.git', '')}
                </a>
                <button
                  onClick={() => {
                    setEditingRepoUrl(repoUrl);
                    setRepoUrlModalOpen(true);
                  }}
                  className="text-gray-500 hover:text-gray-300 p-0.5"
                  title="Change Git Remote URL"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingRepoUrl('');
                  setRepoUrlModalOpen(true);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 text-xs transition-colors shrink-0 font-medium"
                title="Add and save Git repository link"
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>+ Git Link</span>
              </button>
            )}
          </div>

          {/* Quick Pull Git Button */}
          <button
            onClick={() => setPullConfirmOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#131e36] hover:bg-[#1e293b] border border-blue-500/30 text-xs text-blue-300 font-medium transition-colors shrink-0 shadow-sm"
            title="Safe Git Pull (with .env protection)"
          >
            <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
            <span>Pull Git</span>
          </button>

          {/* Git More Options & Undo/Redo Popup Button */}
          <button
            onClick={() => setGitModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#131e36] hover:bg-[#1e293b] border border-purple-500/30 text-xs text-purple-300 font-medium transition-colors shrink-0 shadow-sm"
            title="Git More Options (Undo, Redo, Commit, Branch & History)"
          >
            <History className="w-3.5 h-3.5 text-purple-400" />
            <span>Git Options</span>
            {undonePulls > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400" title={`${undonePulls} undone pull available`} />
            )}
          </button>
        </div>

        {/* Right Action Controls: Save & Terminal */}
        <div className="flex items-center space-x-2 shrink-0">
          {actionMessage && (
            <span className="text-xs text-blue-400 flex items-center gap-1 font-mono hidden md:inline">
              {actionMessage}
            </span>
          )}
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
        {/* Left Sidebar: VS Code Explorer with draggable resizer */}
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="border-r border-[#1e293b] bg-[#0a0e1a] flex flex-col relative shrink-0 select-none"
        >
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
                onClick={() => setRecycleBinOpen(true)}
                className="p-1 hover:text-white text-gray-400 rounded hover:bg-[#1e293b] relative"
                title="Recycle Bin (View and restore deleted files)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                {trashItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center">
                    {trashItems.length > 9 ? '9+' : trashItems.length}
                  </span>
                )}
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

          <div
            onContextMenu={(e) => handleContextMenu(e, null)}
            className="flex-1 overflow-y-auto p-1.5 space-y-0.5"
          >
            {fileTree.length === 0 ? (
              <div className="text-xs text-gray-500 p-3 text-center">
                Directory empty or loading files for {currentProjectObj?.name}...
              </div>
            ) : (
              fileTree.map((node) => renderTreeNode(node))
            )}
          </div>

          {/* Draggable vertical resize splitter handle (VS Code style slide left/right) */}
          <div
            onMouseDown={handleSidebarMouseDown}
            className="absolute top-0 right-[-3px] w-2 h-full cursor-col-resize hover:bg-blue-500/80 active:bg-blue-600 transition-colors z-20 group flex items-center justify-center"
            title="Drag to resize file explorer (VS Code style)"
          >
            <div className="w-[2px] h-8 bg-gray-600 group-hover:bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
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
                <p>
                  Target Workspace:{' '}
                  <span className="text-white font-mono">{currentProjectObj?.name || projectId}</span>
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Select a file from the explorer to view or edit code directly on the server.
                </p>
              </div>
            )}
          </div>

          {/* Bottom Resizable Terminal targeting the Connected Project */}
          {terminalOpen && (
            <div
              style={{ height: terminalMaximized ? '100%' : `${terminalHeight}px` }}
              className={`border-t border-[#1e293b] relative flex flex-col bg-[#090d16] ${
                terminalMaximized ? 'absolute inset-0 z-40' : ''
              }`}
            >
              {!terminalMaximized && (
                <div
                  onMouseDown={handleMouseDown}
                  className="h-1.5 w-full bg-[#1e293b] hover:bg-blue-500 cursor-ns-resize transition-colors flex items-center justify-center shrink-0"
                >
                  <div className="w-8 h-0.5 bg-gray-500 rounded" />
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <TerminalView
                  projectId={projectId}
                  onClose={() => setTerminalOpen(false)}
                  isMaximized={terminalMaximized}
                  onToggleMaximize={() => setTerminalMaximized(!terminalMaximized)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Git Remote Repository URL Modal */}
      {repoUrlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-blue-400" />
                Git Remote Repository URL
              </h3>
              <button onClick={() => setRepoUrlModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs text-gray-300 font-medium block mb-1">
                GitHub / Git Clone URL for {currentProjectObj?.name || projectId}:
              </label>
              <input
                type="text"
                placeholder="https://github.com/username/repository.git"
                value={editingRepoUrl}
                onChange={(e) => setEditingRepoUrl(e.target.value)}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-gray-400 mt-1.5">
                This link will be permanently saved for this workspace and always shown in the top bar.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={() => setRepoUrlModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#283548] text-gray-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRepoUrl}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
              >
                Save Repository Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Git Pull Confirmation Modal */}
      {pullConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-950/50 border border-blue-500/30 text-blue-400">
                <ArrowDown className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white">Confirm Safe Git Pull</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to pull latest remote changes into workspace{' '}
                  <strong className="text-emerald-400 font-mono">{currentProjectObj?.name || projectId}</strong>?
                </p>
              </div>
            </div>

            <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={protectEnv}
                  onChange={(e) => setProtectEnv(e.target.checked)}
                  className="mt-0.5 rounded bg-[#1e293b] border-gray-600 text-blue-600 focus:ring-0 focus:ring-offset-0"
                />
                <div className="flex-1">
                  <span className="font-medium text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Protect .env configuration files (Never overwrite with remote changes)
                  </span>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    DevPanel automatically saves local <code className="text-amber-300">.env</code> and{' '}
                    <code className="text-amber-300">.env.production</code> before pulling and restores them immediately.
                  </p>
                </div>
              </label>

              <div className="pt-2 border-t border-[#1e293b] flex items-center gap-2 text-emerald-300 text-[11px]">
                <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zero Database Touch: Website database (diet_ghazipur) is completely safe.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPullConfirmOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#1e293b] hover:bg-[#283548] text-gray-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePull}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <ArrowDown className="w-3.5 h-3.5" /> Execute Safe Pull
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo / Redo Confirmation Modal */}
      {undoRedoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0f172a] border border-amber-600/40 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-500/30 text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white">
                  Confirm {undoRedoModal.type === 'undo' ? 'Undo Rollback' : 'Redo Restore'}
                </h3>
                <p className="text-xs text-gray-300 mt-1">{undoRedoModal.description}</p>
              </div>
            </div>

            <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 space-y-2 text-xs text-gray-300 font-mono">
              <p>
                <strong>Target Commit Hash:</strong>{' '}
                <span className="text-amber-400">{undoRedoModal.commitHash?.slice(0, 7) || 'HEAD'}</span>
              </p>
              <p className="text-gray-400 text-[11px] font-sans">
                {undoRedoModal.type === 'undo'
                  ? 'All code files will be restored back to before the pull occurred. Your environment secrets (.env) and website database remain safe.'
                  : 'All files from that pull will be re-applied to the repository. Environment files (.env) are preserved.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUndoRedoModal(null)}
                className="px-4 py-2 rounded-lg bg-[#1e293b] hover:bg-[#283548] text-gray-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteUndoRedo}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                {undoRedoModal.type === 'undo' ? <RotateCcw className="w-3.5 h-3.5" /> : <RotateCw className="w-3.5 h-3.5" />}
                Confirm {undoRedoModal.type === 'undo' ? 'Undo Pull' : 'Redo (Restore Pull)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Git Options & Activity Modal (Popup for History, Undo, Redo, Commit, Branch) */}
      {gitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-4xl bg-[#0f172a] border border-[#1e293b] rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b] bg-[#0d1322]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-600/10 border border-purple-500/20 text-purple-400">
                  <FolderGit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    Git Source Control &amp; Activity
                    <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {currentProjectObj?.name || projectId}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Track pull history in Indian Time (IST), roll back pulls, re-apply undone files, and commit changes.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setGitModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#1e293b] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#1e293b] bg-[#0a0e1a]">
              <button
                onClick={() => setGitModalTab('history')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-medium transition-colors ${
                  gitModalTab === 'history'
                    ? 'border-purple-500 text-purple-300 bg-purple-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Pull Activity &amp; Undo/Redo ({totalPulls})
              </button>
              <button
                onClick={() => setGitModalTab('commit')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-medium transition-colors ${
                  gitModalTab === 'commit'
                    ? 'border-blue-500 text-blue-300 bg-blue-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                Commit Changes ({gitStatus?.files?.length || 0})
              </button>
              <button
                onClick={() => setGitModalTab('branch')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-medium transition-colors ${
                  gitModalTab === 'branch'
                    ? 'border-emerald-500 text-emerald-300 bg-emerald-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Branches ({gitStatus?.branches?.length || 1})
              </button>
            </div>

            {/* Modal Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* TAB 1: Pull History & Undo/Redo */}
              {gitModalTab === 'history' && (
                <div className="space-y-4">
                  {/* Stats Summary Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-[#090d16] border border-[#1e293b] rounded-xl p-3 text-center">
                      <span className="text-[11px] text-gray-400 uppercase tracking-wider block">Total Recorded Pulls</span>
                      <span className="text-xl font-bold text-white font-mono">{totalPulls}</span>
                    </div>
                    <div className="bg-[#090d16] border border-[#1e293b] rounded-xl p-3 text-center">
                      <span className="text-[11px] text-gray-400 uppercase tracking-wider block">Active Pulls</span>
                      <span className="text-xl font-bold text-emerald-400 font-mono">{activePulls}</span>
                    </div>
                    <div className="bg-[#090d16] border border-[#1e293b] rounded-xl p-3 text-center">
                      <span className="text-[11px] text-gray-400 uppercase tracking-wider block">Undone (Rolled Back)</span>
                      <span className="text-xl font-bold text-amber-400 font-mono">{undonePulls}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2">
                    <span className="font-medium text-gray-300">Recorded Pull Activities (Indian Time):</span>
                    <button
                      onClick={() => loadGitData(projectId)}
                      className="flex items-center gap-1 text-gray-400 hover:text-white"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>

                  <div className="divide-y divide-[#1e293b] border border-[#1e293b] rounded-xl bg-[#090d16] overflow-hidden">
                    {pullHistory.length === 0 ? (
                      <div className="py-12 text-center text-xs text-gray-500">
                        No pull activity recorded yet. Click "Pull Git" to safely sync code changes.
                      </div>
                    ) : (
                      pullHistory.map((pull) => {
                        const isUndone = pull.status === 'undone';
                        const isExpanded = !!expandedPullFiles[pull.id];
                        const hasFiles = pull.affectedFiles && pull.affectedFiles.length > 0;

                        return (
                          <div key={pull.id} className="p-4 space-y-2 hover:bg-[#0c1220] transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase ${
                                    isUndone
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  }`}
                                >
                                  {isUndone ? 'Undone / Reverted' : 'Active Pull'}
                                </span>

                                <span className="text-gray-200 font-mono text-xs">
                                  {pull.fromCommit ? pull.fromCommit.slice(0, 7) : 'HEAD'} &rarr;{' '}
                                  {pull.toCommit ? pull.toCommit.slice(0, 7) : 'HEAD'}
                                </span>

                                {pull.envProtected && (
                                  <span className="text-[10px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded flex items-center gap-1 border border-emerald-500/20">
                                    <ShieldCheck className="w-3 h-3" /> .env Safe
                                  </span>
                                )}
                              </div>

                              {/* Undo or Redo Action Buttons */}
                              <div className="flex items-center gap-2">
                                {isUndone ? (
                                  <button
                                    onClick={() =>
                                      setUndoRedoModal({
                                        open: true,
                                        type: 'redo',
                                        pullId: pull.id,
                                        commitHash: pull.toCommit,
                                        description: `Re-apply this pull and restore code files back to commit ${pull.toCommit.slice(0, 7)}?`,
                                      })
                                    }
                                    className="px-2.5 py-1 rounded bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/40 text-blue-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                    title="Re-apply this pull and bring back the pulled files"
                                  >
                                    <RotateCw className="w-3 h-3" /> Redo (Restore Pull)
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setUndoRedoModal({
                                        open: true,
                                        type: 'undo',
                                        pullId: pull.id,
                                        commitHash: pull.fromCommit,
                                        description: `Undo this pull and roll back code files to pre-pull commit ${pull.fromCommit.slice(0, 7)}?`,
                                      })
                                    }
                                    className="px-2.5 py-1 rounded bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                    title="Rollback repository files to before this pull"
                                  >
                                    <RotateCcw className="w-3 h-3" /> Undo This Pull
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Indian Standard Time (IST) Display */}
                            <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                              <span className="text-gray-400">
                                India Time:{' '}
                                <strong className="text-gray-300">{formatIST(pull.timestamp)}</strong> &bull; By{' '}
                                {pull.user || 'system'}
                              </span>

                              {hasFiles && (
                                <button
                                  onClick={() =>
                                    setExpandedPullFiles((prev) => ({ ...prev, [pull.id]: !prev[pull.id] }))
                                  }
                                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                >
                                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  {pull.affectedFiles.length} file{pull.affectedFiles.length === 1 ? '' : 's'} affected
                                </button>
                              )}
                            </div>

                            {/* Expandable Files List */}
                            {isExpanded && hasFiles && (
                              <div className="bg-[#070b14] p-3 rounded-lg border border-[#1e293b] font-mono text-[11px] space-y-1 text-gray-300 mt-2">
                                <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 font-semibold">
                                  Files Changed In This Pull:
                                </div>
                                {pull.affectedFiles.map((file: string, idx: number) => (
                                  <div key={idx} className="flex items-center gap-1.5 truncate">
                                    <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                                    <span className="truncate">{file}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Commit Changes */}
              {gitModalTab === 'commit' && (
                <div className="space-y-4">
                  <div className="bg-[#090d16] border border-[#1e293b] rounded-xl p-4 space-y-3">
                    <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
                      Commit Message
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Fix routing logic and update dashboard..."
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      className="w-full bg-[#0d1322] border border-[#1e293b] rounded-lg p-3 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCommit(false)}
                        disabled={!commitMessage.trim()}
                        className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
                      >
                        Commit Changes
                      </button>
                      <button
                        onClick={() => handleCommit(true)}
                        disabled={!commitMessage.trim()}
                        className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                        Commit &amp; Push
                      </button>
                    </div>
                  </div>

                  {/* Changed Files */}
                  <div className="bg-[#090d16] border border-[#1e293b] rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-300">
                        Working Tree Changes ({gitStatus?.files?.length || 0})
                      </span>
                      {gitStatus?.files?.length > 0 && (
                        <button
                          onClick={() => handleViewDiff()}
                          className="text-xs text-blue-400 hover:underline"
                        >
                          View Full Diff
                        </button>
                      )}
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-[#1e293b]">
                      {!gitStatus?.files || gitStatus.files.length === 0 ? (
                        <div className="py-6 text-center text-xs text-gray-500">Working tree clean. No changes.</div>
                      ) : (
                        gitStatus.files.map((f: any) => (
                          <div
                            key={f.path}
                            onClick={() => handleViewDiff(f.path)}
                            className="py-2 flex items-center justify-between text-xs hover:bg-[#131e36] px-2 rounded cursor-pointer font-mono"
                          >
                            <span className="text-gray-300 truncate">{f.path}</span>
                            <span className="text-[10px] text-amber-400 uppercase font-bold">{f.status}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Branches */}
              {gitModalTab === 'branch' && (
                <div className="space-y-4">
                  <div className="bg-[#090d16] border border-[#1e293b] rounded-xl p-4 space-y-3">
                    <div className="text-xs font-semibold text-gray-300">Current Branch</div>
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-emerald-400" />
                      <span className="px-2.5 py-1 rounded text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        {gitStatus?.currentBranch || 'main'}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-[#1e293b] space-y-2">
                      <label className="text-xs text-gray-400 block">Switch to existing branch:</label>
                      <select
                        value={gitStatus?.currentBranch || 'main'}
                        onChange={(e) => handleBranchAction(e.target.value)}
                        className="bg-[#0d1322] border border-[#1e293b] text-xs text-gray-200 rounded-lg px-3 py-2 w-full font-mono"
                      >
                        {(gitStatus?.branches || ['main']).map((b: string) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-3 border-t border-[#1e293b] space-y-2">
                      <label className="text-xs text-gray-400 block">Create and switch to new branch:</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="new-feature-branch"
                          value={newBranchName}
                          onChange={(e) => setNewBranchName(e.target.value)}
                          className="flex-1 bg-[#0d1322] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200 font-mono"
                        />
                        <button
                          onClick={() => handleBranchAction(newBranchName, true)}
                          disabled={!newBranchName.trim()}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium"
                        >
                          Create Branch
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diff Viewer Modal */}
      {diffView.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e293b]">
              <h3 className="text-sm font-semibold text-white">Diff: {diffView.file}</h3>
              <button
                onClick={() => setDiffView({ open: false, content: '' })}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded bg-[#1e293b]"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-[#090d16] font-mono text-xs">
              <pre className="text-gray-300 whitespace-pre-wrap">
                {diffView.content.split('\n').map((line, i) => {
                  let color = 'text-gray-400';
                  if (line.startsWith('+') && !line.startsWith('+++')) color = 'text-emerald-400 bg-emerald-950/20';
                  else if (line.startsWith('-') && !line.startsWith('---')) color = 'text-rose-400 bg-rose-950/20';
                  else if (line.startsWith('@@')) color = 'text-cyan-400';
                  return (
                    <div key={i} className={color}>
                      {line}
                    </div>
                  );
                })}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Right Click File Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[190px] bg-[#0f172a] border border-[#1e293b] rounded-lg shadow-2xl py-1 text-xs text-gray-200 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node && (
            <>
              <button
                onClick={() => {
                  setRenameModal({
                    open: true,
                    oldPath: contextMenu.node.path,
                    currentName: contextMenu.node.name,
                  });
                  setRenameNewName(contextMenu.node.name);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-blue-600/30 hover:text-white flex items-center gap-2 transition-colors"
              >
                <FileEdit className="w-3.5 h-3.5 text-blue-400" />
                <span>Rename</span>
              </button>

              <button
                onClick={() => {
                  setClipboard({
                    action: 'cut',
                    path: contextMenu.node.path,
                    name: contextMenu.node.name,
                    isDir: contextMenu.node.type === 'directory',
                  });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-blue-600/30 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                <span>Cut</span>
              </button>

              <button
                onClick={() => {
                  setClipboard({
                    action: 'copy',
                    path: contextMenu.node.path,
                    name: contextMenu.node.name,
                    isDir: contextMenu.node.type === 'directory',
                  });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-blue-600/30 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copy</span>
              </button>

              {contextMenu.node.type === 'file' && (
                <button
                  onClick={() => {
                    handleDownloadFile(contextMenu.node.path, contextMenu.node.name);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-600/30 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Download</span>
                </button>
              )}

              <div className="h-[1px] bg-[#1e293b] my-1" />
            </>
          )}

          {/* Paste item */}
          {clipboard && (
            <button
              onClick={() => {
                const targetFolder = contextMenu.node
                  ? contextMenu.node.type === 'directory'
                    ? contextMenu.node.path
                    : contextMenu.node.path.includes('/')
                    ? contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'))
                    : ''
                  : '';
                handlePaste(targetFolder);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-blue-600/30 hover:text-white flex items-center gap-2 transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-purple-400" />
              <span>Paste ({clipboard.name})</span>
            </button>
          )}

          {/* New file / folder */}
          <button
            onClick={() => {
              const targetFolder = contextMenu.node
                ? contextMenu.node.type === 'directory'
                  ? `${contextMenu.node.path}/`
                  : contextMenu.node.path.includes('/')
                  ? `${contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'))}/`
                  : ''
                : '';
              setNewItemName(targetFolder);
              setCreateItemModal({ open: true, isDirectory: false });
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-blue-600/30 hover:text-white flex items-center gap-2 transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5 text-blue-400" />
            <span>New File</span>
          </button>

          <button
            onClick={() => {
              const targetFolder = contextMenu.node
                ? contextMenu.node.type === 'directory'
                  ? `${contextMenu.node.path}/`
                  : contextMenu.node.path.includes('/')
                  ? `${contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'))}/`
                  : ''
                : '';
              setNewItemName(targetFolder);
              setCreateItemModal({ open: true, isDirectory: true });
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-blue-600/30 hover:text-white flex items-center gap-2 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
            <span>New Folder</span>
          </button>

          {contextMenu.node && (
            <>
              <div className="h-[1px] bg-[#1e293b] my-1" />
              <button
                onClick={() => {
                  handleMoveToTrash(contextMenu.node.path);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-rose-600/30 text-rose-400 hover:text-rose-300 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Recycle Bin</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Recycle Bin (Trash) Modal */}
      {recycleBinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1e293b] px-5 py-3.5 bg-[#0d1322]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Recycle Bin ({currentProjectObj?.name || projectId})
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Deleted files are preserved here and can be restored back anytime.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRecycleBinOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#1e293b] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Trash Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {trashItems.length === 0 ? (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#131e36] border border-[#1e293b] flex items-center justify-center mx-auto text-gray-500">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-gray-300">Recycle Bin is empty</p>
                  <p className="text-xs text-gray-500">Files and folders you delete will appear here safely.</p>
                </div>
              ) : (
                trashItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#090d16] border border-[#1e293b] hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {item.type === 'directory' ? (
                        <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <div className="truncate">
                        <div className="text-xs font-medium text-white truncate">{item.name}</div>
                        <div className="text-[11px] text-gray-500 truncate font-mono">
                          Original: {item.originalPath} &bull; Deleted:{' '}
                          {new Date(item.trashedAt).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          IST
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleRestoreFromTrash(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        title="Restore to original location"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        onClick={() => handleDeletePermanent(item.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-xs text-rose-400 hover:text-rose-300 transition-colors"
                        title="Delete permanently"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            {trashItems.length > 0 && (
              <div className="border-t border-[#1e293b] px-5 py-3 bg-[#0d1322] flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {trashItems.length} {trashItems.length === 1 ? 'item' : 'items'} in Recycle Bin
                </span>
                <button
                  onClick={handleEmptyRecycleBin}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-medium text-white transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Empty Recycle Bin</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rename File / Folder Modal */}
      {renameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-blue-400" />
                Rename Item
              </h3>
              <button
                onClick={() => setRenameModal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">
                  Enter new name for <span className="font-mono text-blue-400">{renameModal.currentName}</span>:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={renameNewName}
                  onChange={(e) => setRenameNewName(e.target.value)}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameModal(null)}
                  className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e293b]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-gray-500">Loading Code Editor...</div>}>
      <EditorContent />
    </Suspense>
  );
}
