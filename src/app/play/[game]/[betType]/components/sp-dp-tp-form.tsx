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
import { cn, getGameTimestamps } from '@/lib/utils';
import { useUserStore, useSettingsStore } from '@/lib/store';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { collection, runTransaction, doc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logTransaction } from '@/lib/transactions';
import { Checkbox } from '@/components/ui/checkbox';
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
const allDoublePanas: Record<string, string[]> = {
    '1': ['100', '119', '155', '227', '335', '344', '399', '588', '669'],
    '2': ['110', '200', '228', '255', '336', '499', '660', '688', '778'],
    '3': ['166', '229', '300', '337', '355', '445', '599', '779', '788'],
    '4': ['112', '220', '266', '338', '400', '446', '455', '699', '770'],
    '5': ['113', '122', '177', '339', '366', '447', '500', '799', '889'],
    '6': ['114', '277', '330', '448', '466', '556', '600', '880', '899'],
    '7': ['115', '133', '188', '223', '377', '449', '557', '566', '700'],
    '8': ['116', '224', '233', '288', '440', '477', '558', '800', '990'],
    '9': ['117', '144', '199', '225', '388', '559', '577', '667', '900'],
    '0': ['118', '226', '244', '299', '334', '488', '550', '668', '677'],
};
const tpCustomMapping: Record<string, string> = {
    '1': '777', '2': '444', '3': '111', '4': '888', '5': '555',
    '6': '222', '7': '999', '8': '666', '9': '333', '0': '000',
};


const panaTypes = [
  { id: 'sp', label: 'SP' },
  { id: 'dp', label: 'DP' },
  { id: 'tp', label: 'TP' },
] as const;

interface BettingFormProps {
  game: Game;
  betType: BetType;
}

