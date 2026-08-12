'use client';

import { useEffect } from 'react';
import { useFcmToken } from '@/hooks/useFcmToken';

export function FcmHandler() {
    // The hook handles foreground messages and token saving if permission is already granted.
    useFcmToken();

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/firebase-messaging-sw.js')
                .then(function (registration) {
                    console.log('Service Worker registration successful, scope is:', registration.scope);
                })
                .catch(function (err) {
                    console.log('Service Worker registration failed:', err);
                });
        }
    }, []);

    // We no longer render the UI prompt to ask for notification permission.
    return null;
}
