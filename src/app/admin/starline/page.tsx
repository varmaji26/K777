'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, query, onSnapshot, doc, deleteDoc, serverTimestamp, runTransaction, increment, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@/components/loader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Plus, Trash2, CheckCircle, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { StarlineGame } from '@/lib/types';
import { logTransaction } from '@/lib/transactions';

const gameSchema = z.object({
  hour: z.string().min(1, 'Hour is required'),
  minute: z.string().min(1, 'Minute is required'),
  ampm: z.string().min(1, 'AM/PM is required'),
});

const resultSchema = z.object({
  panna: z.string().length(3, 'Panna must be 3 digits'),
});

const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const periods = ['AM', 'PM'];

const parseTimeToMinutes = (timeString: string) => {
  if (!timeString || !timeString.includes(':')) return 9999;
  const parts = timeString.trim().toUpperCase().split(' ');
  if (parts.length < 2) return 9999;
  const [hPart, modifier] = parts;
  let [hours, minutes] = hPart.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + (isNaN(minutes) ? 0 : minutes);
};

export default function AdminStarlinePage() {
  const { toast } = useToast();
  const [games, setGames] = useState<StarlineGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const gameForm = useForm<z.infer<typeof gameSchema>>({
    resolver: zodResolver(gameSchema),
    defaultValues: { hour: '10', minute: '00', ampm: 'AM' },
  });

  const resultForm = useForm<z.infer<typeof resultSchema>>({
    resolver: zodResolver(resultSchema),
    defaultValues: { panna: '' },
  });

  const watchedPanna = resultForm.watch('panna');
  const calculatedDigit = watchedPanna && watchedPanna.length === 3 
    ? (watchedPanna.split('').reduce((a, b) => a + parseInt(b || '0'), 0) % 10).toString()
    : '*';

  useEffect(() => {
    const q = query(collection(db, 'starlineGames'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StarlineGame));
      data.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
      setGames(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const onAddGame = async (values: z.infer<typeof gameSchema>) => {
    setIsSubmitting(true);
    const timeString = `${values.hour}:${values.minute} ${values.ampm}`;
    try {
      await runTransaction(db, async (transaction) => {
        const newDocRef = doc(collection(db, 'starlineGames'));
        transaction.set(newDocRef, {
          name: 'KALYAN 777 STARLINE',
          time: timeString,
          panna: '***',
          digit: '*',
          status: 'running', 
          active: true,
          createdAt: serverTimestamp(),
        });
      });
      toast({ title: 'Success', description: 'Hourly slot added successfully.' });
      gameForm.reset();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onUpdateResult = async (values: z.infer<typeof resultSchema>) => {
    if (!selectedGameId) return;
    const game = games.find(g => g.id === selectedGameId);
    if (!game) return;

    setIsSubmitting(true);
    const panna = values.panna;
    const digit = (panna.split('').reduce((a, b) => a + parseInt(b), 0) % 10).toString();

    try {
      // 1. Fetch Bids outside transaction
      const bidsQuery = query(
        collection(db, 'bids'),
        where('gameId', '==', selectedGameId),
        where('status', '==', 'running')
      );
      const bidsSnapshot = await getDocs(bidsQuery);

      await runTransaction(db, async (transaction) => {
        // 2. READS FIRST
        const settingsSnap = await transaction.get(doc(db, 'settings', 'app-settings'));
        const settings = settingsSnap.data() || {};
        
        // Map unique winners to fetch their balance
        const winnerUids = Array.from(new Set(
          bidsSnapshot.docs.filter(doc => {
            const bid = doc.data();
            return (bid.betType === 'singleDigit' && bid.numbers.includes(digit)) || 
                   (bid.numbers.includes(panna));
          }).map(doc => doc.data().userId)
        ));

        const userSnaps: Record<string, any> = {};
        for (const uid of winnerUids) {
          const snap = await transaction.get(doc(db, 'users', uid));
          if (snap.exists()) userSnaps[uid] = snap.data();
        }

        // 3. WRITES SECOND
        const gameRef = doc(db, 'starlineGames', selectedGameId);
        transaction.update(gameRef, { panna, digit, status: 'closed' });

        for (const bidDoc of bidsSnapshot.docs) {
          const bid = bidDoc.data();
          let isWinner = false;
          let winRate = 0;

          if (bid.betType === 'singleDigit' && bid.numbers.includes(digit)) {
            isWinner = true;
            winRate = (settings.starlineRateSingleDigit || 100); 
          } else if (bid.betType === 'singlePana' && bid.numbers.includes(panna)) {
            isWinner = true;
            winRate = (settings.starlineRateSinglePana || 1500);
          } else if (bid.betType === 'doublePana' && bid.numbers.includes(panna)) {
            isWinner = true;
            winRate = (settings.starlineRateDoublePana || 3000);
          } else if (bid.betType === 'triplePana' && bid.numbers.includes(panna)) {
            isWinner = true;
            winRate = (settings.starlineRateTriplePana || 7000);
          }

          if (isWinner) {
            const winAmount = (bid.totalAmount / bid.numbers.length) * (winRate / 10);
            const userRef = doc(db, 'users', bid.userId);
            const userData = userSnaps[bid.userId] || { balance: 0, bonusBalance: 0 };
            
            const isBonus = bid.betSource === 'bonus';
            if (isBonus) {
              transaction.update(userRef, { bonusBalance: increment(winAmount) });
            } else {
              transaction.update(userRef, { balance: increment(winAmount) });
            }

            transaction.update(bidDoc.ref, { status: 'won', winningAmount: winAmount });
            
            await logTransaction({
              userId: bid.userId,
              userName: bid.displayName,
              amount: winAmount,
              type: 'win',
              description: `Starline Win (${game.time})`,
              balanceBefore: userData.balance || 0,
              balanceAfter: isBonus ? (userData.balance || 0) : (userData.balance || 0) + winAmount,
              bonusBalanceBefore: userData.bonusBalance || 0,
              bonusBalanceAfter: isBonus ? (userData.bonusBalance || 0) + winAmount : (userData.bonusBalance || 0),
              relatedId: bidDoc.id
            }, transaction);
          } else {
            transaction.update(bidDoc.ref, { status: 'lost' });
          }
        }
      });

      toast({ title: 'Result Published', description: `Result updated for ${game.time}` });
      resultForm.reset();
      setSelectedGameId(null);
    } catch (error: any) {
      console.error("Starline Result Error:", error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDeleteGame = async (id: string) => {
    await deleteDoc(doc(db, 'starlineGames', id));
    toast({ title: 'Deleted', description: 'Game slot removed.' });
  };

  const handleResetAll = async () => {
    setIsResetting(true);
    try {
      const batch = writeBatch(db);
      games.forEach((game) => {
        const docRef = doc(db, 'starlineGames', game.id);
        batch.update(docRef, {
          panna: '***',
          digit: '*',
          status: 'running'
        });
      });
      await batch.commit();
      toast({ title: 'Success', description: 'All starline results have been reset.' });
    } catch (error) {
      console.error("Reset Error:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to reset results.' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="container mx-auto space-y-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Star className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl">KALYAN 777 Starline Management</CardTitle>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isResetting || games.length === 0}>
                  {isResetting ? <Loader className="mr-2 h-4 w-4" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  Reset All Results
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[340px] rounded-2xl p-4">
                <AlertDialogHeader className="space-y-2">
                  <AlertDialogTitle className="text-lg">Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="text-xs">
                    This will reset all starline game results. This action is useful for starting a new day but cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-col gap-2 mt-4">
                  <AlertDialogAction onClick={handleResetAll} className="rounded-xl h-10 text-sm">Reset All</AlertDialogAction>
                  <AlertDialogCancel className="rounded-xl h-10 text-sm border-gray-200">Cancel</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <CardDescription>Add hourly slots and publish results for Starline games.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...gameForm}>
            <form onSubmit={gameForm.handleSubmit(onAddGame)} className="flex items-end gap-4 bg-muted/30 p-4 rounded-lg">
              <div className="grid grid-cols-3 gap-2 flex-1">
                <FormField
                  control={gameForm.control}
                  name="hour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hour</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Hr" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hours.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={gameForm.control}
                  name="minute"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minute</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Min" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {minutes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={gameForm.control}
                  name="ampm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AM/PM</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isSubmitting} className="mb-0.5"><Plus className="mr-2 h-4 w-4" /> Add Slot</Button>
            </form>
          </Form>

          {loading ? <div className="flex justify-center p-10"><Loader /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell className="font-bold">{game.time}</TableCell>
                    <TableCell>{game.panna} - {game.digit}</TableCell>
                    <TableCell className="capitalize text-xs font-bold text-muted-foreground">{game.status}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedGameId(game.id);
                        resultForm.reset({ panna: '' });
                      }}>
                        Update Result
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onDeleteGame(game.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedGameId} onOpenChange={(open) => !open && setSelectedGameId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Result for {games.find(g => g.id === selectedGameId)?.time}</DialogTitle>
            <DialogDescription>
              Enter the winning panna. Digit will be calculated automatically.
            </DialogDescription>
          </DialogHeader>
          <Form {...resultForm}>
            <form onSubmit={resultForm.handleSubmit(onUpdateResult)} className="space-y-4 py-4">
              <FormField
                control={resultForm.control}
                name="panna"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Winning Panna (3 Digits)</FormLabel>
                    <FormControl>
                      <Input 
                        maxLength={3} 
                        placeholder="e.g. 123" 
                        {...field} 
                        className="text-2xl text-center font-bold h-14"
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col items-center justify-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-bold text-primary uppercase mb-1">Single Digit</p>
                <p className="text-6xl font-black text-primary leading-none">{calculatedDigit}</p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1 h-12" disabled={isSubmitting}>
                  {isSubmitting ? <Loader className="mr-2 h-4 w-4 mr-2" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Publish Result
                </Button>
                <Button type="button" variant="ghost" className="h-12" onClick={() => setSelectedGameId(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
