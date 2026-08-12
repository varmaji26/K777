
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ArrowUp, ArrowDown, BarChart2, Trophy, Gift } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Footer } from '@/components/layout/footer';
import { useUserStore } from '@/lib/store';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader } from '@/components/loader';
import type { Transaction } from '@/lib/types';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';


const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'N/A';
    return format(new Date(timestamp.seconds * 1000), 'dd MMM yyyy, hh:mm a');
};

const getStatusTitle = (transaction: Transaction): string => {
    if (transaction.type === 'deposit') {
        if(transaction.status === 'pending') return 'Pending Deposit';
        if(transaction.status === 'rejected') return 'Rejected Deposit';
        return 'Deposit Approved';
    }
    if (transaction.type === 'win') {
        return 'Congratulations! you win';
    }
     if (transaction.type === 'welcome_bonus') {
        return 'Welcome Bonus';
    }
    if (transaction.type === 'withdrawal_approved') {
        return 'Withdrawal Approved';
    }
     if (transaction.type === 'withdrawal' && transaction.status === 'pending') {
        return 'Pending Withdrawal';
    }
    if (transaction.type === 'bid_placed') {
        return 'Bid Placed';
    }
     if (transaction.type === 'withdrawal_rejected' || (transaction.type === 'withdrawal' && transaction.status === 'rejected')) {
        return 'Withdrawal Rejected';
    }
    return transaction.title || 'Transaction';
}

const formatDescription = (desc: string): { gameName: string; details: string } | string => {
    const bidPlacedRegex = /^Bid placed on (.+?) \((.+?)\)\. (?:Numbers|Panas): (.+)$/;
    const winRegex = /^Won on (.+?) \((.+?)\)\. Winning Number: (.+)$/;
    
    const bidMatch = desc.match(bidPlacedRegex);
    if (bidMatch) {
        const [, gameName, typeAndSession, numbers] = bidMatch;
        return { gameName: gameName.trim(), details: `(${typeAndSession}). Panas: ${numbers}` };
    }

    const winMatch = desc.match(winRegex);
    if (winMatch) {
        const [, gameName, type, winningNumber] = winMatch;
        return { gameName: gameName.trim(), details: `(${type}). Winning Number: ${winningNumber}` };
    }
    
    if (desc.toLowerCase().includes('fund add by admin')) {
        return 'Fund added';
    }
    return desc;
};


const TransactionItem = ({ transaction }: { transaction: Transaction }) => {
    const isCredit = ['deposit', 'win', 'welcome_bonus'].includes(transaction.type);
    const amountColor = isCredit ? 'text-green-600' : 'text-red-600';
    const statusTitle = getStatusTitle(transaction);
    
    const formattedDesc = formatDescription(transaction.description);


    return (
        <div className={cn("bg-white shadow-md overflow-hidden rounded-lg", transaction.type === 'win' && 'animate-won-glow')}>
           <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-white text-center py-0.5">
                <p className="font-semibold text-xs">{statusTitle}</p>
            </div>
            <div className="p-1.5 space-y-1">
                <div className="grid grid-cols-2 text-center items-center">
                   <div className="flex flex-col items-center justify-center">
                       <p className="text-[9px] text-gray-500">Amount</p>
                       <p className={cn("font-bold text-base", amountColor)}>
                            {isCredit ? '+' : ''}₹{transaction.amount.toLocaleString()}
                        </p>
                   </div>
                    <div className="flex flex-col items-center justify-center">
                        {typeof formattedDesc === 'object' ? (
                            <div className="font-semibold text-[11px] whitespace-normal break-words text-left">
                                <p>{formattedDesc.gameName}</p>
                                <p className="text-gray-600">{formattedDesc.details}</p>
                            </div>
                        ) : (
                             <p className="font-semibold text-[11px] whitespace-normal break-words">{formattedDesc}</p>
                        )}
                    </div>
                </div>
                 <div className="border-t pt-0.5 text-center text-[9px] text-gray-500">
                    Transaction: {formatDate(transaction.createdAt)}
                 </div>
            </div>
             <div className="bg-slate-50 p-1.5 text-[9px] border-t border-slate-100 rounded-b-lg space-y-1">
                <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Point Before: ₹{transaction.balanceBefore?.toLocaleString() ?? '0'}</span>
                    <span className="text-blue-600 font-bold">Point After: ₹{transaction.balanceAfter?.toLocaleString() ?? '0'}</span>
                </div>
                {(transaction.bonusBalanceBefore !== undefined || transaction.bonusBalanceAfter !== undefined) && (
                    <div className="flex justify-between items-center pt-0.5 border-t border-slate-200/50">
                        <span className="text-slate-500 font-medium">Bonus Before: ₹{transaction.bonusBalanceBefore?.toLocaleString() ?? '0'}</span>
                        <span className="text-orange-600 font-bold">Bonus After: ₹{transaction.bonusBalanceAfter?.toLocaleString() ?? '0'}</span>
                    </div>
                )}
             </div>
        </div>
    );
};

