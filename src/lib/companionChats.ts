import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export interface CompanionMessage {
  role: 'ai' | 'user';
  text: string;
}

export interface CompanionSession {
  id: string;
  studentId: string;
  title: string;
  messages: CompanionMessage[];
  createdAt: string;
  updatedAt: string;
}

const COLLECTION = 'companionSessions';

function titleFromMessages(messages: CompanionMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'New chat';
  const text = firstUser.text.trim();
  return text.length > 48 ? `${text.slice(0, 48).trim()}…` : text;
}

// Real, per-student chat history — no orderBy in the query (avoids a
// composite-index requirement the user would have to deploy via Console);
// sorted client-side instead, same convention already used in src/lib/tests.ts.
export async function listSessions(uid: string): Promise<CompanionSession[]> {
  if (!uid) return [];
  const q = query(collection(db, COLLECTION), where('studentId', '==', uid));
  const snap = await getDocs(q);
  const sessions = snap.docs.map(d => {
    const data = d.data() as Omit<CompanionSession, 'id'>;
    return { id: d.id, ...data };
  });
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createSession(uid: string): Promise<CompanionSession> {
  const now = new Date().toISOString();
  const payload = { studentId: uid, title: 'New chat', messages: [] as CompanionMessage[], createdAt: now, updatedAt: now };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return { id: ref.id, ...payload };
}

export async function saveSessionMessages(sessionId: string, messages: CompanionMessage[]): Promise<void> {
  await updateDoc(doc(db, COLLECTION, sessionId), {
    messages,
    title: titleFromMessages(messages),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, sessionId));
}
