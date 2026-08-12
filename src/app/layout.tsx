
import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, Cinzel } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import * as React from "react";
import { AuthProvider } from '@/providers/auth-provider';
import { FcmHandler } from '@/components/fcm-handler';
import { ThemeProvider } from '@/components/theme-provider';
import { FirebaseClientProvider } from '@/firebase/client-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-luxury' });

export const metadata: Metadata = {
  title: 'KALYAN 777',
  description: 'Your Ultimate Hub for KALYAN 777',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={cn('font-body antialiased', inter.variable, spaceGrotesk.variable, cinzel.variable)}>
        <FirebaseClientProvider>
          <ThemeProvider>
            <AuthProvider>
                <FcmHandler />
                <div className="relative flex min-h-screen flex-col">
                {children}
                </div>
                <Toaster />
            </AuthProvider>
          </ThemeProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
