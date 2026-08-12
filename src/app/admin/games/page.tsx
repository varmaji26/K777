'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, serverTimestamp, query, onSnapshot, orderBy, DocumentData, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@/components/loader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, Clock } from 'lucide-react';
import { useGameStore } from '@/lib/store';
import { formatTime } from '@/lib/utils';
import { EditGameDialog } from './components/edit-game-dialog';

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const gameSchema = z.object({
  name: z.string().min(1, 'Game name is required.'),
  openResult: z.string().optional(),
  closeResult: z.string().optional(),
  status: z.string().min(1, 'Status is required.'),
  openTime: z.string().min(1, 'Open time is required.'),
  closeTime: z.string().min(1, 'Close time is required.'),
  activeDays: z.array(z.string()).refine((value) => value.some((day) => day), {
    message: "You have to select at least one day.",
  }),
});

type GameFormValues = z.infer<typeof gameSchema>;

interface Game extends DocumentData {
    id: string;
    name: string;
    openTime: string;
    closeTime: string;
    status: string;
    active: boolean; // Master switch
    activeDays?: string[]; // Days of the week it runs
}

export default function ManageGamesPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { games, addGame, deleteGame, updateGame, resetAllResults } = useGameStore();
  const [loading, setLoading] = useState(true);
  const [currentDay, setCurrentDay] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [isResetting, setIsResetting] = useState(false);


  useEffect(() => {
    const date = new Date();
    const dayName = date.toLocaleString('en-US', { weekday: 'long' });
    setCurrentDay(dayName);
    if(games.length > 0) {
        setLoading(false);
    }
  }, [games]);

  const form = useForm<GameFormValues>({
    resolver: zodResolver(gameSchema),
    defaultValues: {
      name: '',
      openResult: '***',
      closeResult: '**',
      status: 'Betting is Open',
      openTime: '',
      closeTime: '',
      activeDays: daysOfWeek, // Select all days by default
    },
  });
  
  const onSubmit = async (values: GameFormValues) => {
    setIsSubmitting(true);
    try {
      await addGame({
        ...values,
        active: true,
        createdAt: serverTimestamp()
      });
      toast({
        title: 'Success!',
        description: 'New game has been added.',
      });
      form.reset();
    } catch (error) {
      console.error('Error adding document: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add the game. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteGame = async (gameId: string) => {
    try {
        await deleteGame(gameId);
        toast({
            title: 'Success!',
            description: 'Game has been deleted.'
        });
    } catch (error) {
        console.error("Error deleting game: ", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to delete game. Please try again.',
        });
    }
  };

  const handleStatusToggle = async (gameId: string, currentStatus: boolean) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;
    try {
        await updateGame(game.id, { active: !currentStatus });
        toast({
            title: 'Status Updated',
            description: `Game master status has been changed to ${!currentStatus ? 'Active' : 'Inactive'}.`
        });
    } catch (error) {
        console.error("Error updating status: ", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to update game status. Please try again.'
        });
    }
  };

  const handleResetAllResults = async () => {
    setIsResetting(true);
    try {
        await resetAllResults();
        toast({
            title: 'Success!',
            description: 'All game results have been reset.'
        });
    } catch (error) {
        console.error('Error resetting results:', error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to reset game results.'
        });
    } finally {
        setIsResetting(false);
    }
  };
  
  const isGameActiveToday = (game: Game) => {
    if (!game.active) return false; // Master switch is off
    if (!game.activeDays || game.activeDays.length === 0) return true; // if no days are set, assume it runs everyday
    return game.activeDays.includes(currentDay);
  };
  
  const filteredGames = useMemo(() => {
    if (!selectedGameId) {
        return [];
    }
    return games.filter(game => game.id === selectedGameId);
  }, [games, selectedGameId]);


  return (
    <div className="container mx-auto px-4 py-8 flex-1 space-y-6">
      <div className="grid gap-6">
        <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Add New Game</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Game Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Milan Night" {...field} className="bg-input h-12 rounded-lg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Betting Status</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-input h-12 rounded-lg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="openTime"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Open Time</FormLabel>
                          <FormControl>
                              <Input placeholder="e.g., 08:50 PM" {...field} className="bg-input h-12 rounded-lg" type="time" />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                      />
                      <FormField
                      control={form.control}
                      name="closeTime"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Close Time</FormLabel>
                          <FormControl>
                              <Input placeholder="e.g., 10:50 PM" {...field} className="bg-input h-12 rounded-lg" type="time" />
                          </FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                      />
                  </div>
                  <FormField
                    control={form.control}
                    name="activeDays"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">Game Active Days</FormLabel>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {daysOfWeek.map((day) => (
                            <FormField
                              key={day}
                              control={form.control}
                              name="activeDays"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={day}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(day)}
                                        onCheckedChange={(checked) => {
                                          const currentDays = field.value || [];
                                          return checked
                                            ? field.onChange([...currentDays, day])
                                            : field.onChange(
                                                currentDays.filter(
                                                  (value) => value !== day
                                                )
                                              )
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                      {day}
                                    </FormLabel>
                                  </FormItem>
                                )
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-12 rounded-lg text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
                    {isSubmitting ? <Loader className="mr-2 h-5 w-5" /> : null}
                    Add Game
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl">All Games</CardTitle>
                        <CardDescription>View, edit, or delete existing games. Today is {currentDay}.</CardDescription>
                    </div>
                    <div className="space-y-4">
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
                                        This will reset all game results. This action useful for starting a new day but cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex flex-col gap-2 mt-4">
                                    <AlertDialogAction onClick={handleResetAllResults} className="rounded-xl h-10 text-sm">Reset All</AlertDialogAction>
                                    <AlertDialogCancel className="rounded-xl h-10 text-sm border-gray-200">Cancel</AlertDialogCancel>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
               <div className="mb-4">
                    <Select 
                        value={selectedGameId} 
                        onValueChange={(value) => {
                            if (value === 'all') {
                                setSelectedGameId('');
                            } else {
                                setSelectedGameId(value);
                            }
                        }}
                    >
                        <SelectTrigger className="w-full sm:w-[280px]">
                            <SelectValue placeholder="Filter by game..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Games</SelectItem>
                            {games.map((game) => (
                                <SelectItem key={game.id} value={game.id}>
                                    {game.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
              {loading ? (
                  <div className="flex justify-center items-center h-48">
                      <Loader className="h-10 w-10 text-primary" />
                  </div>
              ) : (
                  <div className="overflow-x-auto">
                    {(selectedGameId && filteredGames.length > 0) ? (
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>ID</TableHead>
                                  <TableHead>Game Name</TableHead>
                                  <TableHead>Game Status</TableHead>
                                  <TableHead>Betting Status</TableHead>
                                  <TableHead>Master Control</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {filteredGames.map((game, index) => {
                                  const isActiveToday = isGameActiveToday(game);
                                  return (
                                  <TableRow key={game.id}>
                                      <TableCell>{index + 1}</TableCell>
                                      <TableCell>
                                          <div className="flex flex-col gap-2">
                                              <span>{game.name}</span>
                                              <span className="text-xs text-muted-foreground">{formatTime(game.openTime)} - {formatTime(game.closeTime)}</span>
                                          </div>
                                      </TableCell>
                                      <TableCell>
                                          <Badge variant={isActiveToday ? 'default' : 'destructive'} className={isActiveToday ? 'bg-green-500 text-white' : ''}>
                                              {isActiveToday ? 'ACTIVE' : 'INACTIVE'}
                                          </Badge>
                                      </TableCell>
                                      <TableCell>{game.status}</TableCell>
                                      <TableCell>
                                          <div className="flex items-center space-x-2">
                                              <Switch
                                                  checked={game.active}
                                                  onCheckedChange={() => handleStatusToggle(game.id, game.active)}
                                                  aria-label={`Toggle game master status for ${game.name}`}
                                              />
                                              <span className="text-xs text-muted-foreground">{game.active ? 'On' : 'Off'}</span>
                                          </div>
                                      </TableCell>
                                      <TableCell className="text-right">
                                          <div className="flex flex-wrap gap-2 justify-end">
                                               <EditGameDialog game={game} />
                                              <AlertDialog>
                                                  <AlertDialogTrigger asChild>
                                                      <Button size="sm" variant="destructive">Delete</Button>
                                                  </AlertDialogTrigger>
                                                  <AlertDialogContent className="max-w-[340px] rounded-2xl p-4">
                                                      <AlertDialogHeader className="space-y-2">
                                                          <AlertDialogTitle className="text-lg">Are you sure?</AlertDialogTitle>
                                                          <AlertDialogDescription className="text-xs">
                                                              This will permanently delete the game. This action cannot be undone.
                                                          </AlertDialogDescription>
                                                      </AlertDialogHeader>
                                                      <AlertDialogFooter className="flex flex-col gap-2 mt-4">
                                                          <AlertDialogAction onClick={() => handleDeleteGame(game.id)} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 text-sm">Delete Game</AlertDialogAction>
                                                          <AlertDialogCancel className="rounded-xl h-10 text-sm border-gray-200">Cancel</AlertDialogCancel>
                                                      </AlertDialogFooter>
                                                  </AlertDialogContent>
                                              </AlertDialog>
                                          </div>
                                      </TableCell>
                                  </TableRow>
                                  )
                              })}
                          </TableBody>
                      </Table>
                      ) : (
                        <div className="text-center text-muted-foreground p-8 border border-dashed rounded-md">
                          {selectedGameId ? 'No details found for this game.' : 'Please select a game to view details.'}
                        </div>
                      )}
                  </div>
              )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