const formSchema = z.object({
    session: z.enum(['Open', 'Close']),
    panaTypes: z.array(z.string()).refine((value) => value.some((item) => item), {
        message: "You have to select at least one pana type.",
    }),
    number: z.string().length(1, "Please enter a single digit."),
    points: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type BidItem = {
    number: string;
    amount: number;
    type: 'SP' | 'DP' | 'TP';
};

export function SpDpTpForm({ game, betType }: BettingFormProps) {
  const { toast } = useToast();
  const { currentUser } = useUserStore();
  const { appSettings } = useSettingsStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get('session') as 'Open' | 'Close' | null;
  
  const minBid = appSettings.minBidSpDpTp || 10;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [submittedBids, setSubmittedBids] = useState<BidItem[]>([]);
  const [isBettingAllowed, setIsBettingAllowed] = useState(true);
  const [isCloseSessionAllowed, setIsCloseSessionAllowed] = useState(false);
  const [isOpenSessionAllowed, setIsOpenSessionAllowed] = useState(true);
  
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
      panaTypes: [],
      number: '',
      points: undefined
    },
    mode: "onChange"
  });

  const totalAmount = useMemo(() => {
    return submittedBids.reduce((acc, bid) => acc + Number(bid.amount), 0);
  }, [submittedBids]);

  useEffect(() => {
    const checkTime = () => {
        const now = new Date();
        const { openTime } = getGameTimestamps(game);
        
        const openAllowed = now.getTime() < openTime.getTime();
        const closeAllowed = now.getTime() >= openTime.getTime() && now.getTime() < getGameTimestamps(game).closeTime.getTime();

        setIsOpenSessionAllowed(openAllowed);
        setIsCloseSessionAllowed(closeAllowed);
        setIsBettingAllowed(openAllowed || closeAllowed);

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

  const handleGenerate = (data: FormValues) => {
    const numPoints = Number(data.points);
    if (!numPoints || numPoints < minBid) {
        toast({ title: 'Invalid Amount', description: `Minimum points is ${minBid}.`, variant: 'destructive' });
        return;
    }
    const { number, points, panaTypes } = data;
    let generatedPanas: BidItem[] = [];

    if (panaTypes.includes('sp')) {
        const panas = allSinglePanas[number] || [];
        generatedPanas.push(...panas.map(p => ({ number: p, amount: numPoints, type: 'SP' as const })));
    }
    if (panaTypes.includes('dp')) {
        const panas = allDoublePanas[number] || [];
        generatedPanas.push(...panas.map(p => ({ number: p, amount: numPoints, type: 'DP' as const })));
    }
    if (panaTypes.includes('tp')) {
        const pana = tpCustomMapping[number];
        if (pana) {
            generatedPanas.push({ number: pana, amount: numPoints, type: 'TP' as const });
        }
    }

    if (generatedPanas.length === 0) {
        toast({ title: "No Panas Generated", description: "Please select at least one valid pana type.", variant: "destructive" });
        return;
    }

    setSubmittedBids(prev => [...prev, ...generatedPanas]);
    toast({ title: "Bids Generated", description: `${generatedPanas.length} bids have been added.` });
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
    const userBalance = (currentUser.balance ?? 0) + (currentUser.bonusBalance ?? 0);
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
                    betType: 'spDpTp',
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
                description: `Bid on ${game.name} (SP/DP/TP, ${session}). Total Panas: ${bidsToSubmit.length}`,
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
      <form className="space-y-6">
        <Card>
          <CardContent className="p-4 space-y-4 pb-40">
            <p className="text-center text-sm font-medium text-[#325E6A]">{game.name}</p>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-3 flex items-center gap-3">
              <CalendarIcon className="h-4 w-4 text-[#325E6A]" />
              <p className="text-sm font-medium text-[#325E6A]">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
            </div>
            
            <div>
              <FormLabel className="text-xs font-medium">Choose Session</FormLabel>
              <Controller
                control={form.control}
                name="session"
                render={({ field }) => (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button type="button" variant={field.value === 'Open' ? 'default' : 'outline'} onClick={() => field.onChange('Open')} disabled={!isOpenSessionAllowed || isSubmitting} className={cn("w-full h-9 text-sm", field.value === 'Open' ? "shadow-lg" : 'text-[#325E6A] hover:bg-blue-100')}>Open</Button>
                    <Button type="button" variant={field.value === 'Close' ? 'default' : 'outline'} onClick={() => field.onChange('Close')} disabled={!isCloseSessionAllowed || isSubmitting} className={cn("w-full h-9 text-sm", field.value === 'Close' ? "shadow-lg" : 'text-[#325E6A] hover:bg-blue-100')}>Close</Button>
                  </div>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="panaTypes"
              render={() => (
                <FormItem>
                  <div className="flex justify-around items-center pt-2">
                    {panaTypes.map((item) => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name="panaTypes"
                        render={({ field }) => (
                          <FormItem key={item.id} className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, item.id])
                                    : field.onChange(field.value?.filter((value) => value !== item.id));
                                }}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormLabel className="font-medium">{item.label}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                   <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Number" {...field} maxLength={1} className="text-center h-11 text-base" disabled={isSubmitting}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="points"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input type="number" placeholder={`Enter Point (min ${minBid})`} {...field} value={field.value ?? ''} className="text-center h-11 text-base" disabled={isSubmitting}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="button" onClick={form.handleSubmit(handleGenerate)} className="w-full h-12 text-base bg-[#325E6A] hover:bg-[#325E6A]/90" disabled={isSubmitting}>
              Generate
            </Button>
            
            {submittedBids.length > 0 && (
                <div className="space-y-2 pt-4">
                    <h4 className="text-xs font-medium text-center">Generated Bids</h4>
                    <div className="border rounded-lg p-1 space-y-1 max-h-48 overflow-y-auto">
                        {submittedBids.map((bid, index) => (
                            <div key={index} className="flex justify-between items-center bg-muted/50 p-1 px-2 rounded-md animate-in fade-in-0">
                                <p className="text-[10px]">Pana: <span className="font-bold">{bid.number}</span> ({bid.type})</p>
                                <p className="text-[10px]">Points: <span className="font-bold">₹{bid.amount}</span></p>
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
                className={cn("w-2/3 text-sm bg-green-600 hover:bg-green-700", isSubmitting && "pointer-events-none opacity-50")} 
                disabled={isSubmitting || submittedBids.length === 0}
            >
              {isSubmitting ? <Loader className="mr-2 h-4 w-4 mr-2" /> : 'Continue'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
