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
