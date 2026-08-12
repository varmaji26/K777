
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tag } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader } from '@/components/loader';
import Link from 'next/link';

interface GameRates {
  singleDigit?: number;
  jodiDigit?: number;
  singlePana?: number;
  doublePana?: number;
  triplePana?: number;
  halfSangam?: number;
  fullSangam?: number;
}

const gameRateNames: { key: keyof GameRates, name: string }[] = [
    { key: 'singleDigit', name: 'SINGLE DIGIT' },
    { key: 'jodiDigit', name: 'JODI DIGIT' },
    { key: 'singlePana', name: 'SINGLE PANNA' },
    { key: 'doublePana', name: 'DOUBLE PANNA' },
    { key: 'triplePana', name: 'TRIPLE PANNA' },
    { key: 'halfSangam', name: 'HALF SANGAM' },
    { key: 'fullSangam', name: 'FULL SANGAM' },
];

export default function GameRatesPage() {
    const router = useRouter();
    const [rates, setRates] = useState<GameRates | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRates = async () => {
            setLoading(true);
            try {
                const ratesDocRef = doc(db, 'settings', 'gameRates');
                const ratesDocSnap = await getDoc(ratesDocRef);
                if (ratesDocSnap.exists()) {
                    setRates(ratesDocSnap.data() as GameRates);
                } else {
                     // Set default rates if not found in Firestore
                    setRates({
                        singleDigit: 9.5,
                        jodiDigit: 95,
                        singlePana: 140,
                        doublePana: 280,
                        triplePana: 700,
                        halfSangam: 1000,
                        fullSangam: 10000,
                    });
                }
            } catch (error) {
                console.error("Error fetching game rates:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRates();
    }, []);

    const formatRate = (rate?: number) => {
        if (typeof rate !== 'number') return 'N/A';
        const winningAmount = 10 * rate;
        return `₹10 - ₹${winningAmount}`;
    };
    
    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <header className="sticky top-0 z-40 w-full border-b bg-header text-white">
                <div className="container flex h-16 items-center justify-center">
                    <h1 className="font-bold text-lg">Game Rates</h1>
                </div>
            </header>
            <main className="flex-1 p-4">
                 <div className="space-y-6">
                    <div>
                        <div className="border rounded-lg overflow-hidden bg-white shadow-md">
                           {loading ? (
                                <div className="flex justify-center items-center h-64">
                                    <Loader className="h-10 w-10 text-primary" />
                                </div>
                           ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-100">
                                        <TableHead className="font-semibold text-gray-700">Game Type</TableHead>
                                        <TableHead className="text-right font-semibold text-gray-700">Rate</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gameRateNames.map((item) => (
                                        <TableRow key={item.key}>
                                            <TableCell className="font-medium text-gray-800">{item.name}</TableCell>
                                            <TableCell className="text-right font-mono font-medium text-gray-600">
                                                {formatRate(rates?.[item.key])}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                           )}
                        </div>
                    </div>
                     <div>
                        <h3 className="text-lg font-semibold mb-2 text-primary">STARLINE GAMES</h3>
                         <div className="border rounded-lg p-4 text-center bg-white shadow-md">
                            <p className="text-muted-foreground">Rates for Starlines Games will be updated soon.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
