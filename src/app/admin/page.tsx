
'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, DocumentData, collection, query, where, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Gamepad2, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, Scale, Landmark, BarChart, WalletCards } from 'lucide-react';
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
    totalWinning: number;
    totalProfit: number;
    totalDeposit: number;
    totalWithdrawal: number;
    monthlyNetBalance: number;
}

/**
 * Universal helper to sum amounts based on transaction types and success statuses.
 * Includes Deposits, Welcome Bonus, and Referral Bonus as inflow.
 */
const sumTransactions = (snapshot: any, targetTypes: string[]): number => {
    let total = 0;
    if (!snapshot || !snapshot.docs) return 0;
    
    snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const matchesType = targetTypes.includes(data.type);
        
        // Status can be 'approved', 'success', or undefined (for legacy/simple manual additions)
        const isSuccessful = !data.status || ['approved', 'success', 'won', 'Given'].includes(data.status);
        const isExcluded = data.status === 'pending' || data.status === 'rejected' || data.status === 'cancelled' || data.status === 'reverted';

        if (matchesType && !isExcluded) {
            const val = parseFloat(data.amount);
            if (!isNaN(val)) {
                total += Math.abs(val);
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
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({ totalBidding: 0, totalWinning: 0, totalProfit: 0, totalDeposit: 0, totalWithdrawal: 0, monthlyNetBalance: 0 });
    const [loading, setLoading] = useState(true);
    
    const { users } = useUserStore();
    const { games } = useGameStore();
    
    const totalUsers = useMemo(() => users.filter(u => !u.isAdmin).length, [users]);
    const totalGames = useMemo(() => games.length, [games]);
    
    // Total Liability: Money that belongs to users (Real + Bonus)
    const totalUsersWalletBalance = useMemo(() => {
        return users.reduce((sum, u) => {
            if (u.isAdmin) return sum;
            return sum + (Number(u.balance) || 0) + (Number(u.bonusBalance) || 0);
        }, 0);
    }, [users]);

    useEffect(() => {
        const fbUser = auth.currentUser;
        if (!user?.isAdmin || !fbUser) {
          const timer = setTimeout(() => setLoading(false), 2000);
          return () => clearTimeout(timer);
        }

        const statsDocRef = doc(db, "app-stats", "dashboard");
        const unsubscribeStats = onSnapshot(statsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setStats(docSnap.data() as AppStats);
            }
            setLoading(false);
        }, (error) => {
            console.error("Stats listener error:", error);
            setLoading(false);
        });

        // --- CALENDAR LOGIC (LOCAL TIME) ---
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        const endOfYesterday = new Date(startOfYesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        
        const todayTs = Timestamp.fromDate(startOfToday);
        const endOfTodayTs = Timestamp.fromDate(endOfToday);
        const yesterdayTs = Timestamp.fromDate(startOfYesterday);
        const endOfYesterdayTs = Timestamp.fromDate(endOfYesterday);

        // --- REAL-TIME LISTENERS ---
        
        // 1. Today's Transactions
        const todayTransQuery = query(collection(db, "transactions"), where("createdAt", ">=", todayTs), where("createdAt", "<=", endOfTodayTs));
        const unsubTodayTrans = onSnapshot(todayTransQuery, (snap) => {
            setDailyStats(s => ({ 
                ...s, 
                todaysDeposits: sumTransactions(snap, ['deposit', 'welcome_bonus', 'referral_bonus']),
                todaysWithdrawals: sumTransactions(snap, ['withdrawal', 'withdrawal_approved'])
            }));
        });

        // 2. Yesterday's Transactions
        const yesterdayTransQuery = query(collection(db, "transactions"), where("createdAt", ">=", yesterdayTs), where("createdAt", "<=", endOfYesterdayTs));
        const unsubYesterdayTrans = onSnapshot(yesterdayTransQuery, (snap) => {
            setDailyStats(s => ({ 
                ...s, 
                yesterdaysDeposits: sumTransactions(snap, ['deposit', 'welcome_bonus', 'referral_bonus']),
                yesterdaysWithdrawals: sumTransactions(snap, ['withdrawal', 'withdrawal_approved'])
            }));
        });

        // 3. Today's Bids (Bidding & Winning)
        const todayBidsQuery = query(collection(db, "bids"), where("createdAt", ">=", todayTs), where("createdAt", "<=", endOfTodayTs));
        const unsubBids = onSnapshot(todayBidsQuery, (bidsSnap) => {
            let bidding = 0;
            let winning = 0;

            bidsSnap.forEach(doc => {
                const bid = doc.data();
                if (bid.status !== 'cancelled') {
                    bidding += Number(bid.totalAmount || 0);
                }
                if (bid.status === 'won') {
                    winning += Number(bid.winningAmount || 0);
                }
            });
            setBiddingStats({
                todaysBidding: bidding,
                todaysWinning: winning,
                todaysProfitLoss: bidding - winning
            });
        });

        return () => {
            unsubscribeStats();
            unsubTodayTrans();
            unsubYesterdayTrans();
            unsubBids();
        };
    }, [user]);

    // Monthly Report Listeners
    useEffect(() => {
        if (!user?.isAdmin || !auth.currentUser) return;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const startOfMonthTs = Timestamp.fromDate(startOfMonth);
        const endOfMonthTs = Timestamp.fromDate(endOfMonth);
        
        const monthlyTransQuery = query(collection(db, "transactions"), where("createdAt", ">=", startOfMonthTs), where("createdAt", "<=", endOfMonthTs));
        const monthlyBidsQuery = query(collection(db, "bids"), where("createdAt", ">=", startOfMonthTs), where("createdAt", "<=", endOfMonthTs));
        
        const unsubMonthlyTrans = onSnapshot(monthlyTransQuery, (snap) => {
            const dep = sumTransactions(snap, ['deposit', 'welcome_bonus', 'referral_bonus']);
            const wit = sumTransactions(snap, ['withdrawal', 'withdrawal_approved']);
            setMonthlyStats(s => ({ 
                ...s, 
                totalDeposit: dep, 
                totalWithdrawal: wit,
                monthlyNetBalance: dep - wit 
            }));
        });

        const unsubMonthlyBids = onSnapshot(monthlyBidsQuery, (snap) => {
            let mBidding = 0;
            let mWinning = 0;

            snap.forEach(doc => {
                const bid = doc.data();
                if (bid.status !== 'cancelled') {
                    mBidding += Number(bid.totalAmount || 0);
                }
                if (bid.status === 'won') {
                    mWinning += Number(bid.winningAmount || 0);
                }
            });
            setMonthlyStats(s => ({
                ...s,
                totalBidding: mBidding,
                totalWinning: mWinning,
                totalProfit: mBidding - mWinning,
            }));
        });

        return () => {
            unsubMonthlyTrans();
            unsubMonthlyBids();
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
            <h2 className="text-3xl font-bold">Admin Dashboard</h2>
            <p className="mt-1">Detailed overview of application financials and users.</p>
        </div>

        <div>
            <h3 className="text-xl font-bold mb-4">Overall Stats</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Total Users" value={totalUsers.toString()} icon={Users} color="#8b5cf6" />
                <StatCard title="Total Games" value={totalGames.toString()} icon={Gamepad2} color="#ec4899" />
                <StatCard title="Users Wallet Liability" value={`₹${totalUsersWalletBalance.toLocaleString('en-IN')}`} icon={WalletCards} color="#3b82f6" />
                <StatCard 
                    title="Monthly Net Balance (Dep - Wit)" 
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
                <StatCard title="Today's Deposits" value={`₹${(Number(dailyStats.todaysDeposits) || 0).toLocaleString('en-IN')}`} icon={ArrowUpCircle} color="#10b981" />
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
                <StatCard title="Yesterday's Deposits" value={`₹${(Number(dailyStats.yesterdaysDeposits) || 0).toLocaleString('en-IN')}`} icon={ArrowUpCircle} color="#059669" />
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
