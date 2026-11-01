'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  X,
  Minus,
  Send,
  Paperclip,
  Image as ImageIcon,
  Users,
  User,
  Globe,
  Check,
  Download,
  Maximize2,
  FileText,
  Sparkles,
  Smile,
  Shield,
} from 'lucide-react';

interface ChatAttachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  size: number;
  url: string;
}

interface ChatMessage {
  id: string;
  senderEmail: string;
  senderName: string;
  senderRole?: string;
  recipientEmail?: string | null;
  content: string;
  attachments?: ChatAttachment[];
  timestamp: string;
}

interface UserPresence {
  id: string;
  email: string;
  name: string;
  role: string;
  isOnline: boolean;
  lastSeen: string;
}

// Indian Standard Time (IST - Asia/Kolkata) Formatter
function formatIST(dateStringOrIso: string | Date | undefined): string {
  if (!dateStringOrIso) return '';
  try {
    const date = new Date(dateStringOrIso);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      day: 'numeric',
      month: 'short',
    }).format(date) + ' IST';
  } catch {
    return '';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GlobalChatWidget() {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'public' | 'dms'>('public');
  const [selectedRecipient, setSelectedRecipient] = useState<UserPresence | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string; role: string } | null>(null);

  const [inputText, setInputText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastMessageCountRef = useRef(0);

  // Poll for messages & presence every 4 seconds
  const fetchChatData = async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const res = await fetch('/api/chat');
      if (res.status === 401) return;
      const data = await res.json();

      if (data.success) {
        if (data.currentUser) setCurrentUser(data.currentUser);
        if (data.users) setUsers(data.users);

        if (data.messages) {
          setMessages(data.messages);
          // If popup is closed and new messages arrived, increment unread badge
          if (!isOpen && data.messages.length > lastMessageCountRef.current) {
            const diff = data.messages.length - lastMessageCountRef.current;
            setUnreadCount((prev) => prev + diff);
          }
          lastMessageCountRef.current = data.messages.length;
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (isLoginPage) return;
    fetchChatData();
    const interval = setInterval(fetchChatData, 4000);
    return () => clearInterval(interval);
  }, [isLoginPage, isOpen]);

  // When opening popup, clear unread count & scroll to bottom
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      scrollToBottom();
    }
  }, [isOpen, activeTab, selectedRecipient]);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages.length]);

  // Handle Ctrl+V to paste images from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            const base64 = loadEvent.target?.result as string;
            if (base64) {
              const newAttachment: ChatAttachment = {
                id: `att_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                name: `screenshot-${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`,
                type: 'image',
                size: file.size,
                url: base64,
              };
              setPendingAttachments((prev) => [...prev.slice(0, 4), newAttachment]);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Handle File Input Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isImageOnly = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" is too large (max 10MB)`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const base64 = loadEvent.target?.result as string;
        if (base64) {
          const isImg = file.type.startsWith('image/');
          const newAttachment: ChatAttachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            name: file.name,
            type: isImg ? 'image' : 'file',
            size: file.size,
            url: base64,
          };
          setPendingAttachments((prev) => [...prev.slice(0, 4), newAttachment]);
        }
      };
      reader.readAsDataURL(file);
    }

    e.target.value = '';
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (sending) return;

    const trimmed = inputText.trim();
    if (!trimmed && pendingAttachments.length === 0) return;

    setSending(true);
    const recipientEmail = activeTab === 'dms' && selectedRecipient ? selectedRecipient.email : null;
    const attachmentsToSend = [...pendingAttachments];

    // Optimistic reset
    setInputText('');
    setPendingAttachments([]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          recipientEmail,
          attachments: attachmentsToSend,
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter messages based on active tab
  const displayedMessages = messages.filter((m) => {
    if (activeTab === 'public') {
      return !m.recipientEmail; // Public channel
    } else if (activeTab === 'dms' && selectedRecipient) {
      return (
        (m.senderEmail === currentUser?.email && m.recipientEmail === selectedRecipient.email) ||
        (m.senderEmail === selectedRecipient.email && m.recipientEmail === currentUser?.email)
      );
    }
    return false;
  });

  const onlineUsersCount = users.filter((u) => u.isOnline).length;

  if (isLoginPage) return null;

  return (
    <>
      {/* 1. FLOATING CIRCLE BUBBLE (When Minimized / Closed) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={() => setIsOpen(true)}
            className="group relative w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-2xl shadow-blue-500/40 hover:shadow-blue-500/60 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center border-2 border-white/20 focus:outline-none"
            title="Open Team & Workspace Chat"
          >
            <MessageSquare className="w-6 h-6 transition-transform group-hover:scale-110" />

            {/* Online Pulse Dot */}
            <span
              className="absolute top-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#090d16] flex items-center justify-center shadow"
              title={`${onlineUsersCount} team member${onlineUsersCount === 1 ? '' : 's'} online`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </span>

            {/* Unread Message Badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-rose-500 text-white text-[11px] font-bold font-mono px-1.5 py-0.5 rounded-full border-2 border-[#090d16] animate-bounce shadow-lg">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* 2. EXPANDED CHAT POPUP WINDOW (When Opened) */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[94vw] sm:w-[420px] h-[580px] max-h-[82vh] bg-[#0c1220]/95 backdrop-blur-xl border border-[#1e293b] rounded-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="h-14 px-4 bg-[#090d16] border-b border-[#1e293b] flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center space-x-2.5 truncate">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-500/20">
                {activeTab === 'public' ? <Globe className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-semibold text-white truncate">
                    {activeTab === 'public'
                      ? '# Public Team Chat'
                      : `DM: ${selectedRecipient ? selectedRecipient.name : 'Direct Message'}`}
                  </h3>
                  {activeTab === 'dms' && selectedRecipient && (
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        selectedRecipient.isOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-gray-500'
                      }`}
                      title={selectedRecipient.isOnline ? 'Online now' : 'Offline'}
                    />
                  )}
                </div>
                <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{onlineUsersCount} online now</span>
                </div>
              </div>
            </div>

            {/* Header Controls: Minimize & Close */}
            <div className="flex items-center space-x-1 shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1e293b] transition-colors"
                title="Minimize back to circle bubble"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1e293b] transition-colors"
                title="Close chat popup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Top Channel & DMs Switcher Bar */}
          <div className="flex items-center border-b border-[#1e293b] bg-[#070b14] px-2 py-1.5 gap-1.5 text-xs">
            <button
              onClick={() => {
                setActiveTab('public');
                setSelectedRecipient(null);
              }}
              className={`flex-1 py-1 px-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'public'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#131e36]'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>Public Team</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('dms');
                if (!selectedRecipient && users.length > 0) {
                  // Default to first user other than current user
                  const other = users.find((u) => u.email !== currentUser?.email) || users[0];
                  setSelectedRecipient(other);
                }
              }}
              className={`flex-1 py-1 px-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'dms'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#131e36]'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>Direct Messages</span>
            </button>
          </div>

          {/* DMs User Picker (Horizontal Pill Strip when in DMs mode) */}
          {activeTab === 'dms' && (
            <div className="flex items-center gap-1.5 overflow-x-auto px-2 py-2 bg-[#090d16] border-b border-[#1e293b] shrink-0 text-xs">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider shrink-0 font-mono pl-1">Chat With:</span>
              {users
                .filter((u) => u.email !== currentUser?.email)
                .map((u) => {
                  const isSelected = selectedRecipient?.email === u.email;
                  return (
                    <button
                      key={u.email}
                      onClick={() => setSelectedRecipient(u)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-[#131e36] text-gray-300 hover:text-white hover:bg-[#1e293b]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${u.isOnline ? 'bg-emerald-400' : 'bg-gray-500'}`}
                      />
                      <span className="truncate max-w-[100px]">{u.name}</span>
                    </button>
                  );
                })}
            </div>
          )}

          {/* Message Feed Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a0e1a]/80">
            {displayedMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <div className="w-12 h-12 rounded-full bg-[#131e36] flex items-center justify-center mb-3 text-gray-400">
                  <MessageSquare className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-xs font-medium text-gray-300">
                  {activeTab === 'public'
                    ? 'No public messages yet'
                    : `No direct messages with ${selectedRecipient?.name || 'this user'}`}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Type below, paste screenshots with <kbd className="px-1 py-0.5 bg-[#1e293b] rounded font-mono text-gray-400">Ctrl+V</kbd>, or attach files.
                </p>
              </div>
            ) : (
              displayedMessages.map((msg) => {
                const isMe = msg.senderEmail === currentUser?.email;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    {/* Sender & IST Time */}
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono px-1">
                      <span className="font-semibold text-gray-300">{isMe ? 'You' : msg.senderName}</span>
                      {msg.senderRole && (
                        <span className="px-1 py-0.2 rounded text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                          {msg.senderRole}
                        </span>
                      )}
                      <span>&bull;</span>
                      <span>{formatIST(msg.timestamp)}</span>
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed space-y-2 shadow-sm ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-[#141d30] border border-[#1e293b] text-gray-100 rounded-tl-none'
                      }`}
                    >
                      {/* Text Content */}
                      {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}

                      {/* Attachments Preview */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {msg.attachments.map((att) => {
                            if (att.type === 'image') {
                              return (
                                <div key={att.id} className="relative rounded-lg overflow-hidden border border-black/20 group">
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    onClick={() => setPreviewImage(att.url)}
                                    className="max-h-48 w-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-cover"
                                  />
                                </div>
                              );
                            }

                            // Generic File Attachment
                            return (
                              <a
                                key={att.id}
                                href={att.url}
                                download={att.name}
                                className={`flex items-center gap-2 p-2 rounded-lg text-[11px] font-mono transition-colors ${
                                  isMe ? 'bg-blue-700/60 hover:bg-blue-700 text-white' : 'bg-[#090d16] hover:bg-[#1a253c] text-blue-300'
                                }`}
                              >
                                <FileText className="w-4 h-4 shrink-0" />
                                <div className="truncate flex-1">
                                  <div className="truncate font-medium">{att.name}</div>
                                  <div className="text-[9px] opacity-75">{formatFileSize(att.size)}</div>
                                </div>
                                <Download className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending Attachments Strip (Thumbnails of Ctrl+V pasted screenshots or files) */}
          {pendingAttachments.length > 0 && (
            <div className="px-3 py-2 bg-[#080d1a] border-t border-[#1e293b] flex items-center gap-2 overflow-x-auto shrink-0">
              <span className="text-[10px] text-gray-400 font-mono shrink-0">Attached:</span>
              {pendingAttachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 bg-[#141d30] border border-[#1e293b] rounded-lg px-2 py-1 text-xs text-gray-300 shrink-0 relative group"
                >
                  {att.type === 'image' ? (
                    <img src={att.url} alt={att.name} className="w-6 h-6 object-cover rounded" />
                  ) : (
                    <FileText className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="truncate max-w-[120px] text-[11px] font-mono">{att.name}</span>
                  <button
                    onClick={() => setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                    className="text-gray-400 hover:text-rose-400 ml-1 p-0.5"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Input Area with Ctrl+V support */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-[#090d16] border-t border-[#1e293b] space-y-2 shrink-0"
          >
            {/* Hidden File Inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e, false)}
              className="hidden"
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileSelect(e, true)}
              className="hidden"
            />

            <div className="relative flex items-end bg-[#0f172a] border border-[#1e293b] focus-within:border-blue-500 rounded-xl p-1.5 transition-colors">
              <textarea
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  activeTab === 'public'
                    ? 'Message #team... (Ctrl+V to paste screenshot)'
                    : `Message ${selectedRecipient?.name || 'user'}... (Ctrl+V to paste)`
                }
                className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none resize-none px-2 py-1 leading-relaxed"
              />

              <div className="flex items-center gap-1 shrink-0 pb-1 pr-1">
                {/* Image upload button */}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-[#1e293b] rounded-lg transition-colors"
                  title="Upload / attach image"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                {/* File attachment button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-[#1e293b] rounded-lg transition-colors"
                  title="Attach file (logs, documents, archives)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {/* Send button */}
                <button
                  type="submit"
                  disabled={sending || (!inputText.trim() && pendingAttachments.length === 0)}
                  className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors shadow-sm"
                  title="Send message (Enter)"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-500 px-1 font-mono">
              <span>Press <strong>Enter</strong> to send &bull; <strong>Shift+Enter</strong> for newline</span>
              <span className="hidden sm:inline">Ctrl+V paste screenshot</span>
            </div>
          </form>
        </div>
      )}

      {/* 3. FULL-SCREEN IMAGE PREVIEW MODAL */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

