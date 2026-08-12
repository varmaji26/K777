'use client';
import { useState, useEffect, useMemo } from 'react';
import type { Game } from '@/lib/types';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Clock, PlayCircle, BarChart2, Play, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn, formatTime, isGameRunning, getGameRunningStatus, getSessionStatus } from '@/lib/utils';
import { Button } from './ui/button';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import Image from 'next/image';
import { useGameStore } from '@/lib/store';
import { Skeleton } from './ui/skeleton';

interface GameCardProps {
  game: Game;
}

const getResultDisplay = (game: Game): string => {
    const sumDigits = (pana: string) => {
        if (!pana || typeof pana !== 'string' || pana.length !== 3 || !/^\d+$/.test(pana)) {
            return '*';
        }
        return (pana.split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0) % 10).toString();
    };

    const openPana = game.openResult || '***';
    const closePana = game.closeResult || '**';

    if (openPana === '***') {
        return '***-**-***';
    }
    
    if (closePana === '**' || closePana === '***') {
        const openJodi = sumDigits(openPana);
        return `${openPana}-${openJodi}*-***`;
    }
    
    const openJodi = sumDigits(openPana);
    const closeJodi = sumDigits(closePana);
    
    return `${openPana}-${openJodi}${closeJodi}-${closePana}`;
};


