'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore, useSettingsStore, useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader } from '@/components/loader';
import { History, Trophy, BarChart2, Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Custom Wallet Icon Component
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
    <path style={{ fill: '#F6B545' }} d="M286.08,30.076c-18.752,18.736-18.776,49.128-0.04,67.88c0.016,0.016,0.024,0.024,0.04,0.04 L354,30.076c-18.736-18.752-49.128-18.776-67.88-0.04C286.104,30.052,286.096,30.06,286.08,30.076z" />
    <g>
        <circle cx="256" cy="125" r="35" fill="#F59E0B" />
        <text x="256" y="142" fontFamily="Arial" fontSize="45" fontWeight="bold" fill="white" textAnchor="middle">$</text>
    </g>
  </svg>
);

const RateCard = ({ title, rate }: { title: string; rate: string }) => (
  <Card className="bg-white border-none shadow-md overflow-hidden rounded-xl flex flex-col items-center justify-center p-2">
    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{title}</p>
    <p className="text-sm font-black text-[#325E6A]">{rate}</p>
  </Card>
);

const NavButton = ({ icon: Icon, label, href }: { icon: any; label: string; href: string }) => (
  <Button asChild variant="outline" className="flex-1 bg-white border-none shadow-md h-10 rounded-xl text-[#325E6A] font-bold text-[9px] gap-0.5 flex-col py-1 active:scale-95 transition-transform">
    <Link href={href}>
      <Icon className="h-4 w-4 text-orange-500" />
      {label.toUpperCase()}
    </Link>
  </Button>
);

export default function StarlineGamesPage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { appSettings } = useSettingsStore();
  const { starlineGames: games } = useGameStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (games.length > 0 || true) {
        setLoading(false);
    }
  }, [games]);

  const totalBalance = (currentUser?.balance || 0) + (currentUser?.bonusBalance || 0);

  const isGameRunning = (timeStr: string) => {
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    
    const parts = timeStr.split(' ');
    if (parts.length < 2) return false;
    const timeParts = parts[0].split(':');
    let hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1] || '0');
    const modifier = parts[1].toUpperCase();
    
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    
    const gameMinutes = hours * 60 + minutes;
    return currentTotalMinutes < (gameMinutes - 15);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      
      <div className="sticky top-0 z-50 bg-header shadow-xl">
        <header className="w-full p-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-black tracking-widest uppercase">KALYAN 777 Starline</h1>
          </div>
          <Button variant="outline" className="bg-white/20 border-white/20 text-white rounded-full h-8 px-3 gap-1 pointer-events-none">
            <CustomWalletIcon className="h-5 w-5" />
            <span className="font-black">{totalBalance.toFixed(0)}</span>
          </Button>
        </header>

        <div className="px-4 pb-3 space-y-3">
          <div className="flex gap-2">
            <NavButton icon={History} label="Bid History" href="/starline/bid-history" />
            <NavButton icon={Trophy} label="Win Report" href="/starline/win-history" />
            <NavButton icon={BarChart2} label="Chart" href="/starline/charts" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <RateCard title="Single Digit" rate={`10 - ${appSettings.starlineRateSingleDigit || 100}`} />
            <RateCard title="Single Pana" rate={`10 - ${appSettings.starlineRateSinglePana || 1500}`} />
            <RateCard title="Double Pana" rate={`10 - ${appSettings.starlineRateDoublePana || 3000}`} />
            <RateCard title="Triple Pana" rate={`10 - ${appSettings.starlineRateTriplePana || 7000}`} />
          </div>
        </div>
      </div>

      <main className="flex-1 p-4 space-y-3 pb-10 flex flex-col">
        {loading ? (
          <div className="flex justify-center py-20"><Loader className="h-10 w-10 text-primary" /></div>
        ) : games.length === 0 ? (
          <p className="text-center text-gray-400 py-20">No games scheduled for today.</p>
        ) : (
          games.map((game) => {
            const running = isGameRunning(game.time);
            const displayDigit = game.digit === 'NaN' || !game.digit ? '*' : game.digit;
            const displayPanna = game.panna === 'NaN' || !game.panna ? '***' : game.panna;

            return (
              <Card key={game.id} className="bg-white rounded-2xl border-none shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 shrink-0">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="inline-flex">
                      <span className="bg-[#154c79] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                        KALYAN 777 <span className="text-yellow-400">STARLINE</span>
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-gray-800 leading-tight">{game.time}</span>
                      <span className={cn(
                        "text-[9px] font-bold uppercase",
                        running ? "text-green-500" : "text-red-500"
                      )}>
                        {running ? "Running Now" : "Closed for today"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="bg-gray-800 text-white px-3 py-1 rounded-full font-black tracking-[0.15em] text-xs shadow-inner">
                      {displayPanna} - {displayDigit}
                    </div>
                  </div>

                  <Button 
                    size="icon" 
                    className={cn(
                      "h-10 w-10 rounded-full shadow-md transition-transform active:scale-90 border-none",
                      running 
                        ? "bg-gradient-to-br from-yellow-400 to-orange-500 hover:opacity-90" 
                        : "bg-gray-200 text-gray-400 pointer-events-none"
                    )}
                    onClick={() => running && router.push(`/play-starline/${game.id}`)}
                  >
                    {running ? <Play className="h-5 w-5 fill-white text-white" /> : <X className="h-5 w-5" />}
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
