'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const languages = [
  'English', 'Hindi', 'Marathi', 'Punjabi',
  'Gujarati', 'Kannada', 'Tamil', 'Telugu', 'Bengali'
];

export default function ChangeLanguagePage() {
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const router = useRouter();

  return (
    <div className="relative flex flex-col items-center justify-start pt-20 min-h-screen bg-gray-50 overflow-hidden p-4">
      <div className="relative z-10 w-full max-w-sm text-center">
        <h1 className="text-xl font-bold text-blue-900 mb-6">
          Select Language
        </h1>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {languages.map((lang) => (
            <Button
              key={lang}
              variant="outline"
              className={cn(
                'w-full h-12 text-sm font-semibold rounded-lg shadow-md transition-all',
                selectedLanguage === lang
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              )}
              onClick={() => setSelectedLanguage(lang)}
            >
              {lang}
            </Button>
          ))}
        </div>

        <Button
          size="lg"
          className="w-full h-12 text-base font-bold rounded-full bg-blue-900 hover:bg-blue-800 shadow-lg"
          onClick={() => router.push('/home')}
        >
          Next
        </Button>
      </div>
    </div>
  );
}