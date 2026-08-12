'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader } from '@/components/loader';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Trophy } from 'lucide-react';
import { format } from 'date-fns';

export default function JackpotWinHistoryPage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const [wins, setWins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'bids'),
      where('userId', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allUserBids = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter for Jackpot Wins and sort
      const jackpotWins = allUserBids
        .filter((bid: any) => (bid.isJackpot === true || bid.gameName === 'KALYAN 777 JACKPOT') && bid.status === 'won')
        .sort((a: any, b: any) => {
          const timeA = a.createdAt?.toMillis() || 0;
          const timeB = b.createdAt?.toMillis() || 0;
          return timeB - timeA;
        });

      setWins(jackpotWins);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching Jackpot wins:", error);
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
          <Trophy className="h-5 w-5 text-yellow-400" />
          KALYAN 777 Jackpot Win Report
        </h1>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20"><Loader className="h-10 w-10 text-primary" /></div>
        ) : wins.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p>No winning records found for KALYAN 777 Jackpot.</p>
          </div>
        ) : (
          wins.map((win) => (
            <Card key={win.id} className="overflow-hidden border-none shadow-md bg-white animate-won-glow">
              <div className="bg-green-600 text-white text-center py-1 px-3 flex justify-between items-center">
                <span className="text-[10px] font-bold">CONGRATULATIONS!</span>
                <span className="text-[10px] font-medium">{win.createdAt?.toDate ? format(win.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A'}</span>
              </div>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Jackpot Slot</span>
                    <span className="text-lg font-black text-blue-900">{win.session}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Winning Amount</span>
                    <span className="text-lg font-black text-green-600">₹{win.winningAmount?.toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between items-center">
                  <span className="text-xs text-gray-500">Jodi: <span className="font-bold text-gray-800">{win.numbers.join(', ')}</span></span>
                  <Badge className="bg-green-500 text-white text-[10px]">PAID</Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
