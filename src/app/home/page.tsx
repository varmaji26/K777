'use client';

import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameCard } from '@/components/game-card';
import dynamic from 'next/dynamic';
import { Landmark, Plus, Star } from 'lucide-react';
import { useGameStore, useUserStore } from '@/lib/store';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { GameRatesDialog } from '@/components/game-rates-dialog';
import Link from 'next/link';
import { isGameRunning } from '@/lib/utils';

const DepositDialog = dynamic(() => import('@/components/deposit-dialog').then(mod => mod.DepositDialog), {
  loading: () => <Skeleton className="h-12 w-40" />,
  ssr: false,
});


export default function HomePage() {
  const games = useGameStore((state) => state.games);
  const marketOpenTime = useGameStore((state) => state.marketOpenTime);
  const unsubscribe = useGameStore((state) => state.unsubscribe);
  const { currentUser } = useUserStore();

  useEffect(() => {
    // The store now handles subscription, but we need to ensure it's cleaned up
    // when the component unmounts if it's the last one using it.
    // In this simple app structure, unsubscribing on home page unmount is safe.
    return () => {
      // Note: If multiple components used the store, you'd want a more robust
      // subscription management, but this works for our case.
      // The store's unsubscribe is now a bit of a misnomer, it just detaches this listener.
    };
  }, []);

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
        const aIsRunning = isGameRunning(a, marketOpenTime);
        const bIsRunning = isGameRunning(b, marketOpenTime);

        if (aIsRunning && !bIsRunning) {
            return -1; // a comes first
        }
        if (!aIsRunning && bIsRunning) {
            return 1; // b comes first
        }
        return 0; // maintain original order otherwise
    });
  }, [games, marketOpenTime]);


  return (
    <main className="flex flex-col pb-24">
      <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
        
        <section className="space-y-2">
            {sortedGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
        </section>

      </div>
    </main>
  );
}