export function GameCard({ game }: GameCardProps) {
  const [isOpenActive, setIsOpenActive] = useState(false);
  const [isCloseActive, setIsCloseActive] = useState(false);
  const [showClosedDialog, setShowClosedDialog] = useState(false);
  const [suggestedGame, setSuggestedGame] = useState<Game | null>(null);
  const [dialogMessage, setDialogMessage] = useState("Bidding for this market is currently closed.");
  const router = useRouter();
  const marketOpenTime = useGameStore((state) => state.marketOpenTime);
  const allGames = useGameStore((state) => state.games);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);


  useEffect(() => {
    if (!hasMounted) return;
    
    const checkTime = () => {
      const openRunning = getSessionStatus(game, marketOpenTime, 'Open');
      const closeRunning = getSessionStatus(game, marketOpenTime, 'Close');
      setIsOpenActive(openRunning);
      setIsCloseActive(closeRunning);

      if (openRunning || closeRunning) {
        router.prefetch(`/play/${game.id}?session=${openRunning ? 'Open' : 'Close'}`);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 30000);

    return () => clearInterval(interval);
  }, [game, marketOpenTime, hasMounted, router]);

  const handlePlayClick = (e: React.MouseEvent, session: 'Open' | 'Close') => {
    e.preventDefault();
    const isSessionRunning = getSessionStatus(game, marketOpenTime, session);

    if (isSessionRunning) {
      router.push(`/play/${game.id}?session=${session}`);
    } else {
      const gameStatus = getGameRunningStatus(game, marketOpenTime);
      const message = typeof gameStatus === 'string' ? gameStatus : `Bidding for ${session} session is currently closed.`;
      
      const runningGames = allGames.filter(g => g.id !== game.id && isGameRunning(g, marketOpenTime));
      if (runningGames.length > 0) {
        const randomIndex = Math.floor(Math.random() * runningGames.length);
        setSuggestedGame(runningGames[randomIndex]);
      } else {
        setSuggestedGame(null);
      }
      setDialogMessage(message);
      setShowClosedDialog(true);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
        setShowClosedDialog(false);
    }
  };
  
  const handleSuggestionClick = () => {
    setShowClosedDialog(false);
  };

  if (!hasMounted) {
    return <Skeleton className="h-[142px] w-full rounded-lg" />;
  }
  
  const result = getResultDisplay(game);
  const runningOverall = isGameRunning(game, marketOpenTime);

  const sorryFaceSVG = `<svg width="500" height="500" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">   <defs>     <radialGradient id="faceGradient" cx="50%" cy="40%" r="60%">       <stop offset="0%" style="stop-color:#FFF9AD" />       <stop offset="70%" style="stop-color:#FFD700" />       <stop offset="100%" style="stop-color:#FF8C42" />     </radialGradient> <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%"> <feDropShadow dx="5" dy="5" stdDeviation="8" flood-color="#000000" flood-opacity="0.3"/> </filter>   </defs>      <circle cx="250" cy="250" r="200" fill="url(#faceGradient)" filter="url(#drop-shadow)"/>      <circle cx="130" cy="290" r="35" fill="#FF9E00" fill-opacity="0.6" />   <circle cx="370" cy="290" r="35" fill="#FF9E00" fill-opacity="0.6" />      <path d="M160 235 C 160 235, 185 200, 215 235" stroke="#333" stroke-width="10" stroke-linecap="round" fill="none" />      <path d="M285 235 C 285 235, 315 200, 340 235" stroke="#333" stroke-width="10" stroke-linecap="round" fill="none" />      <path d="M180 340 C 180 340, 250 290, 320 340" stroke="#333" stroke-width="12" stroke-linecap="round" fill="none" />      <ellipse cx="210" cy="120" rx="60" ry="30" fill="white" fill-opacity="0.3" transform="rotate(-20, 210, 120)" /> </svg>`;

  return (
    <>
    <div className={cn("rounded-lg", runningOverall ? "animated-border-card" : "shadow-md")}>
      <Card className="h-full w-full rounded-lg">
          <CardContent className="p-3 space-y-2">
              <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-center w-full">
                          <p className="font-bold text-base text-[#325E6A]">{game.name.toUpperCase()}</p>
                          <div className="flex items-center gap-3 shrink-0 text-right">
                              <div className="flex items-center gap-1.5">
                                  <div className="text-right">
                                    <p className="font-bold text-[11px] text-[#325E6A] leading-tight">{formatTime(game.openTime)}</p>
                                    <p className="text-[9px] text-[#325E6A] opacity-60 font-bold uppercase">Open</p>
                                  </div>
                                  <Clock className="h-3.5 w-3.5 text-green-500" />
                              </div>
                              <div className="flex items-center gap-1.5">
                                  <div className="text-right">
                                    <p className="font-bold text-[11px] text-[#325E6A] leading-tight">{formatTime(game.closeTime)}</p>
                                    <p className="text-[9px] text-[#325E6A] opacity-60 font-bold uppercase">Close</p>
                                  </div>
                                  <Clock className="h-3.5 w-3.5 text-red-500" />
                              </div>
                          </div>
                      </div>
                      <div className="flex items-center justify-between w-full pr-2">
                          <div className="bg-gray-100 border border-gray-300 rounded-md px-2 py-0.5 inline-block shadow-md">
                              <p className="text-orange-600 font-bold text-base tracking-wider">{result}</p>
                          </div>
                          <div className={cn(
                              "font-black text-[9px] uppercase px-1.5 py-0.5 rounded border h-fit shrink-0",
                              runningOverall ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"
                          )}>
                              {runningOverall ? "Running" : "Closed"}
                          </div>
                      </div>
                  </div>
              </div>

              <div className="flex items-center justify-around gap-2 pt-2 border-t">
                  <div className="flex flex-col items-center">
                      <div className="h-[46px] w-[46px] rounded-full bg-white flex items-center justify-center p-1 shadow-md">
                        <button 
                            onClick={(e) => handlePlayClick(e, 'Open')} 
                            className={cn(
                            "h-full w-full rounded-full flex items-center justify-center transition-all active:scale-90",
                            isOpenActive 
                            ? "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-md" 
                            : "bg-gray-200 border-2 border-gray-100"
                        )}>
                           <PlayCircle className={cn("h-7 w-7", isOpenActive ? "text-white" : "text-gray-400")} />
                        </button>
                      </div>
                      <span className="text-[11px] font-bold mt-1 text-[#325E6A]">OPEN</span>
                  </div>

                  <div className="flex flex-col items-center">
                      <div className="h-[46px] w-[46px] rounded-full bg-white flex items-center justify-center p-1 shadow-md">
                        <Link href={`/charts/panel/${game.id}`} className="h-full w-full rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center transition-transform active:scale-90">
                           <BarChart2 className="h-6 w-6 text-white" />
                        </Link>
                      </div>
                      <span className="text-[11px] font-bold mt-1 text-[#325E6A]">CHART</span>
                  </div>

                  <div className="flex flex-col items-center">
                      <div className="h-[46px] w-[46px] rounded-full bg-white flex items-center justify-center p-1 shadow-md">
                        <button 
                            onClick={(e) => handlePlayClick(e, 'Close')} 
                            className={cn(
                            "h-full w-full rounded-full flex items-center justify-center transition-all active:scale-90",
                            isCloseActive 
                            ? "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-md" 
                            : "bg-gray-200 border-2 border-gray-100"
                        )}>
                           <PlayCircle className={cn("h-7 w-7", isCloseActive ? "text-white" : "text-gray-400")} />
                        </button>
                      </div>
                      <span className="text-[11px] font-bold mt-1 text-[#325E6A]">CLOSE</span>
                  </div>
              </div>
          </CardContent>
      </Card>
    </div>
     <Dialog open={showClosedDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="p-0 border-none overflow-visible bg-transparent shadow-none max-w-xs sm:max-w-xs">
          <div className="relative pt-16 text-center bg-white rounded-xl shadow-2xl border border-orange-500 shadow-orange-600/75">
             <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                <Image src={`data:image/svg+xml;utf8,${encodeURIComponent(sorryFaceSVG)}`} alt="disappointed face" width={140} height={140} />
            </div>
            <DialogHeader className="px-4 pb-2">
              <DialogTitle className="text-xl font-extrabold text-orange-500 text-center">Sorry!</DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {dialogMessage}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="px-4 pb-4 justify-center">
              <Button
                onClick={handleSuggestionClick}
                className="w-full h-8 rounded-full bg-gradient-to-b from-yellow-400 to-orange-500 text-white font-bold text-xs shadow-lg hover:from-yellow-500 hover:to-orange-600 border-yellow-400"
              >
                {suggestedGame ? `Try ${suggestedGame.name.toUpperCase()} Market` : 'OK'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
