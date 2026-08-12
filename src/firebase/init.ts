'use client';

import { app, auth, db } from '@/lib/firebase';

/**
 * Centered function to ensure the entire app uses the 
 * exact same initialized Firebase instances.
 */
export function initializeFirebase() {
  return {
    firebaseApp: app,
    auth: auth,
    firestore: db
  };
}
