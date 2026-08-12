'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Game, Bid, BetType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useMemo, useRef } from 'react';
import { cn, getGameTimestamps } from '@/lib/utils';
import { useUserStore, useSettingsStore } from '@/lib/store';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarIcon, Send, Trash2, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { collection, serverTimestamp, doc, runTransaction, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logTransaction } from '@/lib/transactions';
import { Loader } from '@/components/loader';

const allSinglePanas: Record<string, string[]> = {
    '1': ['128', '137', '146', '236', '245', '290', '380', '470', '489', '560', '678', '579'],
    '2': ['129', '138', '147', '156', '237', '246', '345', '390', '480', '570', '589', '679'],
    '3': ['120', '139', '148', '157', '238', '247', '256', '346', '490', '580', '670', '689'],
    '4': ['130', '149', '158', '167', '239', '248', '257', '347', '356', '590', '680', '789'],
    '5': ['140', '159', '168', '230', '249', '258', '267', '348', '357', '456', '690', '780'],
    '6': ['123', '150', '169', '178', '240', '259', '268', '349', '358', '367', '457', '790'],
    '7': ['124', '160', '179', '250', '269', '278', '340', '359', '368', '458', '467', '890'],
    '8': ['125', '134', '170', '189', '260', '279', '350', '369', '378', '459', '468', '567'],
    '9': ['126', '135', '180', '234', '270', '289', '360', '379', '450', '469', '478', '568'],
    '0': ['127', '136', '145', '190', '235', '280', '370', '389', '460', '479', '569', '578'],
};

const flatAllSinglePanas = Object.values(allSinglePanas).flat();

interface BettingFormProps {
  game: Game;
  betType: BetType;
}

