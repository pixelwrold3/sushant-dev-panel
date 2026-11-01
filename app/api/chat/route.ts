import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, getClientIp } from '@/lib/api/handler';
import { getDatabase, saveDatabase, ChatMessage, ChatAttachment } from '@/lib/database/db';

export async function GET(req: NextRequest) {
  return secureApiHandler(req, async (r, user) => {
    const db = getDatabase();

    // 1. Update presence for current user
    if (!db.onlineUsers) db.onlineUsers = {};
    db.onlineUsers[user.email] = {
      email: user.email,
      name: user.name || user.email.split('@')[0],
      role: user.role,
      lastSeen: new Date().toISOString(),
    };
    saveDatabase();

    // 2. Compute online status for all registered users
    const now = Date.now();
    const registeredUsers = db.users || [];
    const usersWithStatus = registeredUsers.map((u) => {
      const presence = db.onlineUsers?.[u.email];
      const lastSeenMs = presence ? new Date(presence.lastSeen).getTime() : 0;
      const isOnline = now - lastSeenMs < 60000; // Active within last 60 seconds

      return {
        id: u.id,
        email: u.email,
        name: u.name || u.email.split('@')[0],
        role: u.role,
        isOnline: u.email === user.email ? true : isOnline,
        lastSeen: presence?.lastSeen || u.lastLogin || u.createdAt,
      };
    });

    // 3. Filter messages visible to this user
    const allMessages: ChatMessage[] = db.chatMessages || [];
    const visibleMessages = allMessages.filter(
      (m) =>
        !m.recipientEmail || // Public channel message
        m.senderEmail === user.email || // Sent by current user
        m.recipientEmail === user.email // Sent directly to current user
    );

    return NextResponse.json({
      success: true,
      currentUser: {
        email: user.email,
        name: user.name || user.email.split('@')[0],
        role: user.role,
      },
      users: usersWithStatus,
      messages: visibleMessages,
    });
  });
}

export async function POST(req: NextRequest) {
  return secureApiHandler(req, async (r, user) => {
    const body = await req.json();
    const { content, recipientEmail, attachments } = body;

    const trimmedContent = (content || '').trim();
    const validAttachments: ChatAttachment[] = Array.isArray(attachments)
      ? attachments.slice(0, 5).map((a: any) => ({
          id: `att_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          name: a.name || 'attachment',
          type: a.type === 'image' ? 'image' : 'file',
          size: typeof a.size === 'number' ? a.size : 0,
          url: a.url || '',
        }))
      : [];

    if (!trimmedContent && validAttachments.length === 0) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    const db = getDatabase();
    if (!db.chatMessages) db.chatMessages = [];

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      senderEmail: user.email,
      senderName: user.name || user.email.split('@')[0],
      senderRole: user.role,
      recipientEmail: recipientEmail ? recipientEmail.trim() : null,
      content: trimmedContent.slice(0, 5000),
      attachments: validAttachments,
      timestamp: new Date().toISOString(),
    };

    db.chatMessages.push(newMsg);

    // Keep latest 500 messages to prevent database bloat
    if (db.chatMessages.length > 500) {
      db.chatMessages = db.chatMessages.slice(-500);
    }

    // Refresh presence
    if (!db.onlineUsers) db.onlineUsers = {};
    db.onlineUsers[user.email] = {
      email: user.email,
      name: user.name || user.email.split('@')[0],
      role: user.role,
      lastSeen: new Date().toISOString(),
    };

    saveDatabase();

    return NextResponse.json({
      success: true,
      message: newMsg,
    });
  });
}

