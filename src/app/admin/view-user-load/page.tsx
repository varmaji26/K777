'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, DocumentData, query, orderBy, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader } from '@/components/loader';
import { User, Calendar as CalendarIcon, Search, Play, XCircle, Info, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { betTypes as betTypeLabels } from '@/lib/types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF with autoTable for TypeScript
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface Game extends DocumentData {
    id: string;
    name: string;
}

interface Bid extends DocumentData {
    gameId: string;
    gameName: string;
    betType: string;
    session: string;
    numbers: string[];
    totalAmount: number;
    status: string;
    displayName: string;
    mobile: string;
}

interface GroupedLoadItem {
    number: string;
    amount: number;
    gameName: string;
}

interface GroupedLoad {
    label: string;
    total: number;
    items: GroupedLoadItem[];
}

export default function ViewUserLoadPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    const fetchGames = async () => {
      const q = query(collection(db, "games"), orderBy("openTime", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setGames(data);
    };
    fetchGames();
  }, []);

  useEffect(() => {
    if (!selectedDate) {
        setAllBids([]);
        return;
    }
    setLoading(true);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const bidsQuery = query(
        collection(db, 'bids'), 
        where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
        where('createdAt', '<=', Timestamp.fromDate(endOfDay))
    );

    const unsubscribe = onSnapshot(bidsQuery, (snapshot) => {
      const bidsData = snapshot.docs
        .map(doc => doc.data() as Bid)
        .filter(bid => bid.status !== 'cancelled');
      setAllBids(bidsData);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching bids: ", error);
        setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  const filteredBids = useMemo(() => {
    let filtered = allBids;
    
    if (selectedGameId !== 'all') {
        filtered = filtered.filter(bid => bid.gameId === selectedGameId);
    }

    if (userSearch.trim()) {
        const term = userSearch.toLowerCase().trim();
        filtered = filtered.filter(bid => 
            bid.displayName?.toLowerCase().includes(term) || 
            bid.mobile?.includes(term)
        );
    } else {
        return [];
    }

    return filtered;
  }, [allBids, userSearch, selectedGameId]);

  const sessionData = useMemo(() => {
    const openBids = filteredBids.filter(b => b.session === 'Open');
    const closeBids = filteredBids.filter(b => b.session === 'Close');

    const process = (bids: Bid[]) => {
        const total = bids.reduce((acc, b) => acc + Number(b.totalAmount || 0), 0);
        
        const typeDefinitions = [
            { label: 'SINGLE DIGIT', keys: ['singleDigit', 'singleDigitBulk'], color: 'green' },
            { label: 'JODI DIGIT', keys: ['jodiDigit'], color: 'blue' },
            { label: 'PANAS (SINGLE/DOUBLE/TRIPLE)', keys: ['singlePana', 'doublePana', 'triplePana', 'singlePanaBulk', 'doublePanaBulk', 'spDpTp', 'spMotor', 'dpMotor'], color: 'orange' },
            { label: 'SANGAM (HALF/FULL)', keys: ['halfSangam', 'fullSangam'], color: 'purple' },
        ];

        const grouped: GroupedLoad[] = typeDefinitions.map(def => {
            const filtered = bids.filter(b => def.keys.includes(b.betType));
            const subTotal = filtered.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
            
            // Map to store item details
            const itemMap: { [key: string]: GroupedLoadItem } = {};

            filtered.forEach(bid => {
                const amountPerNum = Number(bid.totalAmount || 0) / (bid.numbers?.length || 1);
                bid.numbers?.forEach(num => {
                    const baseNum = bid.betType === 'halfSangam' || bid.betType === 'fullSangam' ? `${num} (${betTypeLabels[bid.betType as keyof typeof betTypeLabels]})` : num;
                    
                    // Create a unique key for grouping (Number + GameName)
                    const uniqueKey = `${baseNum}_${bid.gameName}`;
                    
                    if (!itemMap[uniqueKey]) {
                        itemMap[uniqueKey] = {
                            number: baseNum,
                            amount: 0,
                            gameName: bid.gameName
                        };
                    }
                    itemMap[uniqueKey].amount += amountPerNum;
                });
            });

            return { 
                label: def.label, 
                total: subTotal, 
                items: Object.values(itemMap).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })) 
            };
        });

        return { total, grouped };
    };

    return {
        open: process(openBids),
        close: process(closeBids)
    };
  }, [filteredBids]);

  const handleDownloadPDF = () => {
    if (filteredBids.length === 0) {
        toast({ title: "No Data", description: "No bids found to download.", variant: "destructive" });
        return;
    }

    const doc = new jsPDF();
    const dateStr = selectedDate ? format(selectedDate, "dd-MM-yyyy") : 'All Time';
    const userStr = userSearch || 'All Users';
    const gameStr = selectedGameId === 'all' ? 'All Markets' : games.find(g => g.id === selectedGameId)?.name || '';

    // Title
    doc.setFontSize(16);
    doc.text("User-wise Detailed Load Report", 14, 15);
    
    // Sub-info
    doc.setFontSize(10);
    doc.text(`User: ${userStr}`, 14, 22);
    doc.text(`Date: ${dateStr}`, 14, 27);
    doc.text(`Market Filter: ${gameStr}`, 14, 32);
    doc.text(`Total Combined Load: Rs. ${Number(sessionData.open.total + sessionData.close.total).toFixed(0)}`, 14, 37);

    const tableColumn = ["Session", "Category", "Market", "Number", "Amount"];
    const tableRows: any[] = [];

    // Process Open Session
    sessionData.open.grouped.forEach(group => {
        group.items.forEach(item => {
            tableRows.push([
                "OPEN",
                group.label,
                item.gameName,
                item.number,
                `Rs. ${item.amount.toFixed(0)}`
            ]);
        });
    });

    // Process Close Session
    sessionData.close.grouped.forEach(group => {
        group.items.forEach(item => {
            tableRows.push([
                "CLOSE",
                group.label,
                item.gameName,
                item.number,
                `Rs. ${item.amount.toFixed(0)}`
            ]);
        });
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [21, 76, 121] },
        alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`user_load_${userStr.replace(/\s+/g, '_')}_${dateStr}.pdf`);
    toast({ title: "Success", description: "PDF Report downloaded successfully." });
  };

  const renderLoadGroup = (group: GroupedLoad, colorClass: string) => {
    if (group.total === 0) return null;

    const isSingleDigit = group.label === 'SINGLE DIGIT';

    return (
        <Card key={group.label} className="border-none shadow-md overflow-hidden bg-white">
            <CardHeader className={cn("p-3 flex flex-row justify-between items-center", `bg-${colorClass}-50`)}>
                <CardTitle className={cn("text-[11px] font-black uppercase tracking-wider", `text-${colorClass}-700`)}>
                    {group.label}
                </CardTitle>
                <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", `bg-${colorClass}-100 text-${colorClass}-700 border-${colorClass}-200`)}>
                    TOTAL: ₹{group.total.toFixed(0)}
                </div>
            </CardHeader>
            <CardContent className="p-3">
                <div className={cn(
                    "grid gap-2",
                    isSingleDigit ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
                )}>
                    {group.items.map((item, idx) => (
                        <div key={idx} className={cn(
                            "bg-slate-50 border border-slate-100 rounded-lg p-2 flex",
                            isSingleDigit ? "flex-row justify-between items-center px-4 py-3" : "flex-col items-center justify-center text-center"
                        )}>
                            <p className="text-[8px] font-black text-slate-400 uppercase truncate mb-1 tracking-tighter" title={item.gameName}>
                                {item.gameName}
                            </p>
                            <p className="text-sm font-black text-slate-800 leading-none">
                                {item.number}-<span className={cn(`text-${colorClass}-600`)}>₹{item.amount.toFixed(0)}</span>
                            </p>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
  };

  return (
    <main className="container mx-auto px-4 py-8 flex-1">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card className="border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-[#1e638f] to-[#154c79] text-white p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                        <User className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold">User-wise Detailed Load Report</CardTitle>
                        <CardDescription className="text-blue-100">See Digits, Panas, and Jodis categorized with market names.</CardDescription>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 h-11 px-4 rounded-xl"
                    onClick={handleDownloadPDF}
                    disabled={filteredBids.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
              </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Search User</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Name or Mobile Number..." 
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className="pl-9 h-11 rounded-xl border-gray-100 bg-gray-50 focus:bg-white transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Market Date</label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full h-11 justify-start rounded-xl border-gray-100 bg-gray-50", !selectedDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4 text-blue-900" />
                                {selectedDate ? format(selectedDate, "dd MMM, yyyy") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus /></PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Filter by Market</label>
                    <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                        <SelectTrigger className="h-11 rounded-xl border-gray-100 bg-gray-50">
                            <SelectValue placeholder="All Markets" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Markets Combined</SelectItem>
                            {games.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
            <div className="flex justify-center py-20"><Loader className="h-12 w-12 text-primary" /></div>
        ) : !userSearch ? (
            <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-muted-foreground flex flex-col items-center gap-4">
                <Search className="h-12 w-12 opacity-20" />
                <p className="font-bold text-lg">रिपोर्ट देखने के लिए यूजर का नाम या मोबाइल नंबर डालें।</p>
            </div>
        ) : (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                {/* Summary Section */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="bg-white border-none shadow-lg rounded-2xl p-4 flex flex-col justify-center">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Combined Total Load</p>
                        <p className="text-3xl font-black text-blue-900">₹{Number(sessionData.open.total + sessionData.close.total).toFixed(0)}</p>
                    </Card>
                    <Card className="bg-green-50 border-none shadow-lg rounded-2xl p-4">
                        <p className="text-[10px] font-bold text-green-600 uppercase mb-1 flex items-center gap-1"><Play className="h-3 w-3 fill-green-600" /> Open Load</p>
                        <p className="text-3xl font-black text-green-700">₹{Number(sessionData.open.total).toFixed(0)}</p>
                    </Card>
                    <Card className="bg-red-50 border-none shadow-lg rounded-2xl p-4">
                        <p className="text-[10px] font-bold text-red-600 uppercase mb-1 flex items-center gap-1"><XCircle className="h-3 w-3 fill-red-600" /> Close Load</p>
                        <p className="text-3xl font-black text-red-700">₹{Number(sessionData.close.total).toFixed(0)}</p>
                    </Card>
                </div>

                {/* Open Session Details */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-green-700 flex items-center gap-2 border-b-2 border-green-100 pb-2 uppercase tracking-tight">
                        <Play className="h-5 w-5 fill-green-700" />
                        OPEN SESSION LOAD (अंक, पाना, संगम)
                    </h2>
                    <div className="space-y-4">
                        {sessionData.open.grouped.some(g => g.total > 0) ? (
                            sessionData.open.grouped.map((group) => {
                                if (group.label === 'SINGLE DIGIT') return renderLoadGroup(group, 'green');
                                if (group.label.includes('PANAS')) return renderLoadGroup(group, 'orange');
                                if (group.label.includes('SANGAM')) return renderLoadGroup(group, 'purple');
                                return renderLoadGroup(group, 'slate');
                            })
                        ) : (
                            <div className="py-8 text-center text-muted-foreground text-sm font-medium bg-white rounded-xl border border-dashed border-gray-200">
                                Open में कोई बिड नहीं मिली।
                            </div>
                        )}
                    </div>
                </div>

                {/* Close Session Details */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-red-700 flex items-center gap-2 border-b-2 border-red-100 pb-2 uppercase tracking-tight">
                        <XCircle className="h-5 w-5 fill-red-700 text-white" />
                        CLOSE SESSION LOAD (अंक, जोड़ी, पाना)
                    </h2>
                    <div className="space-y-4">
                        {sessionData.close.grouped.some(g => g.total > 0) ? (
                            sessionData.close.grouped.map((group) => {
                                if (group.label === 'SINGLE DIGIT') return renderLoadGroup(group, 'red');
                                if (group.label === 'JODI DIGIT') return renderLoadGroup(group, 'blue');
                                if (group.label.includes('PANAS')) return renderLoadGroup(group, 'orange');
                                return renderLoadGroup(group, 'slate');
                            })
                        ) : (
                            <div className="py-8 text-center text-muted-foreground text-sm font-medium bg-white rounded-xl border border-dashed border-gray-200">
                                Close में कोई बिड नहीं मिली।
                            </div>
                        )}
                    </div>
                </div>

                {filteredBids.length === 0 && userSearch && (
                    <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <Info className="h-10 w-10 text-blue-200 mx-auto mb-2" />
                        <p className="text-gray-500 font-bold">चयनित तिथि और यूजर के लिए कोई डेटा नहीं है।</p>
                    </div>
                )}
            </div>
        )}
      </div>
    </main>
  );
}
