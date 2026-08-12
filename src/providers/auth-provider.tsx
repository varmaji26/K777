'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserStore, useGameStore, useSettingsStore } from '@/lib/store';
import { Loader } from '@/components/loader';

const publicPaths = ['/login', '/signup', '/'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const { currentUser, hydrated: userHydrated } = useUserStore();
  const { hydrated: gameHydrated } = useGameStore();
  const { hydrated: settingsHydrated } = useSettingsStore();
  const pathname = usePathname();
  const router = useRouter();
  
  const hydrated = userHydrated && gameHydrated && settingsHydrated;

  useEffect(() => {
    // This effect now does nothing as initialization is handled in the store itself.
    // Kept for potential future use or can be removed.
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    
    const isPublicPath = publicPaths.includes(pathname);
    const isAdminPath = pathname.startsWith('/admin');

    if (!currentUser) {
      if (!isPublicPath) {
        router.replace('/');
      }
    } 
    else {
      if (isAdminPath && !currentUser.isAdmin) {
          router.replace('/home');
      }
      else if (isPublicPath) {
          if (currentUser.isAdmin) {
              router.replace('/admin');
          } else {
              router.replace('/home');
          }
      }
    }
    
  }, [pathname, currentUser, router, hydrated]);

  if (!hydrated) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
            <Loader className="h-10 w-10 text-primary" />
        </div>
      );
  }

  return <>{children}</>;
}
