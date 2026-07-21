import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import app from './firebase';

const storage = getStorage(app);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per figure

/** Upload a question figure to Storage and return its public download URL. */
export async function uploadQuestionImage(file: File, uid: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large (max 5 MB).');
  const safeName = file.name.replace(/[^\w.-]/g, '_');
  const path = `question-images/${uid || 'unknown'}/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

// ── Chat attachments (images / videos) ──────────────────────────────────────

const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CHAT_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

export interface ChatAttachment {
  url:  string;
  type: 'image' | 'video';
  name: string;
}

/**
 * Upload an image or video to a chat thread's attachment folder and return
 * everything sendChatMessage needs to attach it to a message. Only the two
 * thread participants can read/write this path — enforced in storage.rules,
 * not just here (client-side checks are convenience, not security).
 */
export async function uploadChatAttachment(file: File, threadId: string): Promise<ChatAttachment> {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) throw new Error('Please choose an image or video file.');

  const limit = isImage ? MAX_CHAT_IMAGE_BYTES : MAX_CHAT_VIDEO_BYTES;
  if (file.size > limit) {
    throw new Error(`${isImage ? 'Image' : 'Video'} is too large (max ${limit / (1024 * 1024)} MB).`);
  }

  const safeName = file.name.replace(/[^\w.-]/g, '_');
  const path = `chatAttachments/${threadId}/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url, type: isImage ? 'image' : 'video', name: file.name };
}
