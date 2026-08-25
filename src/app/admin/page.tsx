
'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, DocumentData, collection, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Gamepad2, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, Scale, Landmark, BarChart } from 'lucide-react';
import { Loader } from '@/components/loader';
import { useAuth } from '@/hooks/use-auth';
import { useUserStore, useGameStore } from '@/lib/store';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color?: string;
  textColor?: string;
}

function StatCard({ title, value, icon: Icon, color, textColor }: StatCardProps) {
  return (
    <Card className="bg-card/80 border-white/10 shadow-lg" style={{ borderLeft: color ? `4px solid ${color}` : undefined }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" style={{ color: textColor }}>{value}</div>
      </CardContent>
    </Card>
  );
}

interface AppStats {
    totalGames: number;
    totalBalance: number;
}

interface DailyStats {
    todaysDeposits: number;
    todaysWithdrawals: number;
    yesterdaysDeposits: number;
    yesterdaysWithdrawals: number;
}

interface BiddingStats {
    todaysBidding: number;
    todaysWinning: number;
    todaysProfitLoss: number;
}

interface MonthlyStats {
    totalBidding: number;
    totalProfit: number;
    totalDeposit: number;
    totalWithdrawal: number;
    monthlyNetBalance: number;
}

/**
 * Robust helper to sum approved transaction amounts from a snapshot.
 * Excludes manual entries by checking paymentMethod and withdrawalMethod.
 */
const sumApprovedAmount = (snapshot: any): number => {
    let total = 0;
    if (!snapshot || !snapshot.docs) return 0;
    
    snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        // Check status and ensure it's NOT a manual entry (either deposit or withdrawal)
        if (data.status === 'approved' && 
            data.paymentMethod !== 'Manual (Admin)' && 
            data.withdrawalMethod !== 'Manual (Admin)') {
            const val = parseFloat(data.amount);
            if (!isNaN(val)) {
                total += val;
            }
        }
    });
    return total;
};


