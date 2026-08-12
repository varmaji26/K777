'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { collection, query, onSnapshot, orderBy, DocumentData, writeBatch, doc, where, getDocs, increment, getDoc, Timestamp, runTransaction, updateDoc, serverTimestamp } from 'firebase/firestore';
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
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { logTransaction } from '@/lib/transactions';
import type { User } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formSchema = z.object({
  newClosePana: z.string().length(3, 'Pana must be 3 digits.'),
});

type GameResultFormValues = z.infer<typeof formSchema>;

interface Game extends DocumentData {
    id: string;
    name: string;
    openResult: string;
    closeResult: string;
    result: string;
    openTime: string;
    closeTime: string;
}

const calculateJodiDigit = (pana: string): string => {
    if (!pana || pana.length !== 3 || !/^\d+$/.test(pana)) return '';
    return (pana.split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0) % 10).toString();
};

const parseDateString = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month - 1, day);
};

const parseGameTime = (timeString: string) => {
    if (!timeString) return { hours: 0, minutes: 0 };
    const timeParts = timeString.split(' ');
    const time = timeParts[0];
    const modifier = timeParts[1]?.toUpperCase();
    
    let [hours, minutes] = time.split(':').map(Number);
    
    if (modifier === 'PM' && hours < 12) {
        hours += 12;
    }
    if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }
    return { hours, minutes };
};


