'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader } from '@/components/loader';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, History } from 'lucide-react';
import { format } from 'date-fns';

export default function StarlineBidHistoryPage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    // Use a simple query to avoid composite index requirements
    const q = query(
      collection(db, 'bids'),
      where('userId', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allUserBids = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter and sort on the client side to avoid missing index errors
      const starlineBids = allUserBids
        .filter((bid: any) => bid.gameName === 'KALYAN 777 STARLINE')
        .sort((a: any, b: any) => {
          const timeA = a.createdAt?.toMillis() || 0;
          const timeB = b.createdAt?.toMillis() || 0;
          return timeB - timeA;
        });

      setBids(starlineBids);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching Starline bids:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-50 w-full p-4 flex items-center gap-4 text-white bg-header">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-bold flex items-center gap-2">
          <History className="h-5 w-5" />
          KALYAN 777 Starline Bid History
        </h1>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20"><Loader className="h-10 w-10 text-primary" /></div>
        ) : bids.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p>No bids found for KALYAN 777 Starline games.</p>
          </div>
        ) : (
          bids.map((bid) => (
            <Card key={bid.id} className="overflow-hidden shadow-sm border-none">
              <CardHeader className="bg-muted/30 p-3 flex flex-row justify-between items-center">
                <span className="text-xs font-bold text-blue-900">{bid.gameName} - {bid.session}</span>
                <Badge variant={bid.status === 'won' ? 'secondary' : bid.status === 'lost' ? 'destructive' : 'default'} className="text-[10px]">
                  {bid.status.toUpperCase()}
                </Badge>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Number</p>
                    <p className="font-bold text-sm">{bid.numbers.join(', ')}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Points</p>
                    <p className="font-bold text-sm">₹{bid.totalAmount}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Date</p>
                    <p className="text-[10px] font-medium">
                      {bid.createdAt?.toDate ? format(bid.createdAt.toDate(), 'dd MMM, hh:mm a') : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