export default function AdminDashboardPage() {
    const { user } = useAuth();
    const [stats, setStats] = useState<AppStats | null>(null);
    const [dailyStats, setDailyStats] = useState<DailyStats>({ todaysDeposits: 0, todaysWithdrawals: 0, yesterdaysDeposits: 0, yesterdaysWithdrawals: 0 });
    const [biddingStats, setBiddingStats] = useState<BiddingStats>({ todaysBidding: 0, todaysWinning: 0, todaysProfitLoss: 0 });
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({ totalBidding: 0, totalProfit: 0, totalDeposit: 0, totalWithdrawal: 0, monthlyNetBalance: 0 });
    const [loading, setLoading] = useState(true);
    
    const { users } = useUserStore();
    const { games } = useGameStore();
    const totalUsers = useMemo(() => users.filter(u => !u.isAdmin).length, [users]);
    const totalGames = useMemo(() => games.length, [games]);

    useEffect(() => {
        if (!user?.isAdmin) return;

        const statsDocRef = doc(db, "app-stats", "dashboard");
        const unsubscribeStats = onSnapshot(statsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setStats(docSnap.data() as AppStats);
            }
            setLoading(false);
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'app-stats/dashboard',
                operation: 'get'
            }));
            setLoading(false);
        });

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
       
        const todayDepositsQuery = query(collection(db, "deposits"), where("createdAt", ">=", startOfToday));
        const todayWithdrawalsQuery = query(collection(db, "withdrawals"), where("createdAt", ">=", startOfToday));
        const yesterdayDepositsQuery = query(collection(db, "deposits"), where("createdAt", ">=", startOfYesterday), where("createdAt", "<", startOfToday));
        const yesterdayWithdrawalsQuery = query(collection(db, "withdrawals"), where("createdAt", ">=", startOfYesterday), where("createdAt", "<", startOfToday));
        const bidsQuery = query(collection(db, "bids"), where("createdAt", ">=", startOfToday));

        const unsubTodayDeposits = onSnapshot(todayDepositsQuery, (snap) => {
            setDailyStats(s => ({ ...s, todaysDeposits: sumApprovedAmount(snap) }));
        });

        const unsubTodayWithdrawals = onSnapshot(todayWithdrawalsQuery, (snap) => {
            setDailyStats(s => ({ ...s, todaysWithdrawals: sumApprovedAmount(snap) }));
        });

        const unsubYesterdayDeposits = onSnapshot(yesterdayDepositsQuery, (snap) => {
            setDailyStats(s => ({ ...s, yesterdaysDeposits: sumApprovedAmount(snap) }));
        });

        const unsubYesterdayWithdrawals = onSnapshot(yesterdayWithdrawalsQuery, (snap) => {
            setDailyStats(s => ({ ...s, yesterdaysWithdrawals: sumApprovedAmount(snap) }));
        });

        const unsubBids = onSnapshot(bidsQuery, (bidsSnap) => {
            let todaysBidding = 0;
            let todaysWinning = 0;

            bidsSnap.forEach(doc => {
                const bid = doc.data();
                if (bid.status !== 'cancelled') {
                    const bidAmt = parseFloat(bid.totalAmount);
                    if (!isNaN(bidAmt)) todaysBidding += bidAmt;
                }
                if (bid.status === 'won') {
                    const winVal = parseFloat(bid.winningAmount);
                    if (!isNaN(winVal)) todaysWinning += winVal;
                }
            });
            setBiddingStats({
                todaysBidding,
                todaysWinning,
                todaysProfitLoss: todaysBidding - todaysWinning
            });
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'bids',
                operation: 'list'
            }));
        });

        return () => {
            unsubscribeStats();
            unsubTodayDeposits();
            unsubTodayWithdrawals();
            unsubYesterdayDeposits();
            unsubYesterdayWithdrawals();
            unsubBids();
        };
    }, [user]);

    useEffect(() => {
        if (!user?.isAdmin) return;

        const year = new Date().getFullYear();
        const month = new Date().getMonth();

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
        
        const depositsQuery = query(collection(db, "deposits"), where("createdAt", ">=", startOfMonth), where("createdAt", "<=", endOfMonth));
        const withdrawalsQuery = query(collection(db, "withdrawals"), where("createdAt", ">=", startOfMonth), where("createdAt", "<=", endOfMonth));
        const bidsQuery = query(collection(db, "bids"), where("createdAt", ">=", startOfMonth), where("createdAt", "<=", endOfMonth));
        
        const unsubDeposits = onSnapshot(depositsQuery, (snap) => {
            const totalDeposit = sumApprovedAmount(snap);
            setMonthlyStats(s => {
                const net = totalDeposit - (s.totalWithdrawal || 0);
                return { ...s, totalDeposit, monthlyNetBalance: net };
            });
        });

        const unsubWithdrawals = onSnapshot(withdrawalsQuery, (snap) => {
            const totalWithdrawal = sumApprovedAmount(snap);
            setMonthlyStats(s => {
                const net = (s.totalDeposit || 0) - totalWithdrawal;
                return { ...s, totalWithdrawal, monthlyNetBalance: net };
            });
        });

        const unsubBids = onSnapshot(bidsQuery, (bidsSnap) => {
            let monthBidding = 0;
            let monthWinning = 0;

            bidsSnap.forEach(doc => {
                const bid = doc.data();
                if (bid.status !== 'cancelled') {
                    const bidAmt = parseFloat(bid.totalAmount);
                    if (!isNaN(bidAmt)) monthBidding += bidAmt;
                }
                if (bid.status === 'won') {
                    const winVal = parseFloat(bid.winningAmount);
                    if (!isNaN(winVal)) monthWinning += winVal;
                }
            });
            setMonthlyStats(s => ({
                ...s,
                totalBidding: monthBidding,
                totalProfit: monthBidding - monthWinning,
            }));
        }, (error) => {});

        return () => {
            unsubDeposits();
            unsubWithdrawals();
            unsubBids();
        }
    }, [user]);

    if (loading) {
        return (
          <div className="flex h-full flex-1 items-center justify-center bg-background p-8">
            <Loader className="h-10 w-10 text-primary" />
          </div>
        );
    }
  
  return (
    <div className="flex-1 space-y-6">
       <div className="grid gap-6">
        <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-white p-6 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold">Welcome to your Admin Panel!</h2>
            <p className="mt-1">Here's a detailed overview of your application's status and performance.</p>
        </div>

        <div>
            <h3 className="text-xl font-bold mb-4">Overall Stats</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Total Users" value={totalUsers.toString()} icon={Users} color="#8b5cf6" />
                <StatCard title="Total Games" value={totalGames.toString()} icon={Gamepad2} color="#ec4899" />
                <StatCard 
                    title="Monthly Net Balance" 
                    value={`₹${(Number(monthlyStats.monthlyNetBalance) || 0).toLocaleString('en-IN')}`} 
                    icon={Landmark} 
                    color={monthlyStats.monthlyNetBalance >= 0 ? "#22c55e" : "#ef4444"}
                    textColor={monthlyStats.monthlyNetBalance >= 0 ? "#22c55e" : "#ef4444"}
                />
            </div>
        </div>
        
        <div>
            <h3 className="text-xl font-bold mb-4">Daily Transaction &amp; Bidding Report</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Today's Deposits" value={`₹${(Number(dailyStats.todaysDeposits) || 0).toLocaleString('en-IN')}`} icon={ArrowUpCircle} color="#3b82f6" />
                <StatCard title="Withdrawals Given Today" value={`₹${(Number(dailyStats.todaysWithdrawals) || 0).toLocaleString('en-IN')}`} icon={ArrowDownCircle} color="#f97316" />
                <StatCard title="Today's Bidding" value={`₹${(Number(biddingStats.todaysBidding) || 0).toLocaleString('en-IN')}`} icon={TrendingUp} color="#38bdf8" />
                <StatCard title="Today's Winning" value={`₹${(Number(biddingStats.todaysWinning) || 0).toLocaleString('en-IN')}`} icon={TrendingDown} color="#fb7185" />
                <StatCard 
                    title="Today's Profit / Loss" 
                    value={`₹${(Number(biddingStats.todaysProfitLoss) || 0).toLocaleString('en-IN')}`} 
                    icon={Scale} 
                    color={biddingStats.todaysProfitLoss >= 0 ? "#4ade80" : "#f87171"}
                    textColor={biddingStats.todaysProfitLoss >= 0 ? "#4ade80" : "#f87171"}
                />
                <StatCard title="Yesterday's Deposits" value={`₹${(Number(dailyStats.yesterdaysDeposits) || 0).toLocaleString('en-IN')}`} icon={ArrowUpCircle} color="#10b981" />
                <StatCard title="Withdrawal Given Yesterday" value={`₹${(Number(dailyStats.yesterdaysWithdrawals) || 0).toLocaleString('en-IN')}`} icon={ArrowDownCircle} color="#ef4444" />
            </div>
        </div>
        
         <div>
            <h3 className="text-xl font-bold mb-4">This Month's Report</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Deposit This Month" value={`₹${(Number(monthlyStats.totalDeposit) || 0).toLocaleString('en-IN')}`} icon={ArrowUpCircle} color="#3b82f6" />
                <StatCard title="Total Withdrawals This Month" value={`₹${(Number(monthlyStats.totalWithdrawal) || 0).toLocaleString('en-IN')}`} icon={ArrowDownCircle} color="#f97316" />
                <StatCard title="Total Bidding This Month" value={`₹${(Number(monthlyStats.totalBidding) || 0).toLocaleString('en-IN')}`} icon={BarChart} color="#a855f7" />
                <StatCard 
                    title="Total Profit This Month" 
                    value={`₹${(Number(monthlyStats.totalProfit) || 0).toLocaleString('en-IN')}`} 
                    icon={Scale} 
                    color={monthlyStats.totalProfit >= 0 ? "#22c55e" : "#ef4444"}
                    textColor={monthlyStats.totalProfit >= 0 ? "#22c55e" : "#ef4444"}
                />
            </div>
        </div>

      </div>
    </div>
  );
}
