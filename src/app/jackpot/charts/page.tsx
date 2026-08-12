'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader } from '@/components/loader';
import { ChevronLeft, BarChart2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Helper to sort time strings chronologically
const parseTimeToMinutes = (timeString: string) => {
  if (!timeString || !timeString.includes(':')) return 9999;
  
  const cleanTime = timeString.trim().toUpperCase();
  const parts = cleanTime.split(' ');
  if (parts.length < 2) return 9999;

  const timePart = parts[0];
  const modifier = parts[1];
  const [hours, minutes] = timePart.split(':').map(Number);
  
  let h = hours;
  if (modifier === 'PM' && h < 12) h += 12;
  if (modifier === 'AM' && h === 12) h = 0;
  
  return h * 60 + minutes;
};

export default function JackpotChartsPage() {
  const router = useRouter();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'jackpotGames'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort chronologically on client side
      data.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
      setGames(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 w-full p-4 flex items-center gap-4 text-white bg-header">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-bold flex items-center gap-2">
          <BarChart2 className="h-5 w-5" />
          Jackpot Charts
        </h1>
      </header>

      <main className="flex-1 p-4">
        <Card className="border-none shadow-lg overflow-hidden rounded-2xl">
          <div className="bg-[#154c79] text-white p-3 text-center font-bold uppercase tracking-widest text-sm">
            Daily Jackpot Results
          </div>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-20"><Loader className="h-8 w-8 text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold text-blue-900">Slot Time</TableHead>
                    <TableHead className="text-center font-bold text-blue-900">Result (Jodi)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-10 text-muted-foreground">
                        No results available yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    games.map((game) => (
                      <TableRow key={game.id} className="border-b">
                        <TableCell className="font-bold text-sm">{game.time}</TableCell>
                        <TableCell className="text-center">
                          <div className="inline-block bg-gray-800 text-white px-5 py-1.5 rounded-full font-mono text-base tracking-[0.2em] font-black shadow-inner">
                            {game.result || '**'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
