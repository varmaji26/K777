
'use client';

/**
 * Centered export from lib/firebase to ensure 
 * the entire app uses the exact same initialized instance.
 */
import { app, auth, db } from '@/lib/firebase';

export function initializeFirebase() {
  return {
    firebaseApp: app,
    auth: auth,
    firestore: db
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
