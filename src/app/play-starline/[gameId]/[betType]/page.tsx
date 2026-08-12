'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUserStore, useSettingsStore } from '@/lib/store';
import { betTypes, type BetType, type Bid } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Send, PlusCircle, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, serverTimestamp, doc, runTransaction, onSnapshot, increment } from 'firebase/firestore';
import { logTransaction } from '@/lib/transactions';
import { Loader } from '@/components/loader';
import { cn } from '@/lib/utils';

type BidItem = {
  number: string;
  amount: number;
};

export default function StarlineBettingPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useUserStore();
  const { appSettings } = useSettingsStore();
  
  const gameId = params.gameId as string;
  const betType = params.betType as BetType;
  const [gameTime, setGameTime] = useState('');
  
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [submittedBids, setSubmittedBids] = useState<BidItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const minBid = appSettings.minBidSingleDigit || 10;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'starlineGames', gameId), (snap) => {
      if (snap.exists()) setGameTime(snap.data().time);
    });
    return () => unsub();
  }, [gameId]);

  const handleAddBid = () => {
    if (!number) {
      toast({ title: 'Enter Number', variant: 'destructive' });
      return;
    }
    
    if (betType === 'singleDigit' && !/^\d{1}$/.test(number)) {
      toast({ title: 'Invalid Digit', description: 'Enter 1 digit', variant: 'destructive' });
      return;
    }
    if (betType !== 'singleDigit' && !/^\d{3}$/.test(number)) {
      toast({ title: 'Invalid Pana', description: 'Enter 3 digits', variant: 'destructive' });
      return;
    }

    const numAmount = parseInt(amount);
    if (!numAmount || numAmount < minBid) {
      toast({ title: 'Invalid Amount', description: `Min ₹${minBid}`, variant: 'destructive' });
      return;
    }

    setSubmittedBids(prev => [...prev, { number, amount: numAmount }]);
    setNumber('');
    setAmount('');
  };

  const removeBid = (index: number) => {
    setSubmittedBids(prev => prev.filter((_, i) => i !== index));
  };

  const totalAmount = useMemo(() => submittedBids.reduce((acc, bid) => acc + Number(bid.amount), 0), [submittedBids]);

  const handleFinalSubmit = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const bidsToSubmit = [...submittedBids];
    if (bidsToSubmit.length === 0) {
      toast({ title: 'No Bids to Submit', variant: 'destructive' });
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    if (!currentUser) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    const totalBetAmount = Number(totalAmount);
    const userBalance = (currentUser.balance || 0) + (currentUser.bonusBalance || 0);
    if (totalBetAmount > userBalance) {
      toast({ title: 'Insufficient Balance', variant: 'destructive' });
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    setSubmittedBids([]);

    const userDocRef = doc(db, 'users', currentUser.id);
    
    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userDocRef);
            if (!userSnap.exists()) throw new Error("User missing!");
            
            const userData = userSnap.data();
            let currentReal = Number(userData.balance || 0);
            let currentBonus = Number(userData.bonusBalance || 0);

            if (totalBetAmount > (currentReal + currentBonus)) {
                throw new Error("Insufficient total balance!");
            }

            let totalRealToDeduct = 0;
            let totalBonusToDeduct = 0;

            for (const bidItem of bidsToSubmit) {
                const bidAmount = Number(bidItem.amount);
                let bidSource: 'real' | 'bonus' = 'real';
                let realPart = 0;
                let bonusPart = 0;

                if (currentBonus >= bidAmount) {
                    bidSource = 'bonus';
                    bonusPart = bidAmount;
                    currentBonus -= bonusPart;
                } else if (currentBonus > 0) {
                    bidSource = 'real';
                    bonusPart = currentBonus;
                    realPart = bidAmount - bonusPart;
                    currentBonus = 0;
                    currentReal -= realPart;
                } else {
                    bidSource = 'real';
                    realPart = bidAmount;
                    currentReal -= realPart;
                }

                totalRealToDeduct += Number(realPart);
                totalBonusToDeduct += Number(bonusPart);

                const bidData = {
                    userId: currentUser.id,
                    displayName: currentUser.name,
                    mobile: currentUser.mobile,
                    gameId: gameId,
                    gameName: 'KALYAN 777 STARLINE',
                    betType: betType,
                    session: gameTime,
                    numbers: [bidItem.number],
                    totalAmount: Number(bidAmount),
                    status: 'running',
                    betSource: bidSource,
                    isStarline: true,
                    createdAt: serverTimestamp()
                };

                const newBidRef = doc(collection(db, "bids"));
                transaction.set(newBidRef, bidData);
            }

            transaction.update(userDocRef, {
                balance: increment(-Number(totalRealToDeduct)),
                bonusBalance: increment(-Number(totalBonusToDeduct))
            });

            await logTransaction({
                userId: currentUser.id,
                userName: currentUser.name,
                amount: -Number(totalBetAmount),
                type: 'bid_placed',
                description: `KALYAN 777 Starline Bid (${betTypes[betType]}, ${gameTime}). Total Numbers: ${bidsToSubmit.length}`,
                balanceBefore: Number(userData.balance || 0),
                balanceAfter: Number(userData.balance || 0) - Number(totalRealToDeduct),
                bonusBalanceBefore: Number(userData.bonusBalance || 0),
                bonusBalanceAfter: Number(userData.bonusBalance || 0) - Number(totalBonusToDeduct),
            }, transaction);
        });

        toast({ title: '✅ Bids Submitted!', className: 'bg-green-600 text-white' });
        router.push('/starline');
    } catch (error: any) {
        console.error("Submission Error:", error);
        toast({ title: 'Error', description: error.message || 'Submission failed.', variant: 'destructive' });
        setSubmittedBids(bidsToSubmit);
        isSubmittingRef.current = false;
        setIsSubmitting(false);
    } finally {
        setIsSubmitting(false);
        isSubmittingRef.current = false;
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 max-w-sm">
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-header p-8 rounded-3xl flex flex-col items-center gap-4 text-center shadow-2xl animate-in zoom-in-95 duration-200">
                <Loader className="h-12 w-12 text-yellow-400" />
                <p className="font-black text-white text-lg">Processing Your Bids...</p>
                <p className="text-xs text-blue-100 font-bold uppercase tracking-widest">Please wait, do not close the app</p>
            </div>
        </div>
      )}
      <Card className="border-none shadow-lg overflow-hidden rounded-2xl mb-20">
        <div className="bg-muted/30 p-2.5 flex items-center justify-center gap-2 border-b">
          <CalendarIcon className="h-3.5 w-3.5 text-[#325E6A]" />
          <span className="text-[11px] font-bold text-[#325E6A]">{format(new Date(), "EEEE, dd MMM")}</span>
        </div>
        <CardContent className="p-3.5 space-y-3">
          <div className="space-y-2.5">
            <Input 
              placeholder={betType === 'singleDigit' ? "Enter Digit (0-9)" : "Enter 3-Digit Pana"} 
              type="tel"
              maxLength={betType === 'singleDigit' ? 1 : 3}
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
              className="text-center h-10 text-base font-bold rounded-xl bg-gray-50 border-gray-100"
              disabled={isSubmitting}
            />
            <Input 
              placeholder="Enter Amount" 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-center h-10 text-base font-bold rounded-xl bg-gray-50 border-gray-100"
              disabled={isSubmitting}
            />
            <Button onClick={handleAddBid} className="w-full h-10 bg-[#325E6A] hover:bg-[#0a2e4a] rounded-xl font-bold text-sm shadow-md" disabled={isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Bid
            </Button>
          </div>

          {submittedBids.length > 0 && (
            <div className="space-y-2 pt-3 border-t">
              <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center">My Bids List</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {submittedBids.map((bid, i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-100 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                    <span className="text-xs font-bold text-[#325E6A]">#{bid.number}</span>
                    <span className="text-xs font-bold text-orange-600">₹{bid.amount}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => removeBid(i)} disabled={isSubmitting}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <CardFooter className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto bg-white border-t p-3 flex items-center justify-between gap-3 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] h-16">
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Total Points</span>
            <span className="text-lg font-black text-[#325E6A] leading-none">₹{totalAmount}</span>
          </div>
          <Button 
            disabled={isSubmitting || submittedBids.length === 0} 
            onClick={handleFinalSubmit}
            className={cn("flex-1 h-10 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-sm shadow-md shadow-green-100", isSubmitting && "pointer-events-none opacity-50")}
          >
            {isSubmitting ? <Loader className="h-4 w-4 mr-2" /> : 'Confirm'}
          </Button>
      </CardFooter>
    </div>
  );
}
