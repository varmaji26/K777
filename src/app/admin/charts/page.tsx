'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, DocumentData, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/loader';
import { PlusCircle, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartForm } from './components/chart-form';
import type { Game } from '@/lib/types';


interface PanelChartData extends DocumentData {
  id: string;
  gameName: string;
  title: string;
  data: string;
  activeDays?: string[];
}

export default function AdminChartsPage() {
  const [charts, setCharts] = useState<PanelChartData[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<{chart: PanelChartData | null, game: Game | null } | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    const gamesQuery = query(collection(db, "games"), orderBy("openTime"));
    const unsubGames = onSnapshot(gamesQuery, (snapshot) => {
        const gamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
        setGames(gamesData);
    });

    const chartsQuery = query(collection(db, "panelCharts"));
    const unsubCharts = onSnapshot(chartsQuery, (snapshot) => {
        const chartsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PanelChartData));
        setCharts(chartsData);
        setLoading(false);
    });

    return () => {
        unsubGames();
        unsubCharts();
    };
  }, []);

  const handleEdit = (chart: PanelChartData) => {
    const game = games.find(g => g.id === chart.id) || null;
    setEditingChart({ game, chart });
    setIsFormOpen(true);
  };
  
  const handleAddNew = () => {
    setEditingChart({ game: null, chart: null });
    setIsFormOpen(true);
  };

  const handleSave = async (game: Game, data: Omit<PanelChartData, 'id' | 'gameName'>) => {
    try {
      const chartRef = doc(db, 'panelCharts', game.id);
      await setDoc(chartRef, {
        gameName: game.name,
        ...data,
      }, { merge: true });
      toast({
        title: 'Chart Saved',
        description: `Panel chart for ${game.name} has been updated.`,
        className: 'bg-green-600 text-white'
      });
      setIsFormOpen(false);
      setEditingChart(null);
    } catch (error) {
      console.error("Error saving chart: ", error);
      toast({
        title: 'Error',
        description: 'Could not save the chart data.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (chartId: string) => {
    try {
      await deleteDoc(doc(db, 'panelCharts', chartId));
      toast({ title: 'Success', description: 'Chart deleted successfully.' });
    } catch (error) {
      console.error("Error deleting chart: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete chart.' });
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingChart(null);
  }

  const filteredCharts = useMemo(() => {
    if (selectedGameId === 'all') {
        return charts;
    }
    return charts.filter(chart => chart.id === selectedGameId);
  }, [charts, selectedGameId]);

  return (
    <div className="flex-1 space-y-6">
      
      {isFormOpen && editingChart && (
          <ChartForm
              isOpen={isFormOpen}
              setIsOpen={setIsFormOpen}
              game={editingChart.game}
              chart={editingChart.chart}
              onSave={(game, data) => handleSave(game, data)}
              onCancel={handleCancel}
              allGames={games}
          />
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl">Manage Panel Charts</CardTitle>
              <CardDescription>Manage Panel calendar charts for each game.</CardDescription>
            </div>
            <Button onClick={handleAddNew} className="bg-teal-500 hover:bg-teal-600">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Chart
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
             <Select value={selectedGameId} onValueChange={(value) => setSelectedGameId(value)}>
                <SelectTrigger className="w-full sm:w-[280px] h-11 rounded-lg border-teal-500 focus:ring-teal-500">
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
          
          {loading ? <div className="flex justify-center p-8"><Loader/></div> : (
          <div>
            <div className="hidden md:grid grid-cols-4 gap-4 px-4 py-2 border-b font-medium text-muted-foreground">
                <div>Game Name</div>
                <div>Chart Title</div>
                <div>Active Days</div>
                <div className="text-right">Actions</div>
            </div>
            <div className="space-y-2">
                {filteredCharts.length > 0 ? (
                    filteredCharts.map((item) => (
                        <div key={item.id} className="grid md:grid-cols-4 gap-4 items-center px-4 py-3 border-b hover:bg-muted/50 rounded-lg">
                           <div>
                             <div className="md:hidden font-bold">Game Name</div>
                             <div className="font-medium">{item.gameName}</div>
                           </div>
                           <div>
                             <div className="md:hidden font-bold mt-2">Chart Title</div>
                             <div>{item.title}</div>
                           </div>
                            <div>
                                <div className="md:hidden font-bold mt-2">Active Days</div>
                                <div className="text-xs text-muted-foreground">{(item.activeDays || []).join(', ')}</div>
                            </div>
                           <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="sm" onClick={() => handleEdit(item)}><Edit className="h-4 w-4" /></Button>
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the chart.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(item.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
                           </div>
                        </div>
                    ))
                ) : (
                     <div className="text-center text-muted-foreground p-8">
                       {selectedGameId && selectedGameId !== 'all' ? "No chart found for the selected game." : "No charts available. Add one to get started."}
                     </div>
                )}
            </div>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
