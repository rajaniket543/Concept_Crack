import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAh6QgSH9Y3Fp_wR_KMYrWVaNlshZj8ChM',
  authDomain: 'concept-crack.firebaseapp.com',
  projectId: 'concept-crack',
  storageBucket: 'concept-crack.firebasestorage.app',
  messagingSenderId: '844804621506',
  appId: '1:844804621506:web:d6edda6a9c40f62a80e75b',
  measurementId: 'G-9R2582YS36',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
