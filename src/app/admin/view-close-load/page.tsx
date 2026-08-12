'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, DocumentData, query, orderBy, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader } from '@/components/loader';
import { Play, Calendar as CalendarIcon, Gamepad2, Copy, Search, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { betTypes as betTypeLabels } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface Game extends DocumentData {
    id: string;
    name: string;
}

interface Bid extends DocumentData {
    gameId: string;
    betType: string;
    session: string;
    numbers: string[];
    totalAmount: number;
    status: string;
    displayName: string;
    mobile: string;
}

interface GameLoad {
    id: string;
    name: string;
    totalLoad: number;
}

interface LiveBiddingDetails {
    gameName: string;
    betTypeKey: string;
    betLabel: string;
    totalLoad: number;
    numberLoads: { [key: string]: number };
}

export default function ViewCloseLoadPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [allCloseBids, setAllCloseBids] = useState<Bid[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true);
      const gamesQuery = query(collection(db, "games"), orderBy("openTime", "asc"));
      const gamesSnapshot = await getDocs(gamesQuery);
      const gamesData: Game[] = gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setGames(gamesData);
      if (gamesData.length > 0) {
        setSelectedGame(gamesData[0]); 
      }
      setLoading(false);
    };
    fetchGames();
  }, []);

  useEffect(() => {
    if (!selectedDate) {
        setAllCloseBids([]);
        return;
    }
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const bidsQuery = query(
        collection(db, 'bids'), 
        where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
        where('createdAt', '<=', Timestamp.fromDate(endOfDay))
    );

    const unsubscribe = onSnapshot(bidsQuery, (bidsSnapshot) => {
      const bidsData: Bid[] = bidsSnapshot.docs.map(doc => doc.data() as Bid);
      const closeBids = bidsData.filter(bid => bid.session === 'Close' && bid.status !== 'cancelled');
      setAllCloseBids(closeBids);
    }, (error) => {
        console.error("Error fetching close bids for selected date: ", error);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  // Filter bids by user search term
  const filteredBids = useMemo(() => {
    if (!userSearch.trim()) return allCloseBids;
    const term = userSearch.toLowerCase().trim();
    return allCloseBids.filter(bid => 
        bid.displayName?.toLowerCase().includes(term) || 
        bid.mobile?.includes(term)
    );
  }, [allCloseBids, userSearch]);

  const gameLoads = useMemo(() => {
    if (games.length === 0) return [];
    return games.map(game => {
      const gameBids = filteredBids.filter(bid => bid.gameId === game.id);
      const totalLoad = gameBids.reduce((acc, bid) => acc + Number(bid.totalAmount || 0), 0);
      return { id: game.id, name: game.name, totalLoad };
    });
  }, [games, filteredBids]);
  
  const liveBiddingDetails = useMemo(() => {
      if (!selectedGame) return [];

      const gameBids = filteredBids.filter(bid => bid.gameId === selectedGame.id);
      
      const groups = [
        { label: 'SINGLE DIGIT', keys: ['singleDigit', 'singleDigitBulk'] },
        { label: 'JODI DIGIT', keys: ['jodiDigit'] },
        { label: 'SINGLE PANA', keys: ['singlePana', 'singlePanaBulk', 'spMotor'] },
        { label: 'DOUBLE PANA', keys: ['doublePana', 'doublePanaBulk', 'dpMotor'] },
        { label: 'TRIPLE PANA', keys: ['triplePana'] },
        { label: 'HALF SANGAM', keys: ['halfSangam'] },
        { label: 'FULL SANGAM', keys: ['fullSangam'] },
        { label: 'SP DP TP', keys: ['spDpTp'] },
      ];
      
      return groups.map(group => {
          const typeBids = gameBids.filter(b => group.keys.includes(b.betType));
          const totalLoad = typeBids.reduce((acc, bid) => acc + Number(bid.totalLoad || bid.totalAmount || 0), 0);
          
          const numberLoads: { [key: string]: number } = {};
          typeBids.forEach(bid => {
              const totalAmt = Number(bid.totalAmount || 0);
              const amountPerNumber = totalAmt / (bid.numbers?.length || 1);
              bid.numbers?.forEach(num => {
                  numberLoads[num] = (numberLoads[num] || 0) + amountPerNumber;
              });
          });

          return {
              gameName: selectedGame.name,
              betTypeKey: group.keys[0],
              betLabel: group.label,
              totalLoad,
              numberLoads
          };
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
        description: `${details.betLabel} list copied to clipboard.`,
    });
  };

  return (
    <main className="container mx-auto px-4 py-8 flex-1">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
              <CardTitle className="text-3xl font-bold">View Close Load</CardTitle>
              <CardDescription>View live bidding load for Close sessions. Use user search to see individual player bets.</CardDescription>
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "w-full sm:w-[180px] justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd MMM, yyyy") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                        />
                    </PopoverContent>
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
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader className="h-10 w-10 text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {gameLoads.map((game) => (
                  <button 
                      key={game.id} 
                      onClick={() => setSelectedGame(games.find(g => g.id === game.id) || null)}
                      className={cn(
                          "text-left rounded-lg transform transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary w-full",
                          "hover:shadow-primary/40 hover:shadow-lg",
                          selectedGame?.id === game.id ? "ring-2 ring-primary shadow-lg shadow-primary/30" : "shadow-md"
                      )}
                  >
                      <Card className="bg-white border-gray-200 shadow-lg h-full">
                          <CardContent className="p-4 text-center flex flex-col justify-between h-full">
                              <div className="flex justify-between items-start">
                                  <h3 className="text-lg font-bold text-blue-900 truncate">{game.name.toUpperCase()}</h3>
                              </div>
                              <p className="text-2xl font-semibold text-primary my-3">₹{Number(game.totalLoad || 0).toFixed(0)} /-</p>
                               <div className="flex justify-center items-center">
                                <div className="h-10 w-10 flex items-center justify-center rounded-full bg-primary/20 text-primary">
                                    <Gamepad2 className="h-6 w-6" />
                                </div>
                              </div>
                          </CardContent>
                      </Card>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedGame && (
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-red-700 border-b-2 border-red-100 pb-2 flex items-center gap-2">
                    <XCircle className="fill-red-700 h-5 w-5 text-white" />
                    DETAILS FOR: {selectedGame.name.toUpperCase()} (CLOSE)
                    {userSearch && <span className="text-sm bg-orange-100 text-orange-600 px-3 py-1 rounded-full font-bold ml-auto">USER FILTER ON</span>}
                </h2>
                {liveBiddingDetails.map((details) => (
                    (details.totalLoad > 0) && (
                    <Card key={details.betLabel} className="overflow-hidden border-none shadow-lg">
                    <CardHeader className="bg-primary/5 pb-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-base text-[#154c79] font-bold uppercase">
                                    {details.betLabel}
                                </CardTitle>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleCopy(details)}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">Total: ₹{Number(details.totalLoad || 0).toFixed(0)}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 bg-gray-50/50">
                        <div className={cn(
                            "grid gap-3",
                            details.betTypeKey === 'singleDigit' ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4 md:grid-cols-6"
                        )}>
                            {Object.entries(details.numberLoads)
                                .sort(([numA], [numB]) => numA.localeCompare(numB, undefined, { numeric: true }))
                                .map(([number, load]) => (
                                <div key={number} className={cn(
                                    "bg-white border-2 border-primary/10 rounded-xl shadow-sm hover:border-primary/30 transition-colors",
                                    details.betTypeKey === 'singleDigit' ? "flex justify-between items-center px-4 py-3" : "py-4 px-2 text-center"
                                )}>
                                    <span className="font-bold text-base text-blue-900 leading-tight">
                                        {number}-{details.betTypeKey === 'singleDigit' ? '' : ''}<span className="text-orange-500">₹{Number(load || 0).toFixed(0)}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    </Card>
                    )
                ))}

                {liveBiddingDetails.every(d => d.totalLoad === 0) && (
                    <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-muted-foreground flex flex-col items-center gap-2">
                        <Gamepad2 className="h-12 w-12 opacity-20" />
                        <p className="font-bold">इस मार्केट के लिए अभी कोई बिड नहीं लगी है।</p>
                    </div>
                )}
            </div>
        )}
      </div>
    </main>
  );
}
