// 'use strict';
// import admin from 'firebase-admin';

// if (!admin.apps.length) {
//   try {
//     // In a Google Cloud environment (like Firebase App Hosting), initializeApp()
//     // automatically finds the service account credentials.
//     admin.initializeApp();
//   } catch (error) {
//     console.error('Firebase admin initialization error:', error);
//   }
// }
// export default admin;

'use strict';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // 1. Local pe → serviceAccountKey.json se credentials
    // 2. Vercel pe → FIREBASE_SERVICE_ACCOUNT env variable se
    // 3. Firebase App Hosting pe → automatic credentials
    const serviceAccount = (() => {
      try {
        return require('../../serviceAccountKey.json');
      } catch {
        // File nahi mili — check env variable (Vercel ke liye)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        }
        return null;
      }
    })();

    if (serviceAccount) {
      // Local ya Vercel — credentials se initialize
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Firebase App Hosting — auto credentials
      admin.initializeApp();
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

export default admin;
