'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, DocumentData, query, orderBy, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader } from '@/components/loader';
import { Star, Calendar as CalendarIcon, Gamepad2, Copy, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface StarlineGame extends DocumentData {
    id: string;
    time: string;
}

interface Bid extends DocumentData {
    gameId: string;
    betType: string;
    numbers: string[];
    totalAmount: number;
    gameName: string;
    status: string;
    displayName: string;
    mobile: string;
}

interface GameLoad {
    id: string;
    time: string;
    totalLoad: number;
}

interface LiveBiddingDetails {
    time: string;
    betType: string;
    totalLoad: number;
    numberLoads: { [key: string]: number };
}

export default function ViewStarlineLoadPage() {
  const [games, setGames] = useState<StarlineGame[]>([]);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedGame, setSelectedGame] = useState<StarlineGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    const fetchGames = async () => {
      const q = query(collection(db, "starlineGames"), orderBy("time", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StarlineGame));
      setGames(data);
      if (data.length > 0) setSelectedGame(data[0]);
    };
    fetchGames();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    
    const q = query(
        collection(db, 'bids'), 
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<=', Timestamp.fromDate(end))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bidsData = snapshot.docs
        .map(doc => doc.data() as Bid)
        .filter(bid => (bid.gameName === 'KALYAN 777 STARLINE' || bid.isStarline === true) && bid.status !== 'cancelled');
        
      setAllBids(bidsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching Starline bids:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  // Filter bids by user search term
  const filteredBids = useMemo(() => {
    if (!userSearch.trim()) return allBids;
    const term = userSearch.toLowerCase().trim();
    return allBids.filter(bid => 
        bid.displayName?.toLowerCase().includes(term) || 
        bid.mobile?.includes(term)
    );
  }, [allBids, userSearch]);

  const gameLoads = useMemo(() => {
    return games.map(game => {
      const gameBids = filteredBids.filter(bid => bid.gameId === game.id);
      return { 
        id: game.id, 
        time: game.time, 
        totalLoad: gameBids.reduce((acc, b) => acc + Number(b.totalAmount || 0), 0) 
      };
    });
  }, [games, filteredBids]);
  
  const liveBiddingDetails = useMemo(() => {
      if (!selectedGame) return [];
      const gameBids = filteredBids.filter(bid => bid.gameId === selectedGame.id);
      const types = ['singleDigit', 'singlePana', 'doublePana', 'triplePana'];
      
      return types.map(type => {
          const typeBids = gameBids.filter(b => b.betType === type);
          const totalLoad = typeBids.reduce((acc, bid) => acc + Number(bid.totalAmount || 0), 0);
          const numberLoads: { [key: string]: number } = {};
          
          typeBids.forEach(bid => {
              const totalAmt = Number(bid.totalAmount || 0);
              const amountPerNumber = totalAmt / (bid.numbers?.length || 1);
              bid.numbers?.forEach(num => {
                  numberLoads[num] = (numberLoads[num] || 0) + amountPerNumber;
              });
          });

          return { time: selectedGame.time, betType: type, totalLoad, numberLoads };
      });
  }, [selectedGame, filteredBids]);

  const handleCopy = (details: LiveBiddingDetails) => {
    const text = Object.entries(details.numberLoads)
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([number, load]) => `${number}-₹${Number(load || 0).toFixed(0)}`)
        .join('\n');
    
    navigator.clipboard.writeText(text);
    toast({
        title: "Copied!",
        description: `${details.betType} list copied to clipboard.`,
    });
  };

  return (
    <main className="container mx-auto px-4 py-8 flex-1">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
              <CardTitle className="text-3xl font-bold flex items-center gap-2">
                <Star className="text-orange-500 fill-orange-500" />
                KALYAN 777 Starline Load
              </CardTitle>
              <CardDescription>Select a slot to view load. Use user search to see individual player bets.</CardDescription>
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full sm:w-[180px] justify-start", !selectedDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd MMM, yyyy") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus /></PopoverContent>
                </Popover>

                <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search User Name or Number..." 
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-9 h-10 rounded-lg"
                    />
                </div>
              </div>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center py-10"><Loader /></div> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {gameLoads.map((game) => (
                  <Button 
                      key={game.id} 
                      variant={selectedGame?.id === game.id ? 'default' : 'outline'}
                      onClick={() => setSelectedGame(games.find(g => g.id === game.id) || null)}
                      className="h-auto py-3 flex-col gap-1 border-2"
                  >
                      <span className="font-bold text-xs">{game.time}</span>
                      <span className="text-sm">₹{Number(game.totalLoad || 0).toFixed(0)}</span>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedGame && (
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-orange-600 border-b-2 border-orange-100 pb-2 flex items-center gap-2">
                    <Star className="h-5 w-5 fill-orange-600" />
                    DETAILS FOR: {selectedGame.time}
                    {userSearch && <span className="text-sm bg-blue-100 text-blue-600 px-3 py-1 rounded-full font-bold ml-auto">USER FILTER ON</span>}
                </h2>
                {liveBiddingDetails.filter(d => d.totalLoad > 0).map((details) => (
                    <Card key={details.betType} className="overflow-hidden border-none shadow-lg">
                    <CardHeader className="bg-muted/30 pb-3 flex flex-row justify-between items-center">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-bold text-[#154c79] uppercase">{details.betType}</CardTitle>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleCopy(details)}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full font-bold">Total: ₹{Number(details.totalLoad || 0).toFixed(0)}</span>
                    </CardHeader>
                    <CardContent className="pt-4 bg-gray-50/50">
                        <div className={cn(
                            "grid gap-3",
                            details.betType === 'singleDigit' ? "grid-cols-1" : "grid-cols-4 sm:grid-cols-6 md:grid-cols-10"
                        )}>
                            {Object.entries(details.numberLoads)
                                .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                                .map(([number, load]) => (
                                <div key={number} className={cn(
                                    "bg-white border-2 border-primary/10 rounded-xl shadow-sm hover:border-primary/30 transition-colors",
                                    details.betType === 'singleDigit' ? "flex justify-between items-center px-4 py-3" : "py-4 px-2 text-center"
                                )}>
                                    <span className="font-bold text-base text-blue-900 leading-tight">
                                        {number}-{details.betType === 'singleDigit' ? '' : ''}<span className="text-orange-500">₹{Number(load || 0).toFixed(0)}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    </Card>
                ))}
                
                {liveBiddingDetails.every(d => d.totalLoad === 0) && (
                    <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-muted-foreground flex flex-col items-center gap-2">
                        <Star className="h-12 w-12 opacity-20" />
                        <p className="font-bold">इस स्लॉट के लिए अभी कोई बिड नहीं लगी है।</p>
                    </div>
                )}
            </div>
        )}
      </div>
    </main>
  );
}
