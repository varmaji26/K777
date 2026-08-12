'use client';

import { useGameStore, useUserStore } from '@/lib/store';
import { notFound, useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/loader';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import type { StarlineGame } from '@/lib/types';
import { betTypes, type BetType } from '@/lib/types';

// Custom Wallet Icon
const CustomWalletIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg">
    <path style={{ fill: '#A35425' }} d="M480,143.996h-96v368h96c17.672,0,32-14.328,32-32v-304C512,158.324,497.672,143.996,480,143.996z" />
    <circle style={{ fill: '#F19920' }} cx="176" cy="144.004" r="64" />
    <path style={{ fill: '#F19920' }} d="M209.92,177.916c18.752-18.736,18.776-49.128,0.04-67.88c-0.016-0.016-0.024-0.024-0.04-0.04 L142,177.916c18.736,18.752,49.128,18.776,67.88,0.04C209.896,177.94,209.904,177.924,209.92,177.916z" />
    <path style={{ fill: '#F6B545' }} d="M142.08,110.076c-18.752,18.736-18.776,49.128-0.04,67.88c0.016,0.016,0.024,0.024,0.04,0.04 l67.92-67.92c-18.736-18.752-49.128-18.776-67.88-0.04C142.104,110.052,142.096,110.06,142.08,110.076z" />
    <circle style={{ fill: '#F19920' }} cx="320" cy="64.004" r="64" />
    <path style={{ fill: '#89C763' }} d="M472,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C496,170.74,485.256,159.996,472,159.996z" />
    <path style={{ fill: '#3CB54A' }} d="M456,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C480,170.74,469.256,159.996,456,159.996z" />
    <path style={{ fill: '#89C763' }} d="M440,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C464,170.74,453.256,159.996,440,159.996z" />
    <path style={{ fill: '#3CB54A' }} d="M424,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C448,170.74,437.256,159.996,424,159.996z" />
    <path style={{ fill: '#C97629' }} d="M32,143.996h352c17.672,0,32,14.328,32,32v304c0,17.672-14.328,32-32,32H32 c-17.672,0-32-14.328-32-32v-304C0,158.324,14.328,143.996,32,143.996z" />
    <path style={{ fill: '#89C763' }} d="M411.76,159.996c2.816,4.864,4.28,10.384,4.24,16v304c0.04,5.616-1.424,11.136-4.24,16 c11.768-1.864,20.384-12.088,20.24-24v-288C432.144,172.076,423.528,161.86,411.76,159.996z" />
    <rect x="416" y="271.996" style={{ fill: '#D5E3EF' }} width="96" height="112" />
    <path style={{ fill: '#ECF0F9' }} d="M320,271.996c-30.928,0-56,25.072-56,56s25.072,56,56,56h96v-112H320z" />
    <circle style={{ fill: '#7F4122' }} cx="320" cy="327.996" r="24" />
    <rect x="496" y="383.996" style={{ fill: '#7F4122' }} width="16" height="16" />
    <rect x="480" y="383.996" style={{ fill: '#3CB54A' }} width="16" height="16" />
    <rect x="448" y="383.996" style={{ fill: '#3CB54A' }} width="16" height="16" />
    <rect x="416" y="383.996" style={{ fill: '#3CB54A' }} width="16" height="16" />
    <rect x="464" y="383.996" style={{ fill: '#0E9347' }} width="16" height="16" />
    <rect x="432" y="383.996" style={{ fill: '#0E9347' }} width="16" height="16" />
    <path style={{ fill: '#B06328' }} d="M320,383.996c-27.816-0.032-51.384-20.472-55.36-48c-4.416,30.608,16.816,59.008,47.424,63.424 c2.624,0.376,5.28,0.568,7.936,0.576h80v80c0,8.84-7.16,16-16,16H48c-8.84,0-16,7.16-16,16h352c17.672,0,32-14.328,32-32v-96H320z" />
    <path style={{ fill: '#D5E3EF' }} d="M336,367.996h80l0,0v16l0,0h-96l0,0l0,0C320,375.156,327.16,367.996,336,367.996z" />
    <path style={{ fill: '#B0C4D9' }} d="M496,287.996v80h-80v16h96v-112l0,0C503.16,271.996,496,279.156,496,287.996z" />
    <path style={{ fill: '#F19920' }} d="M353.92,97.916c18.752-18.736,18.776-49.128,0.04-67.88c-0.016-0.016-0.024-0.024-0.04-0.04 L286,97.916c18.736,18.752,49.128,18.776,67.88,0.04C353.896,97.94,353.904,97.924,353.92,97.916z" />
    <path style={{ fill: '#F6B545' }} d="M286.08,30.076c-18.752,18.736-18.776,49.128-0.04,67.88c0.016,0.016,0.024,0.024,0.04,0.04 l354,30.076c-18.736-18.752-49.128-18.776-67.88-0.04C286.104,30.052,286.096,30.06,286.08,30.076z" />
    <g>
        <circle cx="256" cy="125" r="35" fill="#F59E0B" />
        <text x="256" y="142" fontFamily="Arial" fontSize="45" fontWeight="bold" fill="white" textAnchor="middle">$</text>
    </g>
  </svg>
);

export default function PlayStarlineLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useUserStore();
  const gameId = typeof params.gameId === 'string' ? params.gameId : '';
  const [game, setGame] = useState<StarlineGame | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'starlineGames', gameId), (snap) => {
      if (snap.exists()) {
        setGame({ id: snap.id, ...snap.data() } as StarlineGame);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [gameId]);

  if (!currentUser) {
    if (typeof window !== 'undefined') router.replace('/login');
    return null;
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader className="h-10 w-10 text-primary" /></div>;
  }

  if (!game) {
    notFound();
    return null;
  }

  const betTypeParam = params.betType;
  const betTypeKey = typeof betTypeParam === 'string' && Object.keys(betTypes).includes(betTypeParam) ? betTypeParam as BetType : null;
  const betLabel = betTypeKey ? betTypes[betTypeKey] : 'KALYAN 777 STARLINE';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 w-full border-b bg-header text-white">
        <div className="container flex h-16 items-center justify-between gap-2">
          <h1 className="font-bold text-[13px] whitespace-nowrap overflow-hidden text-ellipsis mx-auto uppercase">
            {betLabel} ({game.time})
          </h1>
          <Button variant="outline" className="bg-background/10 border-white/20 text-white hover:bg-white/20 h-8 px-3 pointer-events-none shrink-0 gap-1">
            <CustomWalletIcon className="h-5 w-5" />
            <span className="font-bold text-white">{((currentUser.balance || 0) + (currentUser.bonusBalance || 0)).toFixed(0)}</span>
          </Button>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
