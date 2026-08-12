'use client';

import { useSettingsStore } from '@/lib/store';
import { PlayCircle } from 'lucide-react';
import React from 'react';

const HowToPlayItem = ({ text, onClick }: { text: string; onClick: () => void }) => (
    <div 
        className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md cursor-pointer transition-all active:scale-95"
        onClick={onClick}
    >
        <span className="font-semibold text-gray-800">{text}</span>
        <PlayCircle className="h-8 w-8 text-pink-500" />
    </div>
);

export default function HowToPlayPage() {
    const { appSettings } = useSettingsStore();

    const handleItemClick = (key: keyof typeof appSettings) => {
        const url = appSettings[key] as string;
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            // Handle case where no URL is provided (e.g., show a toast)
            console.log('No video link provided for this item.');
        }
    };

    const howToPlayItems = [
        { text: "HOW TO CLAIM BONUS?", key: "videoClaimBonus" },
        { text: "HOW TO CHANGE YOUR LANGUAGE?", key: "videoChangeLanguage" },
        { text: "HOW TO WITHDRAWAL?", key: "videoWithdrawal" },
        { text: "HOW TO DEPOSIT ?", key: "videoDeposit" },
        { text: "HOW TO PLAY", key: "videoHowToPlay" }
    ];
    
    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <header className="sticky top-0 z-40 w-full border-b bg-header text-white">
                <div className="container flex h-16 items-center justify-center">
                    <h1 className="font-bold text-lg">How To Play</h1>
                </div>
            </header>
            <main className="flex-1 p-4">
                <div className="space-y-4">
                    {howToPlayItems.map((item) => (
                        <HowToPlayItem 
                            key={item.text} 
                            text={item.text} 
                            onClick={() => handleItemClick(item.key as any)}
                        />
                    ))}
                </div>
            </main>
        </div>
    );
}
