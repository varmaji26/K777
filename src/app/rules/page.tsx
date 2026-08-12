
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';


const rules = [
    { number: '01', text: 'सबसे पहले हमारी वेबसाइट से प्लेइंग ऐप डाउनलोड करें' },
    { number: '02', text: 'फिर आपको अपना नाम मोबाइल नंबर और पासवर्ड भरकर खुद को रजिस्टर करना होगा।' },
    { number: '03', text: 'इसके बाद अपने खाते में कुछ पैसे जमा करें उसके लिए आपको ऐड फंड का बटन दबाना होगा।' },
    { number: '04', text: 'न्यूनतम जमा राशि रुपए 500 है।' },
    { number: '05', text: 'आप जमा करने के लिए किसी भी माध्यम का उपयोग कर सकते हैं गूगल पे, फोन पे, भीम ऐप, पेटीएम' },
    { number: '06', text: 'जितनी धनराशि आप जमा करेंगे उतनी पॉइंट्स आपके अकाउंट में जमा होंगे। (1rs = 1 पॉइंट)' },
    { number: '07', text: 'खेल खेलने के लिए बाजार, खेल का प्रकार और अपने पसंदीदा नंबर का चयन करें। यदि आप खेल खेलते हैं और जीते हैं, तो आपको पॉइंट्स बढ़ेंगे।' },
    { number: '08', text: 'आप हमारी वेबसाइट पर जाकर अपने खाते से पैसे निकाल सकते हैं। और पैसा आपके बैंक खाते में जमा हो जाएगा। विड्रॉल की सुविधा 24 घंटे उपलब्ध हे विड्रॉलका पैसा आपके बैंक खाते या वॉलेट पेटीएम, फोन पे, या गूगल पे में जमा होगा' },
];

const RuleStep = ({ number, text, isReversed }: { number: string; text: string; isReversed: boolean }) => (
    <div className={cn("flex items-center gap-2", isReversed ? "flex-row-reverse" : "")}>
        <div className="flex-shrink-0 h-10 w-10 bg-white rounded-full flex items-center justify-center text-blue-900 text-lg font-bold shadow-lg">
            {number}
        </div>
        <div className="flex-grow bg-[#1e638f] text-white p-2 rounded-full shadow-lg text-center">
            <p className="font-semibold text-xs">{text}</p>
        </div>
    </div>
);


export default function RulesPage() {
    const router = useRouter();
    
    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <header className="sticky top-0 z-40 w-full border-b bg-header text-white">
                <div className="container flex h-16 items-center justify-center">
                    <h1 className="font-bold text-lg">Notice Board/Rules</h1>
                </div>
            </header>
            <main className="flex-1 p-4 space-y-2">
                <h2 className="text-center text-xl font-bold text-gray-800">खेलने की विधि</h2>
                <div className="space-y-2">
                    {rules.map((rule, index) => (
                        <RuleStep key={rule.number} number={rule.number} text={rule.text} isReversed={index % 2 !== 0} />
                    ))}
                </div>
            </main>
        </div>
    );
}
