'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader } from '@/components/loader';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/lib/store';

interface PanelChartData extends DocumentData {
  id: string;
  gameName: string;
  title: string;
  data: string;
  activeDays?: string[];
}

const isRedNumber = (num: string) => {
    if (!num || num === '**' || num.length !== 2) return false;
    const digits = num.split('');
    if (digits.some(d => isNaN(parseInt(d)))) return false;
    const [first, second] = [parseInt(digits[0]), parseInt(digits[1])];
    const diff = Math.abs(first - second);
    return diff === 5 || first === second;
};

const DayCell = ({ dayData }: { dayData: { openPana: string; jodi: string; closePana: string; } }) => {
    const { openPana, jodi, closePana } = dayData;
    
    if (jodi === '**' || openPana === '***' ) {
      return (
        <div className="relative p-0 min-h-[30px] flex items-center justify-center text-black font-bold text-base">
            **
        </div>
      );
    }
    
    const isRed = isRedNumber(jodi);
    
    return (
        <div className="flex items-center justify-center p-0 min-h-[30px] gap-0">
            <div className={cn("text-center text-[12px] font-semibold leading-tight flex flex-col", isRed ? 'text-red-600' : 'text-black')}>
                {openPana.split('').map((digit, i) => <span key={i}>{digit === '*' ? ' ' : digit}</span>)}
            </div>
            <span className={cn("text-base mx-0.5 font-bold", isRed ? 'text-red-600' : 'text-black')}>{jodi}</span>
            <div className={cn("text-center text-[12px] font-semibold leading-tight flex flex-col", isRed ? 'text-red-600' : 'text-black')}>
                {closePana.split('').map((digit, i) => <span key={i}>{digit === '*' ? ' ' : digit}</span>)}
            </div>
        </div>
    );
};

const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayAbbreviations: { [key: string]: string } = {
    Monday: 'Mo',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun',
};

const getResultDisplay = (game: DocumentData | undefined | null): string | null => {
    if (!game) return null;

    const sumDigits = (pana: string) => {
        if (!pana || typeof pana !== 'string' || pana.length !== 3 || !/^\d+$/.test(pana)) {
            return '*';
        }
        return (pana.split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0) % 10).toString();
    };

    const openPana = game.openResult || '***';
    const closePana = game.closeResult || '***';
    
    const openJodi = sumDigits(game.openResult || '');
    const closeJodi = sumDigits(game.closeResult || '');

    if (openPana === '***' && closePana === '***') {
        return '***-**-***';
    }
    
    if (openPana !== '***' && (closePana === '***' || closePana === '**')) {
        return `${openPana}-${openJodi}*-***`;
    }

    if (openPana === '***' && closePana !== '***') {
        return `***-*${closeJodi}-${closePana}`;
    }

    return `${openPana}-${openJodi}${closeJodi}-${closePana}`;
};

export default function PanelChartPage() {
    const params = useParams();
    const gameId = typeof params.gameId === 'string' ? params.gameId : '';
    const game = useGameStore((state) => state.getGameById(gameId));
    
    const [chartData, setChartData] = useState<PanelChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        if (typeof gameId !== 'string') return;

        const fetchChartData = async () => {
            setLoading(true);
            try {
                const chartDocRef = doc(db, 'panelCharts', gameId);
                const chartDoc = await getDoc(chartDocRef);
                if (chartDoc.exists()) {
                    setChartData({ id: chartDoc.id, ...chartDoc.data() } as PanelChartData);
                }
            } catch (error) {
                console.error("Error fetching Panel chart data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchChartData();
    }, [gameId]);
    
    const currentResult = getResultDisplay(game);
    const activeDays = chartData?.activeDays && chartData.activeDays.length > 0 ? chartData.activeDays : allDays;
    const dayIndices = activeDays.map(day => allDays.indexOf(day));

    const parsedRows = React.useMemo(() => {
        if (!chartData?.data) return [];
        
        const dataString = chartData.data.replace(/\r/g, '');
        const dateRangeRegex = /(\d{2}\/\d{2}\/\d{4})\s*to\s*(\d{2}\/\d{2}\/\d{4})/g;
        
        const sections = dataString.split(dateRangeRegex).filter(s => s && s.trim() !== '');

        const rows = [];
        for (let i = 0; i < sections.length; i += 3) {
            const startDate = sections[i];
            const endDate = sections[i + 1];

            if (typeof startDate === 'undefined' || typeof endDate === 'undefined') {
                continue;
            }
            
            const dataBlock = sections[i + 2] || '';
            const dateRange = { start: startDate.trim(), end: endDate.trim() };
            
            const weeklyData = dataBlock.trim().split(/\s+/).join('');

            const daysData: { openPana: string; jodi: string; closePana: string; }[] = [];
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                 let currentIndex = dayIndex * 8;
                 if (weeklyData.length >= currentIndex + 8) {
                     const openPana = weeklyData.slice(currentIndex, currentIndex + 3);
                     const jodi = weeklyData.slice(currentIndex + 3, currentIndex + 5);
                     const closePana = weeklyData.slice(currentIndex + 5, currentIndex + 8);
                     daysData.push({ openPana, jodi, closePana });
                } else {
                    daysData.push({ openPana: '***', jodi: '**', closePana: '***' });
                }
            }
            const filteredDaysData = dayIndices.map(index => daysData[index]);
            rows.push({ dateRange, daysData: filteredDaysData });
        }
        return rows;
    }, [chartData, dayIndices]);

    if (!isClient || loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader className="h-10 w-10 text-primary" />
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gray-100">
            <header className="sticky top-0 z-40 w-full border-b bg-header text-white">
                <div className="container flex flex-col items-center justify-center py-3">
                    <h1 className="font-bold text-lg leading-tight mb-1 text-center">
                       {(chartData?.title || game?.name || 'GAME').toUpperCase()}
                    </h1>
                    {currentResult && (
                        <div className="text-center">
                            <p className="text-[10px] text-yellow-400 font-bold mb-1 uppercase">Current Result</p>
                            <div className="inline-block bg-white/20 text-white font-bold tracking-[0.1em] text-base px-4 py-0.5 rounded-full">
                                {currentResult}
                            </div>
                        </div>
                    )}
                </div>
                <div className="overflow-x-auto bg-header">
                    <table className="w-full border-collapse table-fixed">
                        <thead>
                            <tr className="text-white font-bold text-[10px]">
                                <th className="p-1 border border-white/40 w-16">Date</th>
                                {activeDays.map(day => (
                                    <th key={day} className="p-1 border border-white/40">{dayAbbreviations[day]}</th>
                                ))}
                            </tr>
                        </thead>
                    </table>
                </div>
            </header>
            <main>
                {chartData && parsedRows.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse table-fixed">
                            <tbody className="text-center">
                               {parsedRows.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        <td className="p-0.5 border border-black font-bold text-black text-[8px] bg-white w-16 leading-tight">
                                            <span>{row.dateRange.start}</span><br/>
                                            <span className="text-[7px] opacity-50 uppercase">To</span><br/>
                                            <span>{row.dateRange.end}</span>
                                        </td>
                                        {row.daysData.map((dayData, dayIndex) => (
                                            <td key={dayIndex} className="p-0 border border-black bg-white">
                                                <DayCell dayData={dayData} />
                                            </td>
                                        ))}
                                    </tr>
                               ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                     <p className="text-center text-muted-foreground mt-8 py-10">
                        No data found.
                     </p>
                )}
            </main>
        </div>
    );
}
