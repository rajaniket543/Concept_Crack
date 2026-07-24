import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Config is read from VITE_FIREBASE_* in .env.local, falling back to the
// concept-crack (production) values. This lets a branch target a different
// Firebase project by editing only .env.local — the code stays identical across
// dev and test, so switching environments never touches source or risks a merge
// conflict. Web API keys are not secret (access is gated by Firestore rules),
// so shipping the production defaults here is safe.
const env = import.meta.env;
const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY            ?? 'AIzaSyAh6QgSH9Y3Fp_wR_KMYrWVaNlshZj8ChM',
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN        ?? 'concept-crack.firebaseapp.com',
  projectId:         env.VITE_FIREBASE_PROJECT_ID         ?? 'concept-crack',
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET     ?? 'concept-crack.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '844804621506',
  appId:             env.VITE_FIREBASE_APP_ID             ?? '1:844804621506:web:d6edda6a9c40f62a80e75b',
  measurementId:     env.VITE_FIREBASE_MEASUREMENT_ID     ?? 'G-9R2582YS36',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
