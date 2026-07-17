// Real cross-user messaging on Firestore (replaces the old localStorage demo).
//
// A thread lives at chats/{threadId} where threadId is the two participant uids
// sorted and joined — so any pair of users always lands in the same thread.
// Messages are a subcollection ordered by client timestamp; both sides get
// real-time updates through onSnapshot.

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, query, where,
  onSnapshot, orderBy, limit, serverTimestamp, Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { notify } from './db';
import type { ChatAttachment } from './storage';

export interface ChatParticipant {
  uid: string;
  name: string;
  role: string;
}

export interface ChatThread {
  id: string;
  participants: string[];                       // [uidA, uidB]
  participantInfo: Record<string, ChatParticipant>;
  lastMessage: string;
  lastFrom: string;
  lastAt: string | null;
}

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  at: string | null;
  attachmentUrl?:  string;
  attachmentType?: 'image' | 'video';
  attachmentName?: string;
}

export interface ChatContact {
  uid: string;
  name: string;
  email: string;
  role: string;
}

function threadIdFor(a: string, b: string): string {
  return [a, b].sort().join('__');
}

function toIso(v: unknown): string | null {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return null;
}

function docToThread(id: string, d: Record<string, unknown>): ChatThread {
  return {
    id,
    participants:    (d.participants as string[]) ?? [],
    participantInfo: (d.participantInfo as Record<string, ChatParticipant>) ?? {},
    lastMessage:     (d.lastMessage as string) ?? '',
    lastFrom:        (d.lastFrom as string) ?? '',
    lastAt:          toIso(d.lastAt),
  };
}

// ── Threads ───────────────────────────────────────────────────────────────────

export async function getOrCreateThread(me: ChatParticipant, other: ChatParticipant): Promise<ChatThread> {
  const id = threadIdFor(me.uid, other.uid);
  const ref = doc(db, 'chats', id);
  const snap = await getDoc(ref);
  if (snap.exists()) return docToThread(snap.id, snap.data() as Record<string, unknown>);

  const data = {
    participants: [me.uid, other.uid].sort(),
    participantInfo: {
      [me.uid]:    { uid: me.uid,    name: me.name,    role: me.role },
      [other.uid]: { uid: other.uid, name: other.name, role: other.role },
    },
    lastMessage: '',
    lastFrom: '',
    lastAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return docToThread(id, data as unknown as Record<string, unknown>);
}

export async function listThreads(uid: string): Promise<ChatThread[]> {
  try {
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', uid), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => docToThread(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
  } catch (e) {
    console.error('listThreads failed', e);
    return [];
  }
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function sendChatMessage(
  thread: ChatThread,
  from: ChatParticipant,
  text: string,
  attachment?: ChatAttachment,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed && !attachment) return;

  await addDoc(collection(db, 'chats', thread.id, 'messages'), {
    from: from.uid,
    text: trimmed,
    at: serverTimestamp(),
    ...(attachment ? {
      attachmentUrl:  attachment.url,
      attachmentType: attachment.type,
      attachmentName: attachment.name,
    } : {}),
  });

  // A caption-less attachment still needs something to show in the thread
  // list and the notification, so fall back to a short label for it.
  const preview = trimmed || (attachment ? (attachment.type === 'image' ? '📷 Photo' : '🎥 Video') : '');

  await setDoc(doc(db, 'chats', thread.id), {
    lastMessage: preview.slice(0, 120),
    lastFrom: from.uid,
    lastAt: serverTimestamp(),
  }, { merge: true });

  // Notify the other participant (best-effort).
  const otherUid = thread.participants.find(p => p !== from.uid);
  if (otherUid) {
    void notify(otherUid, `New message from ${from.name}`, preview.slice(0, 80), 'message');
  }
}

export function subscribeToMessages(threadId: string, cb: (msgs: ChatMessage[]) => void): Unsubscribe {
  const q = query(collection(db, 'chats', threadId, 'messages'), orderBy('at', 'asc'), limit(200));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        from: (data.from as string) ?? '',
        text: (data.text as string) ?? '',
        at: toIso(data.at),
        attachmentUrl:  (data.attachmentUrl as string) || undefined,
        attachmentType: (data.attachmentType as 'image' | 'video') || undefined,
        attachmentName: (data.attachmentName as string) || undefined,
      };
    }));
  }, e => console.error('subscribeToMessages failed', e));
}

// ── Contact pickers ───────────────────────────────────────────────────────────
// Who can a user start a conversation with?
//   student → faculty            faculty → students & parents
//   parent  → faculty            admin   → faculty & parents

export async function listContactsFor(role: string): Promise<ChatContact[]> {
  const wanted: Record<string, string[]> = {
    student: ['faculty'],
    parent:  ['faculty'],
    faculty: ['student', 'parent', 'faculty'],
    admin:   ['faculty', 'parent', 'student'],
  };
  const allowed = wanted[role] ?? ['faculty'];
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs
      .map(d => ({ uid: d.id, data: d.data() as Record<string, unknown> }))
      .filter(u => allowed.includes((u.data.role as string) ?? ''))
      .map(u => ({
        uid: u.uid,
        name: (u.data.name as string) ?? (u.data.email as string) ?? 'User',
        email: (u.data.email as string) ?? '',
        role: (u.data.role as string) ?? '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.error('listContactsFor failed', e);
    return [];
  }
}
