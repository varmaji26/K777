// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCnxxMjQNVMFRnqJ_RkzFG2VHdONS9PhIo",
  authDomain: "auth-canvas.firebaseapp.com",
  databaseURL: "https://auth-canvas-default-rtdb.firebaseio.com",
  projectId: "auth-canvas",
  storageBucket: "auth-canvas.firebasestorage.app",
  messagingSenderId: "645923871999",
  appId: "1:645923871999:web:848febd795743ae4e4c0ca",
  measurementId: "G-YF2VQE6C97"
};


firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle,
    notificationOptions);
});
