'use client';
import { useUserStore } from '@/lib/store';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { useEffect, useState } from 'react';

export function useAuth() {
    const user = useUserStore((state) => state.currentUser);
    const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setFbUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Combine the user from Zustand store and Firebase Auth state
    const combinedUser = user || (fbUser ? {
        id: fbUser.uid,
        name: fbUser.displayName || 'User',
        mobile: fbUser.phoneNumber || 'N/A',
    } : null);


    return { user: combinedUser, loading };
}