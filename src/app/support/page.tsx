
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/layout/footer';
import { doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader } from '@/components/loader';

interface SupportCardLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const SupportCardLink: React.FC<SupportCardLinkProps> = ({ href, icon, title, description }) => (
  <Link href={href} className="block" target="_blank" rel="noopener noreferrer">
    <div className="flex items-center p-4 bg-white rounded-xl shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105">
      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100/60 mr-4">
        {icon}
      </div>
      <div>
        <h3 className="text-md font-bold text-gray-800">{title}</h3>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  </Link>
);

interface AppSettings extends DocumentData {
    whatsappNumber?: string;
    supportNumber?: string;
}

export default function SupportPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const appSettingsDocRef = doc(db, 'settings', 'app-settings');
    const unsubscribe = onSnapshot(appSettingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setSettings(docSnap.data() as AppSettings);
        }
        setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, []);

  const whatsappLink = `https://wa.me/${settings.whatsappNumber || ''}`;
  const callLink = `tel:${settings.supportNumber || ''}`;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 w-full border-b bg-header text-white">
        <div className="container flex h-16 items-center justify-center">
          <h1 className="font-bold text-lg">Support</h1>
        </div>
      </header>
      <main className="flex-1 bg-gray-50 pb-24">
        <div className="container mx-auto px-4 py-8">
            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader className="h-10 w-10 text-primary" />
                </div>
            ) : (
                <div className="space-y-4">
                <SupportCardLink
                    href={whatsappLink}
                    icon={<Image src="https://img.icons8.com/color/96/whatsapp--v1.png" alt="WhatsApp" width={28} height={28} />}
                    title="Whatsapp"
                    description={`Chat on ${settings.whatsappNumber || 'our number'}`}
                />
                <SupportCardLink
                    href={callLink}
                    icon={<Phone className="h-6 w-6 text-blue-600" />}
                    title="Call Support"
                    description={`Call us at ${settings.supportNumber || 'our number'}`}
                />
                </div>
            )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
