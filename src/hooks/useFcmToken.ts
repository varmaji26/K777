'use client';

import { useState, useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingInstance } from '@/lib/firebase';
import { useUserStore } from '@/lib/store';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const getInitialPermissionState = (): NotificationPermission => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission;
  }
  return 'default';
};


export function useFcmToken() {
  const { currentUser } = useUserStore();
  const { toast } = useToast();
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<NotificationPermission>(getInitialPermissionState);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    getMessagingInstance().then((messagingInstance) => {
      if (messagingInstance) {
        unsubscribe = onMessage(messagingInstance, (payload) => {
          console.log('Foreground message received.', payload);
          toast({
            title: payload.notification?.title,
            description: payload.notification?.body,
          });
        });
      }
    });
    return () => unsubscribe?.();
  }, [toast]);

  const retrieveToken = async () => {
    if (typeof window === 'undefined') return null;
    const messagingInstance = await getMessagingInstance();
    if (!messagingInstance) return null;
    try {
      const currentToken = await getToken(messagingInstance);
      if (currentToken) {
        return currentToken;
      } else {
        console.log('No registration token available. Request permission to generate one.');
      }
    } catch (error) {
      console.log('An error occurred while retrieving token. ', error);
    }
    return null;
  };

  useEffect(() => {
    const getTokenAndSave = async () => {
      if (notificationPermissionStatus === 'granted' && currentUser) {
        const currentToken = await retrieveToken();
        if (currentToken) {
          await setDoc(doc(db, 'fcmTokens', currentUser.id), {
            token: currentToken,
            userId: currentUser.id,
            createdAt: serverTimestamp(),
          }, { merge: true });
        }
      }
    };

    getTokenAndSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationPermissionStatus, currentUser]);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermissionStatus(permission);
    }
  };

  return { notificationPermissionStatus, requestNotificationPermission };
}