interface SummaryCardProps {
    title: string;
    amount: number;
    icon: React.ElementType;
    color: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, amount, icon: Icon, color }) => (
    <div className="bg-white p-3 rounded-lg shadow-sm flex items-center gap-3">
        <div className={cn("p-2 rounded-full", color)}>
           <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
            <p className="text-xs text-gray-500">{title}</p>
            <p className="text-sm font-bold text-gray-800">₹{amount.toLocaleString()}</p>
        </div>
    </div>
);


export default function PassbookPage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!currentUser) {
        setLoading(false);
        return;
    }
    setLoading(true);

    const q = query(
      collection(db, "transactions"), 
      where("userId", "==", currentUser.id)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const transData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(transData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching transactions: ", error);
        toast({ title: "Error", description: "Could not fetch transaction history.", variant: "destructive" });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, toast]);
  
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        filtered = filtered.filter(t => t.createdAt && new Date(t.createdAt.seconds * 1000) >= start);
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        filtered = filtered.filter(t => t.createdAt && new Date(t.createdAt.seconds * 1000) <= end);
    }
    filtered.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    return filtered;
  }, [transactions, startDate, endDate]);

  const { totalDeposit, totalWithdrawal, totalBet, totalWin, totalBonus } = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
        if (t.type === 'deposit' && t.status === 'approved') acc.totalDeposit += t.amount;
        if (t.type === 'withdrawal_approved') acc.totalWithdrawal += Math.abs(t.amount);
        if (t.type === 'bid_placed') acc.totalBet += Math.abs(t.amount);
        if (t.type === 'win') acc.totalWin += t.amount;
        if (t.type === 'welcome_bonus') acc.totalBonus += t.amount;
        return acc;
    }, { totalDeposit: 0, totalWithdrawal: 0, totalBet: 0, totalWin: 0, totalBonus: 0 });
  }, [filteredTransactions]);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE) || 1;

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 w-full border-b bg-header text-white">
        <div className="container flex h-16 items-center justify-center">
          <h1 className="font-bold text-lg">Transaction History</h1>
        </div>
      </header>
      <main className="flex-1 bg-background pb-24">
        <div className="container mx-auto px-4 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="start-date" className="text-xs font-medium text-gray-700 mb-1 block">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="start-date" variant={"outline"} className={cn("w-full justify-start text-left font-normal h-10",!startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd-MM-yy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus/></PopoverContent>
                </Popover>
              </div>
              <div>
                <label htmlFor="end-date" className="text-xs font-medium text-gray-700 mb-1 block">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="end-date" variant={"outline"} className={cn("w-full justify-start text-left font-normal h-10", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd-MM-yy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={{ before: startDate }} initialFocus/></PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <SummaryCard title="Total Deposit" amount={totalDeposit} icon={ArrowUp} color="bg-green-500" />
                <SummaryCard title="Total Withdrawal" amount={totalWithdrawal} icon={ArrowDown} color="bg-red-500" />
                <SummaryCard title="Total Bet" amount={totalBet} icon={BarChart2} color="bg-blue-500" />
                <SummaryCard title="Total Win" amount={totalWin} icon={Trophy} color="bg-amber-500" />
                <div className="col-span-2">
                   <SummaryCard title="Total Bonus" amount={totalBonus} icon={Gift} color="bg-purple-500" />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader className="h-10 w-10 text-primary"/></div>
            ) : paginatedTransactions.length === 0 ? (
                <div className="text-center text-gray-500 py-16">
                    <Image src="https://img.icons8.com/cute-clipart/128/search-more.png" alt="No data" width={80} height={80} className="mx-auto mb-4" />
                    <p className="text-lg font-semibold">No Transactions Found</p>
                    <p className="text-sm">There are no records in the selected date range.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {paginatedTransactions.map(tx => <TransactionItem key={tx.id} transaction={tx} />)}
                </div>
            )}
        </div>
        
        {!loading && paginatedTransactions.length > 0 && (
            <div className="container mx-auto px-4 py-4 mt-auto">
                <div className="flex justify-between items-center text-sm">
                    <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="bg-gray-200 border-gray-300 shadow-sm"
                    >
                        {'<<'} Previous
                    </Button>
                    <span className="font-medium text-gray-600">{currentPage}/{totalPages}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))}
                        disabled={currentPage === totalPages}
                        className="bg-gray-200 border-gray-300 shadow-sm"
                    >
                        Next {'>>'}
                    </Button>
                </div>
            </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
