'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { collection, query, onSnapshot, orderBy, DocumentData, writeBatch, doc, where, getDocs, increment, getDoc, Timestamp, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@/components/loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as z from 'zod';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { RotateCcw } from 'lucide-react';
import { logTransaction } from '@/lib/transactions';
import type { User } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


const formSchema = z.object({
  newOpenPana: z.string().length(3, 'Pana must be 3 digits.'),
});

type GameResultFormValues = z.infer<typeof formSchema>;

interface Game extends DocumentData {
    id: string;
    name: string;
    openResult: string;
    closeResult: string;
    result: string;
}

const calculateJodiDigit = (pana: string): string => {
    if (!pana || pana.length !== 3 || !/^\d+$/.test(pana)) return '';
    return (pana.split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0) % 10).toString();
};

export default function UpdateResultsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  // Confirmation state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<GameResultFormValues | null>(null);

  const form = useForm<GameResultFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newOpenPana: '',
    },
  });

  useEffect(() => {
    const q = query(collection(db, "games"), orderBy("openTime", "asc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const gamesData: Game[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setGames(gamesData);
      if (gamesData.length > 0 && !selectedGameId) {
        setSelectedGameId(gamesData[0].id);
      }
      setLoading(false);
    }, (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'games',
            operation: 'list'
        }));
    });
    return () => unsubscribe();
  }, [selectedGameId]);

  const handleUpdateResult = (values: GameResultFormValues) => {
    if (!selectedGameId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a game first.' });
        return;
    }
    setPendingValues(values);
    setIsConfirmOpen(true);
  };

  const confirmUpdate = async () => {
    if (!pendingValues || !selectedGameId) return;

    const game = games.find(g => g.id === selectedGameId);
    if (!game) {
        toast({ variant: 'destructive', title: 'Error', description: 'Selected game not found.' });
        return;
    }

    setIsSubmitting(true);
    setIsConfirmOpen(false);
    const newOpenPana = pendingValues.newOpenPana;
    const gameDocRef = doc(db, 'games', game.id);

    // 1. UPDATE GAME RESULT IMMEDIATELY (NETWORK COMMAND FIRED)
    updateDoc(gameDocRef, { 
      openResult: newOpenPana,
      closeResult: '**',
      result: `${newOpenPana}-**-***`
    }).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: gameDocRef.path,
            operation: 'update',
            requestResourceData: { openResult: newOpenPana }
        }));
    });

    // 2. INSTANT UI RELEASE - Don't wait for background processing
    toast({ title: 'Result Published!', description: `Open result for ${game.name} updated. Processing winners in background...` });
    form.reset();
    setIsSubmitting(false);
    setPendingValues(null);
    
    // 3. PROCESS WINNERS IN BACKGROUND USING BATCH (FASTEST ATOMIC UPDATE)
    const bidsQuery = query(
        collection(db, 'bids'),
        where('gameId', '==', game.id),
        where('status', '==', 'running')
    );

    getDocs(bidsQuery).then(async (bidsSnapshot) => {
        if (bidsSnapshot.empty) return;

        const ratesDocRef = doc(db, 'settings', 'gameRates');
        const ratesDoc = await getDoc(ratesDocRef);
        const winRates = ratesDoc.exists() ? ratesDoc.data() : {
          singleDigit: 10, jodiDigit: 100, singlePana: 150, doublePana: 300, triplePana: 600, halfSangam: 1000, fullSangam: 10000
        };

        let batch = writeBatch(db);
        let batchCount = 0;

        for (const bidDoc of bidsSnapshot.docs) {
          const bid = bidDoc.data();
          const bidNumbers = bid.numbers as string[];
          let isWinner = false;
          let winningAmount = 0;
          let winningNumber = '';
          const betType = bid.betType as string;
          const amountPerNumber = Number(bid.totalAmount) / bidNumbers.length;
          const openJodiDigit = calculateJodiDigit(newOpenPana);

          const canBeResolvedAtOpen = bid.session === 'Open' && !['jodiDigit', 'halfSangam', 'fullSangam'].includes(betType);

          if (canBeResolvedAtOpen) {
            const isSingleDigitWinner = (betType === 'singleDigit' || betType === 'singleDigitBulk') && bidNumbers.includes(openJodiDigit);
            const isPanaWinner = (betType === 'singlePana' || betType === 'doublePana' || betType === 'triplePana' || betType === 'singlePanaBulk' || betType === 'doublePanaBulk' || betType === 'spDpTp' || betType === 'spMotor' || betType === 'dpMotor') && bidNumbers.includes(newOpenPana);
            
            if (isSingleDigitWinner || isPanaWinner) {
                isWinner = true;
                winningNumber = isSingleDigitWinner ? openJodiDigit : newOpenPana;
            }
          }
          
          if (isWinner) {
            let rateKey = betType;
            if (betType === 'singleDigitBulk') rateKey = 'singleDigit';
            if (betType === 'singlePanaBulk' || betType === 'spMotor') rateKey = 'singlePana';
            if (betType === 'doublePanaBulk' || betType === 'dpMotor') rateKey = 'doublePana';
            if (betType === 'spDpTp') {
                const digits = winningNumber.split('');
                const uniqueCount = new Set(digits).size;
                if (uniqueCount === 1) rateKey = 'triplePana';
                else if (uniqueCount === 2) rateKey = 'doublePana';
                else rateKey = 'singlePana';
            }

            const effectiveWinRate = Number(winRates[rateKey] || 0);
            winningAmount = amountPerNumber * effectiveWinRate;
            
            if (winningAmount > 0) {
                batch.update(bidDoc.ref, { status: 'won', winningAmount: Number(winningAmount) });
                const userRef = doc(db, 'users', bid.userId);
                
                if (bid.betSource === 'bonus') {
                    batch.update(userRef, { bonusBalance: increment(winningAmount) });
                } else {
                    batch.update(userRef, { balance: increment(winningAmount) });
                }

                // Log transaction
                const logRef = doc(collection(db, 'transactions'));
                batch.set(logRef, {
                    userId: bid.userId,
                    userName: bid.displayName,
                    amount: winningAmount,
                    type: 'win',
                    description: `Won on ${game.name} (${bid.betType}). Winning Number: ${winningNumber}`,
                    balanceBefore: 0,
                    balanceAfter: 0,
                    relatedId: bidDoc.id,
                    createdAt: serverTimestamp()
                });
                batchCount += 3; // update bid, update user, add transaction
            } else {
                batch.update(bidDoc.ref, { status: 'won', winningAmount: 0 });
                batchCount++;
            }
          } else if (canBeResolvedAtOpen) {
            batch.update(bidDoc.ref, { status: 'lost' });
            batchCount++;
          }

          if (batchCount >= 450) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
            await batch.commit();
        }
    }).catch(err => {
        console.error("Background processing error:", err);
    });
  };

  const handleRevertResult = () => {
    if (!selectedGameId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a game first.' });
        return;
    }
    const game = games.find(g => g.id === selectedGameId);
    if (!game || !game.openResult || game.openResult === '***') {
        toast({ variant: 'destructive', title: 'Error', description: 'No open result to revert for this game.' });
        return;
    }

    setIsReverting(true);

    const affectedBidsQuery = query(
        collection(db, 'bids'), 
        where('gameId', '==', game.id),
        where('session', '==', 'Open')
    );

    getDocs(affectedBidsQuery).then(bidsSnapshot => {
        const winningBids = bidsSnapshot.docs.filter(d => d.data().status === 'won');
        
        const transactionQueryPromises = winningBids.map(bidDoc => {
            const q = query(
                collection(db, 'transactions'),
                where('relatedId', '==', bidDoc.id),
                where('type', '==', 'win')
            );
            return getDocs(q);
        });

        return Promise.all(transactionQueryPromises).then(transactionSnapshots => {
            return runTransaction(db, async (transaction) => {
                const gameDocRef = doc(db, 'games', game.id);
                const gameDoc = await transaction.get(gameDocRef);
                if (!gameDoc.exists() || gameDoc.data().openResult === '***') {
                    throw new Error("Result already reverted or not set.");
                }
                
                const userWinningMap = new Map<string, { real: number, bonus: number }>();
                for (const bidDoc of winningBids) {
                    const bid = bidDoc.data();
                    if (Number(bid.winningAmount) > 0) {
                        const currentWinnings = userWinningMap.get(bid.userId) || { real: 0, bonus: 0 };
                        if (bid.betSource === 'bonus') {
                            currentWinnings.bonus += Number(bid.winningAmount);
                        } else {
                            currentWinnings.real += Number(bid.winningAmount);
                        }
                        userWinningMap.set(bid.userId, currentWinnings);
                    }
                }
    
                const userRefPromises = Array.from(userWinningMap.keys()).map(userId => transaction.get(doc(db, 'users', userId)));
                await Promise.all(userRefPromises);
    
                for (const [userId, { real, bonus }] of userWinningMap.entries()) {
                    const userRef = doc(db, 'users', userId);
                    transaction.update(userRef, { 
                        balance: increment(-real),
                        bonusBalance: increment(-bonus) 
                    });
                }
                
                transactionSnapshots.forEach(snapshot => {
                    snapshot.forEach(winDoc => transaction.delete(winDoc.ref));
                });
    
                bidsSnapshot.docs.filter(d => d.data().status === 'won' || d.data().status === 'lost').forEach(bidDoc => {
                    transaction.update(bidDoc.ref, { status: 'running', winningAmount: 0 });
                });
    
                const closeResult = gameDoc.data()?.closeResult || '**';
                transaction.update(gameDocRef, {
                    openResult: '***',
                    result: `***-**-${closeResult}`
                });
            }).catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: `games/${game.id}`,
                    operation: 'write'
                }));
            });
        });
    })
    .then(() => {
        toast({
            title: 'Result Reverted!',
            description: `Open result for ${game.name} has been reverted. Affected bets are running again.`
        });
    })
    .catch((error: any) => {
        console.error('Error reverting result: ', error);
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to revert result.' });
    })
    .finally(() => {
        setIsReverting(false);
    });
  };


  const selectedGame = games.find(g => g.id === selectedGameId);
  const newOpenPana = form.watch('newOpenPana');
  const autoJodi = calculateJodiDigit(newOpenPana);

  return (
    <div className="flex-1 space-y-6">
      <Card className="bg-card/80 border-white/10 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Update Game Results (Open)</CardTitle>
          <CardDescription>Select a game and enter the Open Pana to update the results. The Jodi will be calculated automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader className="h-10 w-10 text-primary" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdateResult)} className="space-y-6 max-w-md mx-auto">
                <FormItem>
                  <FormLabel>Select Game</FormLabel>
                  <Select onValueChange={setSelectedGameId} value={selectedGameId ?? ''}>
                    <FormControl>
                      <SelectTrigger className="bg-green-500 text-white hover:bg-green-600">
                        <SelectValue placeholder="Select a game to update" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {games.map((game) => (
                        <SelectItem key={game.id} value={game.id}>
                          {game.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>

                {selectedGame && (
                    <>
                    <p className="text-sm text-center text-muted-foreground">
                        Current Result: <span className="font-bold text-foreground">{selectedGame.result || `${selectedGame.openResult || '***'}-**-${selectedGame.closeResult || '**'}`}</span>
                    </p>
                     <FormField
                        control={form.control}
                        name="newOpenPana"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>New Open Pana</FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="Enter 3-digit pana"
                                        {...field} 
                                        className="bg-input rounded-lg text-center text-lg"
                                        maxLength={3}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="flex flex-col items-center">
                        <FormLabel className="text-sm mb-2">Auto Jodi (Open)</FormLabel>
                         <Input
                            readOnly
                            value={autoJodi}
                            className="bg-input border-none font-bold text-center text-lg w-1/2"
                        />
                    </div>
                    
                    <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                        <AlertDialogTrigger asChild>
                             <Button 
                                type="submit"
                                className="w-full"
                                disabled={isSubmitting || isReverting || !form.formState.isValid}
                            >
                                {isSubmitting ? <Loader className="h-4 w-4 mr-2" /> : null}
                                {isSubmitting ? 'Updating...' : 'Update & Process Winners'}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[400px] rounded-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Result Publication</AlertDialogTitle>
                                <div className="text-sm text-muted-foreground space-y-3 pt-4">
                                    <div className="p-3 bg-muted rounded-lg text-center">
                                        <p className="text-xs uppercase font-bold text-muted-foreground">Market Name</p>
                                        <p className="text-lg font-black text-foreground">{selectedGame.name.toUpperCase()}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-green-50 rounded-lg text-center">
                                            <p className="text-[10px] uppercase font-bold text-green-600">Open Pana</p>
                                            <p className="text-xl font-black text-green-700">{newOpenPana}</p>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                                            <p className="text-[10px] uppercase font-bold text-blue-600">Jodi Digit</p>
                                            <p className="text-xl font-black text-blue-700">{autoJodi}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-center pt-2">
                                        अपने ये रिजल्ट डाला है, सही हो गया तो अपडेट करो।
                                    </p>
                                </div>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                                <AlertDialogCancel className="rounded-xl flex-1">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmUpdate} className="rounded-xl flex-1 bg-green-600 hover:bg-green-700">Confirm & Update</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    className="w-full"
                                    disabled={isSubmitting || isReverting || !selectedGame.openResult || selectedGame.openResult === '***'}
                                >
                                    {isReverting ? <Loader className="h-4 w-4 mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                                    Revert Last Result
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-[340px] rounded-2xl p-4">
                                <AlertDialogHeader className="space-y-2">
                                    <AlertDialogTitle className="text-lg">Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-xs">
                                        This will revert the open result, deduct winnings, and reset bets to 'running'.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex flex-col gap-2 mt-4">
                                    <AlertDialogAction onClick={handleRevertResult} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 text-sm">Confirm Revert</AlertDialogAction>
                                    <AlertDialogCancel className="rounded-xl h-10 text-sm border-gray-200">Cancel</AlertDialogCancel>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    </>
                )}
              </form>
            </Form>
          )}
          {games.length === 0 && !loading && (
              <p className="text-center text-muted-foreground mt-4">No games found. Please add a game first.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
