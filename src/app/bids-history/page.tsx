
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import { collection, query, where, orderBy, onSnapshot, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Loader } from '@/components/loader';
import { Badge } from '@/components/ui/badge';
import type { Bid } from '@/lib/types';
import { betTypes } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Footer } from '@/components/layout/footer';
import { format } from 'date-fns';
import Link from 'next/link';


const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'N/A';
    // Format: 10/09/2025, 01:57 am
    return new Date(timestamp.seconds * 1000).toLocaleString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
    }).replace(',', ',');
};

const getStatusInfo = (status: Bid['status']): { text: string, variant: "default" | "destructive" | "secondary" | "outline" } => {
    switch (status) {
        case 'running':
            return { text: 'Running', variant: 'default' };
        case 'won':
            return { text: 'You Won', variant: 'secondary' };
        case 'lost':
            return { text: 'Lost', variant: 'destructive' };
        case 'cancelled':
            return { text: 'Cancelled', variant: 'outline' };
        default:
            return { text: 'Status Unknown', variant: 'default' };
    }
};

const ITEMS_PER_PAGE = 10;

export default function BidsHistoryPage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());


  const fetchBids = useCallback(() => {
    if (!currentUser) {
        setLoading(false);
        return () => {}; // Return an empty unsubscribe function
    }

    setLoading(true);

    let bidsQuery = query(
      collection(db, "bids"), 
      where("userId", "==", currentUser.id)
    );
    
    const unsubscribe = onSnapshot(bidsQuery, (querySnapshot) => {
        const bidsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bid));
        // Sort on the client side
        bidsData.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });
        setBids(bidsData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching bids: ", error);
        setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = fetchBids();
    return () => unsubscribe();
  }, [fetchBids]);

  const filteredBids = useMemo(() => {
    let filtered = bids;
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        filtered = filtered.filter(t => t.createdAt && new Date(t.createdAt.seconds * 1000) >= start);
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        filtered = filtered.filter(t => t.createdAt && new Date(t.createdAt.seconds * 1000) <= end);
    }
    return filtered;
  }, [bids, startDate, endDate]);

  const totalPages = Math.ceil(filteredBids.length / ITEMS_PER_PAGE) || 1;

  const paginatedBids = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBids.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredBids, currentPage]);

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
        <div className="container mx-auto px-4 py-4 mt-auto">
            <div className="flex justify-between items-center text-sm">
                <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p-1))}
                    disabled={currentPage === 1}
                    className="bg-gray-200 border-gray-300 shadow-sm"
                >
                    {'<<'} Previous
                </Button>
                <span className="font-medium text-gray-600">{currentPage}/{totalPages}</span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))}
                    disabled={currentPage === totalPages}
                    className="bg-gray-200 border-gray-300 shadow-sm"
                >
                    Next {'>>'}
                </Button>
            </div>
        </div>
    );
  };


  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 w-full border-b bg-header text-white">
        <div className="container flex h-16 items-center justify-center">
          <h1 className="font-bold text-lg">My Bids</h1>
        </div>
      </header>
      <main className="flex-1 p-4 pb-20">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="start-date" className="text-xs font-medium text-gray-700 mb-1 block">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="start-date" variant={"outline"} className={cn("w-full justify-start text-left font-normal h-10",!startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd-MM-yy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus/></PopoverContent>
                </Popover>
              </div>
              <div>
                <label htmlFor="end-date" className="text-xs font-medium text-gray-700 mb-1 block">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="end-date" variant={"outline"} className={cn("w-full justify-start text-left font-normal h-10", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd-MM-yy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={{ before: startDate }} initialFocus/></PopoverContent>
                </Popover>
              </div>
            </div>
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader className="h-10 w-10 text-primary" />
                </div>
            ) : paginatedBids.length === 0 ? (
                 <div className="text-center text-gray-500 py-20">
                    <p className="text-lg">No Bids Found</p>
                    <p className="text-sm">You haven't placed any bids yet for the selected date range.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {paginatedBids.map(bid => {
                        const statusInfo = getStatusInfo(bid.status);
                        return (
                        <Card key={bid.id} className={cn("bg-white shadow-md overflow-hidden rounded-lg", bid.status === 'won' && 'animate-won-glow')}>
                           <CardHeader className="p-0">
                             <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-white text-center py-1">
                                <p className="font-semibold text-xs">{bid.gameName} ({bid.session})</p>
                             </div>
                           </CardHeader>
                           <CardContent className="p-2 space-y-1">
                               <div className="grid grid-cols-3 text-center">
                                   <div>
                                       <p className="text-[10px] text-gray-500">Game Type</p>
                                       <p className="font-bold text-[11px]">{betTypes[bid.betType]}</p>
                                   </div>
                                   <div>
                                       <p className="text-[10px] text-gray-500">Digit</p>
                                       <p className="font-bold text-[11px]">{bid.numbers.join(', ')}</p>
                                   </div>
                                   <div>
                                       <p className="text-[10px] text-gray-500">Points</p>
                                       <p className="font-bold text-[11px]">{bid.totalAmount}</p>
                                   </div>
                               </div>
                                <div className="border-t pt-1 text-center text-[9px] text-gray-500">
                                   Transaction: {formatDate(bid.createdAt)}
                                </div>
                           </CardContent>
                           <CardFooter className="p-1 pt-0 flex justify-center">
                                <Badge 
                                    variant={statusInfo.variant} 
                                    className={cn(
                                        "text-xs",
                                        bid.status === 'running' && "bg-orange-500 text-white",
                                        bid.status === 'won' && "bg-green-500 text-white"
                                    )}
                                >
                                    {statusInfo.text}
                                </Badge>
                           </CardFooter>
                        </Card>
                    )})}
                </div>
            )}
            {renderPagination()}
      </main>
      <Footer />
    </div>
  );
}
