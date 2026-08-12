'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  CACHE_SIZE_UNLIMITED, 
  Firestore,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase App
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
const auth: Auth = getAuth(app);

// Initialize Firestore with Force Long Polling for stability in Cloud Workstations
// This prevents "Client is offline" errors caused by WebSocket blocking.
let db: Firestore;
if (typeof window !== 'undefined') {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  });
  
  // Optional: Initialize Analytics only on client
  import('firebase/analytics').then(({ getAnalytics, isSupported }) => {
    isSupported().then(yes => {
      if (yes) getAnalytics(app);
    });
  });
} else {
  db = initializeFirestore(app, {});
}

// Initialize Storage
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };

export async function getMessagingInstance() {
  if (typeof window === 'undefined') return null;
  const { getMessaging, isSupported } = await import('firebase/messaging');
  if (await isSupported()) {
    return getMessaging(app);
  }
  return null;
}
