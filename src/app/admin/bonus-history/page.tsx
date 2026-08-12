'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, DocumentData, orderBy, Timestamp, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from '@/components/loader';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Calendar as CalendarIcon, Gift } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Transaction extends DocumentData {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    type: string;
    status?: string;
    description: string;
    createdAt: Timestamp;
}

// Extend jsPDF with autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const ITEMS_PER_PAGE = 10;

export default function AdminBonusHistoryPage() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    // Fetch both welcome_bonus, referral_bonus and manual bonus
    let q = query(
        collection(db, "transactions"), 
        where("type", "in", ["bonus", "welcome_bonus", "referral_bonus"]), 
        orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
        setAllTransactions(data);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching bonus history:", error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to fetch bonus history." });
        setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);

  const filteredTransactions = useMemo(() => {
    let filtered = allTransactions;

    if (searchTerm.trim()) {
        const lower = searchTerm.toLowerCase().trim();
        filtered = filtered.filter(t => 
            t.userName?.toLowerCase().includes(lower) || 
            t.userId?.toLowerCase().includes(lower)
        );
    }

    if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        filtered = filtered.filter(t => t.createdAt.toDate() >= start);
    }

    if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(t => t.createdAt.toDate() <= end);
    }

    return filtered;
  }, [searchTerm, fromDate, toDate, allTransactions]);
  
  const totalBonusGiven = useMemo(() => {
    return filteredTransactions
        .filter(t => t.status !== 'Reset') // Exclude resets if they exist
        .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [filteredTransactions]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp.seconds * 1000).toLocaleString('en-GB');
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    doc.text("Admin Bonus History", 14, 16);

    const tableColumn = ["Date", "Username", "Amount", "Type", "Description"];
    const tableRows: (string | number)[][] = [];
    
    filteredTransactions.forEach(t => {
        const row = [
            formatDate(t.createdAt),
            t.userName || 'N/A',
            t.amount,
            t.type === 'welcome_bonus' ? 'Welcome' : (t.status === 'Reset' ? 'Reset' : 'Manual'),
            t.description || 'N/A',
        ];
        tableRows.push(row);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 20,
    });

    doc.save(`bonus-history.pdf`);
  };

  return (
     <div className="flex-1 space-y-6">
        <Card className="bg-card/80 border-white/10 shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-3xl font-bold flex items-center gap-2">
                        <Gift className="text-purple-500" />
                        Bonus History
                    </CardTitle>
                    <CardDescription>Records of all bonuses awarded to users.</CardDescription>
                </div>
                <Button onClick={handleDownloadPDF} variant="outline" size="sm" disabled={allTransactions.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                </Button>
            </div>
          </CardHeader>
          <CardContent>
             <Card className="mb-6 bg-purple-500/10 border-purple-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Bonus Given</CardTitle>
                    <Gift className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-purple-600">₹{totalBonusGiven.toLocaleString('en-IN')}</div>
                    <p className="text-xs text-muted-foreground">Based on current filters (excluding resets)</p>
                </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="from-date" className="text-sm shrink-0">From</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="from-date" variant={"outline"} className={cn("w-full sm:w-[160px] justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {fromDate ? format(fromDate, "dd MMM, yyyy") : <span>Pick date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus /></PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="to-date" className="text-sm shrink-0">To</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="to-date" variant={"outline"} className={cn("w-full sm:w-[160px] justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {toDate ? format(toDate, "dd MMM, yyyy") : <span>Pick date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus /></PopoverContent>
                        </Popover>
                    </div>
                </div>
                <div className="relative w-full sm:w-auto sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Search user..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-input h-10 rounded-lg pl-10" />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-48"><Loader className="h-10 w-10 text-primary" /></div>
            ) : (
                <div className="overflow-x-auto mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Username</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedTransactions.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell className="text-xs">{formatDate(t.createdAt)}</TableCell>
                                    <TableCell className="font-medium">{t.userName}</TableCell>
                                    <TableCell className={cn("font-bold", t.status === 'Reset' ? 'text-red-500' : 'text-green-600')}>
                                        {t.status === 'Reset' ? '-' : '+'}₹{t.amount}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={t.type === 'welcome_bonus' ? 'secondary' : 'default'} className={cn(t.status === 'Reset' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600')}>
                                            {t.status === 'Reset' ? 'RESET' : (t.type === 'welcome_bonus' ? 'WELCOME' : 'GIVEN')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{t.description}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {paginatedTransactions.length === 0 && !loading && (<p className="text-center text-muted-foreground mt-4">No records found.</p>)}
                    
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-6 text-sm text-muted-foreground">
                            <div>Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>Prev</Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>Next</Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