const formSchema = z.object({
    session: z.enum(['Open', 'Close']),
    classicBids: z.array(z.object({
        pana: z.string(),
        points: z.coerce.number().optional(),
    })),
    advancedBidNumber: z.string().optional(),
    advancedAmount: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type BidItem = {
    number: string;
    amount: number;
};

export function SinglePanaForm({ game, betType }: BettingFormProps) {
  const { toast } = useToast();
  const { currentUser } = useUserStore();
  const { appSettings } = useSettingsStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get('session') as 'Open' | 'Close' | null;
  
  const minBid = appSettings.minBidSinglePana || 10;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [selectedDigit, setSelectedDigit] = useState<string>('1');
  
  const [isBettingOpen, setIsBettingOpen] = useState(true);
  const [isCloseSessionAllowed, setIsCloseSessionAllowed] = useState(false);
  const [isOpenSessionAllowed, setIsOpenSessionAllowed] = useState(true);

  const [mode, setMode] = useState<'Classic' | 'Advanced'>('Classic');
  const [submittedBids, setSubmittedBids] = useState<BidItem[]>([]);
  
  const defaultSession = useMemo(() => {
    if (sessionParam && (sessionParam === 'Open' || sessionParam === 'Close')) {
        return sessionParam;
    }
    const now = new Date();
    const { openTime } = getGameTimestamps(game);
    return now.getTime() >= openTime.getTime() ? 'Close' : 'Open';
  }, [game, sessionParam]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      session: defaultSession,
      classicBids: flatAllSinglePanas.map(pana => ({ pana, points: undefined })),
      advancedBidNumber: '',
      advancedAmount: undefined,
    },
    mode: "onChange"
  });
  
  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "classicBids"
  });

  const totalAmount = useMemo(() => {
    return submittedBids.reduce((acc, bid) => acc + Number(bid.amount), 0);
  }, [submittedBids]);

  useEffect(() => {
    const checkTime = () => {
        const now = new Date();
        const { openTime, closeTime } = getGameTimestamps(game);
        
        const openAllowed = now.getTime() < openTime.getTime();
        const closeAllowed = now.getTime() >= openTime.getTime() && now.getTime() < closeTime.getTime();

        setIsOpenSessionAllowed(openAllowed);
        setIsCloseSessionAllowed(closeAllowed);
        setIsBettingOpen(openAllowed || closeAllowed);

        const currentSession = form.getValues('session');
        if (!openAllowed && currentSession === 'Open' && closeAllowed) {
            form.setValue('session', 'Close');
        }
    };

    checkTime();
    const timer = setInterval(checkTime, 500);
    return () => clearInterval(timer);
  }, [game, form]);
  
  useEffect(() => {
     form.setValue('session', defaultSession);
  }, [defaultSession, form]);
  
  const handleAddClassicBids = () => {
    const classicBidsData = form.getValues('classicBids');
    const newBids = classicBidsData
        .filter(bid => bid.points && Number(bid.points) >= minBid)
        .map(bid => ({ number: bid.pana, amount: Number(bid.points!) }));

    if (newBids.length === 0) {
        toast({ title: 'No Bids to Add', description: `Please enter points.`, variant: 'destructive' });
        return;
    }
    
    setSubmittedBids(prev => [...prev, ...newBids]);
    replace(flatAllSinglePanas.map(pana => ({ pana, points: undefined })));
    toast({ title: 'Bids Added', description: `${newBids.length} bid(s) added.` });
  };

  const handleAddAdvancedBid = () => {
    const number = form.getValues('advancedBidNumber');
    const amount = form.getValues('advancedAmount');

    if (!number || !/^\d{3}$/.test(number)) {
        toast({ title: 'Invalid Number', description: 'Enter a valid 3-digit pana.', variant: 'destructive' });
        return;
    }

    if (!flatAllSinglePanas.includes(number)) {
        toast({ title: 'Invalid Pana', description: 'Invalid Single Pana.', variant: 'destructive' });
        return;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount < minBid) {
        toast({ title: 'Invalid Amount', description: `Min: ${minBid}`, variant: 'destructive' });
        return;
    }
    setSubmittedBids(prev => [...prev, {number, amount: numAmount}]);
    form.setValue('advancedBidNumber', '');
    form.setValue('advancedAmount', undefined);
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
    const userBalance = Number(currentUser.balance || 0) + Number(currentUser.bonusBalance || 0);

    if (totalBetAmount > userBalance) {
        toast({ title: 'Insufficient Balance', variant: 'destructive' });
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
    }

    setSubmittedBids([]);

    const session = form.getValues('session');
    const userDocRef = doc(db, 'users', currentUser.id);
    
    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userDocRef);
            if (!userSnap.exists()) throw new Error("User does not exist!");
            
            const userData = userSnap.data();
            let currentRealBalance = Number(userData.balance || 0);
            let currentBonusBalance = Number(userData.bonusBalance || 0);

            if (totalBetAmount > (currentRealBalance + currentBonusBalance)) {
                throw new Error("Insufficient total balance!");
            }

            let totalRealToDeduct = 0;
            let totalBonusToDeduct = 0;

            for (const bidItem of bidsToSubmit) {
                const bidAmount = Number(bidItem.amount);
                let bidSource: 'real' | 'bonus' = 'real';
                let realPart = 0;
                let bonusPart = 0;

                if (currentBonusBalance >= bidAmount) {
                    bidSource = 'bonus';
                    bonusPart = bidAmount;
                    currentBonusBalance -= bonusPart;
                } else if (currentBonusBalance > 0) {
                    bidSource = 'real';
                    bonusPart = currentBonusBalance;
                    realPart = bidAmount - bonusPart;
                    currentBonusBalance = 0;
                    currentRealBalance -= realPart;
                } else {
                    bidSource = 'real';
                    realPart = bidAmount;
                    currentRealBalance -= realPart;
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
                    session: session,
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
                description: `Bid on ${game.name} (${betType}, ${session}). Total Numbers: ${bidsToSubmit.length}`,
                balanceBefore: Number(userData.balance || 0),
                balanceAfter: Number(userData.balance || 0) - Number(totalRealToDeduct),
                bonusBalanceBefore: Number(userData.bonusBalance || 0),
                bonusBalanceAfter: Number(userData.bonusBalance || 0) - Number(totalBonusToDeduct),
            }, transaction);
        });

        toast({ title: '✅ Bids Submitted!', className: 'bg-green-600 text-white' });
        form.reset();
    } catch (error: any) {
        console.error("Bet Submission Error:", error);
        toast({ title: 'Error', description: error.message || 'Submission failed.', variant: 'destructive' });
        setSubmittedBids(bidsToSubmit);
        isSubmittingRef.current = false;
        setIsSubmitting(false);
    } finally {
        setIsSubmitting(false);
        isSubmittingRef.current = false;
    }
  };

  const isFormDisabled = !isBettingOpen;

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
                <div className="p-1 rounded-full grid grid-cols-2 gap-1">
                    <Button type="button" onClick={() => setMode('Classic')} variant={mode === 'Classic' ? 'default' : 'ghost'} className={cn("rounded-full shadow-md text-sm", mode === 'Classic' ? '' : 'text-[#325E6A] hover:bg-blue-100')}>Classic</Button>
                    <Button type="button" onClick={() => setMode('Advanced')} variant={mode === 'Advanced' ? 'default' : 'ghost'} className={cn("rounded-full shadow-md text-sm", mode === 'Advanced' ? '' : 'text-[#325E6A] hover:bg-blue-100')}>Advanced</Button>
                </div>
                <div>
                    <FormLabel className="text-xs font-medium">Choose Session</FormLabel>
                    <Controller
                        control={form.control}
                        name="session"
                        render={({ field }) => (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={field.value === 'Open' ? 'default' : 'outline'}
                                    onClick={() => field.onChange('Open')}
                                    disabled={!isOpenSessionAllowed || isSubmitting}
                                    className={cn("w-full h-9 text-sm", field.value === 'Open' ? "shadow-lg" : 'text-[#325E6A] hover:bg-blue-100')}
                                >
                                    Open
                                </Button>
                                <Button
                                    type="button"
                                    variant={field.value === 'Close' ? 'default' : 'outline'}
                                    onClick={() => field.onChange('Close')}
                                    disabled={!isCloseSessionAllowed || isSubmitting}
                                    className={cn("w-full h-9 text-sm", field.value === 'Close' ? "shadow-lg" : 'text-[#325E6A] hover:bg-blue-100')}
                                >
                                    Close
                                </Button>
                            </div>
                        )}
                    />
                </div>
                
                {mode === 'Classic' ? (
                  <div className="space-y-4">
                    <div className="p-2 rounded-lg bg-[#325E6A]">
                        <div className="grid grid-cols-5 gap-1">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(digit => (
                                <Button
                                    key={digit}
                                    type="button"
                                    variant={selectedDigit === digit ? 'secondary' : 'ghost'}
                                    onClick={() => setSelectedDigit(digit)}
                                    className={cn("rounded-md text-sm h-8", selectedDigit === digit ? 'bg-white text-[#325E6A]' : 'text-white hover:bg-white/10')}
                                    disabled={isSubmitting}
                                >
                                    {digit}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {fields.map((field, index) => {
                            const isVisible = (allSinglePanas[selectedDigit] || []).includes(field.pana);
                            if (!isVisible) return null;
                            return (
                                <FormField
                                    key={field.id}
                                    control={form.control}
                                    name={`classicBids.${index}.points`}
                                    render={({ field: inputField }) => (
                                        <FormItem>
                                            <div className="flex items-center h-8 bg-background rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary shadow-md">
                                                <FormLabel className="flex items-center justify-center h-full w-12 bg-orange-400 text-white border-r text-sm font-bold">
                                                    {field.pana}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        {...inputField}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            if (value === '' || parseInt(value) >= 0) {
                                                                inputField.onChange(e);
                                                            }
                                                        }}
                                                        value={inputField.value ?? ''}
                                                        className="h-full bg-background border-none text-center text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                                                        disabled={isFormDisabled || isSubmitting}
                                                    />
                                                </FormControl>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            )
                        })}
                    </div>
                     <Button type="button" onClick={handleAddClassicBids} className="w-full text-sm" size="sm" disabled={isFormDisabled || isSubmitting}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add All Bids
                    </Button>
                  </div>
                ) : (
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="advancedBidNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Add Bid Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter 3-digit pana" {...field} value={field.value ?? ''} maxLength={3} className="text-center text-sm h-9" disabled={isFormDisabled || isSubmitting} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="advancedAmount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Add Amount</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder={`Enter amount (min ${minBid})`} {...field} value={field.value ?? ''} className="text-center text-sm h-9" disabled={isFormDisabled || isSubmitting} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <Button type="button" onClick={handleAddAdvancedBid} className="w-full text-sm" size="sm" disabled={isFormDisabled || isSubmitting}>
                            <Send className="mr-2 h-4 w-4" /> Add Bid
                        </Button>
                    </div>
                )}
                 {submittedBids.length > 0 && (
                    <div className="space-y-2 pt-4">
                        <h4 className="text-xs font-medium text-center">Your Bids List</h4>
                        <div className="border rounded-lg p-1 space-y-1 max-h-48 overflow-y-auto">
                            {submittedBids.map((bid, index) => (
                                <div key={index} className="flex justify-between items-center bg-muted/50 p-1 px-2 rounded-md animate-in fade-in-0">
                                    <p className="text-[10px]">Pana: <span className="font-bold">{bid.number}</span></p>
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
