'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Game, Bid, BetType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useUserStore, useSettingsStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { CalendarIcon, Send, Trash2, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { collection, serverTimestamp, doc, runTransaction, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logTransaction } from '@/lib/transactions';
import { Loader } from '@/components/loader';

interface BettingFormProps {
  game: Game;
  betType: BetType;
}

const formSchema = z.object({
    openPana: z.string().length(3, "Open Pana must be 3 digits."),
    closeDigit: z.string().length(1, "Close Digit must be 1 digit."),
    points: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type BidItem = {
    number: string; // "OpenPana x CloseDigit"
    amount: number;
};

const parseTime = (timeString: string) => {
  if (!timeString) return { hours: 0, minutes: 0 };
  const [time, modifier] = timeString.split(' ');
  let [hours, minutes] = time.split(':').map(Number);

  if (modifier === 'PM' && hours < 12) {
    hours += 12;
  }
  if (modifier === 'AM' && hours === 12) {
    hours = 0;
  }
  return { hours, minutes };
};

const getGameTimestamps = (game: Game) => {
  const now = new Date();
  const { hours: openHours, minutes: openMinutes } = parseTime(game.openTime);
  const { hours: closeHours, minutes: closeMinutes } = parseTime(game.closeTime);

  const openTime = new Date(now);
  openTime.setHours(openHours, openMinutes, 0, 0);

  const closeTime = new Date(now);
  closeTime.setHours(closeHours, closeMinutes, 0, 0);

  if (closeTime.getTime() <= openTime.getTime()) {
    if (now.getTime() < closeTime.getTime()) {
      openTime.setDate(openTime.getDate() - 1);
    } else {
      closeTime.setDate(closeTime.getDate() + 1);
    }
  }

  return { openTime, closeTime };
};

export function HalfSangamForm({ game, betType }: BettingFormProps) {
  const { toast } = useToast();
  const { currentUser } = useUserStore();
  const { appSettings } = useSettingsStore();
  const router = useRouter();
  
  const minBid = appSettings.minBidHalfSangam || 10;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isBettingAllowed, setIsBettingAllowed] = useState(() => {
    const now = new Date();
    const { openTime } = getGameTimestamps(game);
    return now.getTime() < openTime.getTime();
  });
  const [submittedBids, setSubmittedBids] = useState<BidItem[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      openPana: '',
      closeDigit: '',
      points: undefined,
    },
    mode: "onChange"
  });

  const totalAmount = useMemo(() => {
    return submittedBids.reduce((acc, bid) => acc + Number(bid.amount), 0);
  }, [submittedBids]);

  useEffect(() => {
    const timer = setInterval(() => {
        const now = new Date();
        const { openTime } = getGameTimestamps(game);
        const openAllowed = now.getTime() < openTime.getTime();
        setIsBettingAllowed(openAllowed);
    }, 1000);
    return () => clearInterval(timer);
  }, [game]);
  
  const handleAddBid = (data: FormValues) => {
    const numPoints = Number(data.points);
    if (!numPoints || numPoints < minBid) {
        toast({ title: 'Invalid Amount', description: `Minimum bid points is ${minBid}.`, variant: 'destructive' });
        return;
    }
    const newBid: BidItem = {
        number: `${data.openPana} x ${data.closeDigit}`,
        amount: numPoints,
    };
    
    setSubmittedBids(prev => [...prev, newBid]);
    form.reset({ openPana: '', closeDigit: '', points: undefined });
    toast({ title: 'Bid Added', description: `Added: ${newBid.number}` });
  };

  const removeBid = (index: number) => {
    setSubmittedBids(prev => prev.filter((_, i) => i !== index));
  };

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
            if (!userSnap.exists()) throw new Error("User docs missing.");
            
            const userData = userSnap.data();
            let currentReal = Number(userData.balance || 0);
            let currentBonus = Number(userData.bonusBalance || 0);

            if (totalBetAmount > (currentReal + currentBonus)) {
                throw new Error("Insufficient total balance.");
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
                    gameId: game.id,
                    gameName: game.name,
                    betType: betType,
                    session: 'Open',
                    numbers: [bidItem.number],
                    totalAmount: Number(bidAmount),
                    status: 'running',
                    betSource: bidSource,
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
                description: `Bid placed on ${game.name} (${betType}). Total: ${bidsToSubmit.length}`,
                balanceBefore: Number(userData.balance || 0),
                balanceAfter: Number(userData.balance || 0) - Number(totalRealToDeduct),
                bonusBalanceBefore: Number(userData.bonusBalance || 0),
                bonusBalanceAfter: Number(userData.bonusBalance || 0) - Number(totalBonusToDeduct),
            }, transaction);
        });

        toast({ title: '✅ Bids Submitted!', className: 'bg-green-600 text-white' });
        form.reset();
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

  const isFormDisabled = !isBettingAllowed;

  return (
    <Form {...form}>
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-header p-8 rounded-3xl flex flex-col items-center gap-4 text-center shadow-2xl animate-in zoom-in-95 duration-200">
                <Loader className="h-12 w-12 text-yellow-400" />
                <p className="font-black text-white text-lg">Processing Your Bids...</p>
                <p className="text-xs text-blue-100 font-bold uppercase tracking-widest">Please wait, do not close the app</p>
            </div>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); handleFinalSubmit(); }} className="space-y-6">
        <Card>
          <CardContent className="p-4 space-y-4 pb-40">
                <p className="text-center text-sm font-medium text-[#325E6A]">{game.name}</p>
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-3 flex items-center gap-3">
                    <CalendarIcon className="h-4 w-4 text-[#325E6A]" />
                    <p className="text-sm font-medium text-[#325E6A]">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
                </div>
                
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <FormField
                            control={form.control}
                            name="openPana"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input placeholder="Enter Open Pana" {...field} value={field.value ?? ''} maxLength={3} className="text-center text-sm h-11" disabled={isFormDisabled || isSubmitting} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="closeDigit"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input placeholder="Enter Close Digit" {...field} value={field.value ?? ''} maxLength={1} className="text-center text-sm h-11" disabled={isFormDisabled || isSubmitting} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <FormField
                        control={form.control}
                        name="points"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input type="number" placeholder={`Enter points (min ${minBid})`} {...field} value={field.value ?? ''} className="text-center text-sm h-11" disabled={isFormDisabled || isSubmitting} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="button" onClick={form.handleSubmit(handleAddBid)} className="w-full text-sm" size="lg" disabled={isFormDisabled || isSubmitting}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add
                    </Button>
                  </div>
                
                 {submittedBids.length > 0 && (
                    <div className="space-y-2 pt-4">
                        <h4 className="text-xs font-medium text-center">Your Bids List</h4>
                        <div className="border rounded-lg p-1 space-y-1 max-h-48 overflow-y-auto">
                            {submittedBids.map((bid, index) => (
                                <div key={index} className="flex justify-between items-center bg-muted/50 p-1 px-2 rounded-md animate-in fade-in-0">
                                    <p className="text-[10px]">Combination: <span className="font-bold">{bid.number}</span></p>
                                    <p className="text-[10px]">Amount: <span className="font-bold">₹{bid.amount}</span></p>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeBid(index)} disabled={isSubmitting}>
                                        <Trash2 className="h-3 w-3 text-destructive"/>
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
          <CardFooter className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto bg-card border-t p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col text-left">
                    <span className="text-xs text-muted-foreground">Total Amount</span>
                    <span className="font-bold text-[#325E6A] text-lg">₹{totalAmount}</span>
                </div>
                <Button 
                    type="button" 
                    onClick={handleFinalSubmit} 
                    size="lg" 
                    className={cn("w-2/3 text-sm bg-[#325E6A] hover:bg-[#325E6A]/90", isSubmitting && "pointer-events-none opacity-50")} 
                    disabled={isSubmitting || isFormDisabled || submittedBids.length === 0}
                >
                    {isSubmitting ? <Loader className="mr-2 h-4 w-4 mr-2" /> : 'Continue'}
                </Button>
            </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