export default function UpdateResultsClosePage() {
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
      newClosePana: '',
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
    const newClosePana = pendingValues.newClosePana;
    const closeJodiDigit = calculateJodiDigit(newClosePana);
    const openPana = game.openResult || '***';
    const openJodiDigit = calculateJodiDigit(openPana);
    const finalJodi = `${openJodiDigit}${closeJodiDigit}`;
    const finalResult = `${openPana}-${finalJodi}-${newClosePana}`;
    const gameDocRef = doc(db, 'games', game.id);

    // 1. UPDATE GAME RESULT IMMEDIATELY (NETWORK COMMAND FIRED)
    updateDoc(gameDocRef, { 
        closeResult: newClosePana,
        closeJodiDigit: closeJodiDigit,
        result: finalResult,
    }).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: gameDocRef.path,
            operation: 'update',
            requestResourceData: { closeResult: newClosePana }
        }));
    });

    // 2. INSTANT UI RELEASE - Don't wait for background processing
    toast({ title: 'Result Published!', description: `Close result for ${game.name} updated. Processing background tasks...` });
    form.reset();
    setIsSubmitting(false);
    setPendingValues(null);
    
    // 3. PROCESS BACKGROUND TASKS USING BATCH (FASTEST)
    const bidsQuery = query(collection(db, 'bids'), where('gameId', '==', game.id), where('status', '==', 'running'));
    
    getDocs(bidsQuery).then(async (bidsSnapshot) => {
        const ratesDocRef = doc(db, 'settings', 'gameRates');
        const ratesDoc = await getDoc(ratesDocRef);
        const winRates = ratesDoc.exists() ? ratesDoc.data() : {
            singleDigit: 10, jodiDigit: 100, singlePana: 150, doublePana: 300, triplePana: 600, halfSangam: 1000, fullSangam: 10000
        };

        let batch = writeBatch(db);
        let batchCount = 0;

        // Chart Updates
        const jodiChartRef = doc(db, 'jodiCharts', game.id);
        const panelChartRef = doc(db, 'panelCharts', game.id);
        
        const [jodiChartSnap, panelChartSnap] = await Promise.all([
            getDoc(jodiChartRef),
            getDoc(panelChartRef)
        ]);

        if (jodiChartSnap.exists()) {
            const jodiData = jodiChartSnap.data();
            const today = new Date();
            const todayDay = today.toLocaleDateString('en-US', { weekday: 'long' });
            const activeDays = jodiData.activeDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            
            if (activeDays.includes(todayDay)) {
                let newData = jodiData.data ? `${jodiData.data} ${finalJodi}` : finalJodi;
                batch.update(jodiChartRef, { data: newData });
                batchCount++;
            }
        }
        
        if (panelChartSnap.exists()) {
            const panelChartData = panelChartSnap.data().data || '';
            const now = new Date();
            const openTimeParts = parseGameTime(game.openTime);
            let resultDate = new Date();
            resultDate.setHours(0, 0, 0, 0);
            const gameOpenTimeToday = new Date();
            gameOpenTimeToday.setHours(openTimeParts.hours, openTimeParts.minutes, 0, 0);
            if (now < gameOpenTimeToday) resultDate.setDate(resultDate.getDate() - 1);
            const dayOfWeek = resultDate.getDay(); 
            const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const newDayData = `${openPana}${finalJodi}${newClosePana}`;
            const rows = panelChartData.split('\n').filter((row: string) => row.trim() !== '');
            let weekFound = false;
            let finalDataArray = [...rows];
            if (rows.length > 0) {
                const lastRow = rows[rows.length - 1];
                const match = lastRow.match(/(\d{2}\/\d{2}\/\d{4})\s*to\s*(\d{2}\/\d{2}\/\d{4})/);
                if (match) {
                    const lastStartDate = parseDateString(match[1]);
                    const lastEndDate = parseDateString(match[2]);
                    if (lastStartDate && lastEndDate && resultDate >= lastStartDate && resultDate <= lastEndDate) {
                        weekFound = true;
                        const dataPart = lastRow.substring(match[0].length).trim();
                        const dailyBlocks = dataPart.split(/\s+/).filter(String);
                        while(dailyBlocks.length < 7) dailyBlocks.push('********');
                        dailyBlocks[dayIndex] = newDayData;
                        const updatedDataPart = dailyBlocks.join(' ');
                        finalDataArray[rows.length - 1] = `${match[0]} ${updatedDataPart}`;
                    }
                }
            }
            if (!weekFound) {
                const startOfWeek = new Date(resultDate);
                startOfWeek.setDate(resultDate.getDate() - dayIndex);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                const formatDateStr = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const newDateRange = `${formatDateStr(startOfWeek)} to ${formatDateStr(endOfWeek)}`;
                const newWeekDataArr = Array(7).fill('********');
                newWeekDataArr[dayIndex] = newDayData;
                const newRow = `${newDateRange} ${newWeekDataArr.join(' ')}`;
                finalDataArray.push(newRow);
            }
            batch.update(panelChartRef, { data: finalDataArray.join('\n').trim() });
            batchCount++;
        }

        // Winner Processing
        for (const bidDoc of bidsSnapshot.docs) {
            const bid = bidDoc.data();
            const bidNumbers = bid.numbers as string[];
            let isWinner = false;
            let winningAmount = 0;
            let winningNumber = '';
            const betType = bid.betType as string;
            const amountPerNumber = Number(bid.totalAmount) / bidNumbers.length;

            const winningHalfSangam = `${openPana} x ${closeJodiDigit}`;
            const winningFullSangam = `${openPana} x ${newClosePana}`;

            if (bid.session === 'Close') {
                const isSingleDigitWinner = (betType === 'singleDigit' || betType === 'singleDigitBulk') && bidNumbers.includes(closeJodiDigit);
                const isPanaWinner = (betType === 'singlePana' || betType === 'doublePana' || betType === 'triplePana' || betType === 'singlePanaBulk' || betType === 'doublePanaBulk' || betType === 'spDpTp' || betType === 'spMotor' || betType === 'dpMotor') && bidNumbers.includes(newClosePana);
                
                if (isSingleDigitWinner || isPanaWinner) {
                    isWinner = true;
                    winningNumber = isSingleDigitWinner ? closeJodiDigit : newClosePana;
                }
            } else {
                if (betType === 'jodiDigit' && bidNumbers.includes(finalJodi)) {
                    isWinner = true;
                    winningNumber = finalJodi;
                } else if (betType === 'halfSangam' && bidNumbers.includes(winningHalfSangam)) {
                    isWinner = true;
                    winningNumber = winningHalfSangam;
                } else if (betType === 'fullSangam' && bidNumbers.includes(winningFullSangam)) {
                    isWinner = true;
                    winningNumber = winningFullSangam;
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
                    batchCount += 3;
                } else {
                    batch.update(bidDoc.ref, { status: 'won', winningAmount: 0 });
                    batchCount++;
                }
            } else {
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
        console.error("Background transaction error:", err);
    });
  };

  const handleRevertResult = () => {
    if (!selectedGameId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a game first.' });
        return;
    }
    const game = games.find(g => g.id === selectedGameId);
    if (!game || !game.closeResult || game.closeResult === '**') {
        toast({ variant: 'destructive', title: 'Error', description: 'No close result to revert for this game.' });
        return;
    }
  
    setIsReverting(true);
    
    const affectedBidsQuery = query(collection(db, 'bids'), where('gameId', '==', game.id));
    
    getDocs(affectedBidsQuery).then(bidsSnapshot => {
        const relevantBids = bidsSnapshot.docs.filter(d => {
            const data = d.data();
            return (data.status === 'won' && (data.session === 'Close' || ['jodiDigit', 'halfSangam', 'fullSangam'].includes(data.betType))) || 
                   (data.status === 'lost' && data.session !== 'Open');
        });
        const winningBids = relevantBids.filter(d => d.data().status === 'won');
        
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
                if (!gameDoc.exists() || gameDoc.data().closeResult === '**') {
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
    
                relevantBids.forEach(bidDoc => {
                    transaction.update(bidDoc.ref, { status: 'running', winningAmount: 0 });
                });
    
                const openPana = gameDoc.data()?.openResult || '***';
                const openJodiDigit = calculateJodiDigit(openPana);
                transaction.update(gameDocRef, {
                    closeResult: '**',
                    result: `${openPana}-${openJodiDigit}*-***`,
                });
            }).catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: `games/${game.id}`,
                    operation: 'write'
                }));
            });
        });
    }).then(() => {
        toast({
            title: 'Result Reverted!',
            description: `Close result for ${game.name} has been reverted. Incorrect winnings have been clawed back.`
        });
    }).catch((error: any) => {
        console.error('Error reverting result: ', error);
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to revert result.' });
    }).finally(() => {
        setIsReverting(false);
    });
  };
  
  const selectedGame = games.find(g => g.id === selectedGameId);
  const isOpenMissing = selectedGame && selectedGame.openResult === '***';
  const newClosePana = form.watch('newClosePana');
  const autoCloseJodi = calculateJodiDigit(newClosePana);
  const autoFullJodi = selectedGame ? `${calculateJodiDigit(selectedGame.openResult)}${autoCloseJodi}` : '**';

  return (
    <div className="flex-1 space-y-6">
      <Card className="bg-card/80 border-white/10 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Update Game Results (Close)</CardTitle>
          <CardTitle className="text-sm font-normal text-muted-foreground mt-1">Select a game and enter the Close Pana to update the results.</CardTitle>
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
                      <SelectTrigger className="bg-red-500 text-white hover:bg-red-600">
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

                    {isOpenMissing && (
                        <Alert variant="destructive" className="bg-red-50 border-red-200">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle className="font-bold">Open Result Missing!</AlertTitle>
                            <AlertDescription className="text-xs">
                                ओपन का रिजल्ट अभी नहीं आया है, कृपया क्लोज का रिजल्ट डालने से पहले ओपन का रिजल्ट अपडेट करें।
                            </AlertDescription>
                        </Alert>
                    )}

                     <FormField
                        control={form.control}
                        name="newClosePana"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>New Close Pana</FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="Enter 3-digit pana"
                                        {...field} 
                                        className="bg-input rounded-lg text-center text-lg"
                                        maxLength={3}
                                        disabled={isOpenMissing || isSubmitting}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col items-center">
                            <FormLabel className="text-sm mb-2">Auto Jodi (Close)</FormLabel>
                             <Input
                                readOnly
                                value={autoCloseJodi}
                                className="bg-input border-none font-bold text-center text-lg"
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <FormLabel className="text-sm mb-2">Auto Full Jodi</FormLabel>
                             <Input
                                readOnly
                                value={autoFullJodi}
                                className="bg-input border-none font-bold text-center text-lg"
                            />
                        </div>
                    </div>
                    
                    <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                        <AlertDialogTrigger asChild>
                             <Button 
                                type="submit"
                                className="w-full"
                                disabled={isSubmitting || isReverting || !form.formState.isValid || isOpenMissing}
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
                                        <div className="p-3 bg-red-50 rounded-lg text-center">
                                            <p className="text-[10px] uppercase font-bold text-red-600">Close Pana</p>
                                            <p className="text-xl font-black text-red-700">{newClosePana}</p>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                                            <p className="text-[10px] uppercase font-bold text-blue-600">Jodi Digit</p>
                                            <p className="text-xl font-black text-blue-700">{autoCloseJodi}</p>
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
                                    disabled={isSubmitting || isReverting || !selectedGame.closeResult || selectedGame.closeResult === '**'}
                                >
                                    {isReverting ? <Loader className="h-4 w-4 mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                                    Revert Last Result
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-[340px] rounded-2xl p-4">
                                <AlertDialogHeader className="space-y-2">
                                    <AlertDialogTitle className="text-lg">Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-xs">
                                        This action will find all winning bets, deduct winnings, and reset status to 'running'.
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
