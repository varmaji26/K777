
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, DocumentData, orderBy, Timestamp, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from '@/components/loader';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Calendar as CalendarIcon, ArrowDownCircle } from 'lucide-react';
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
    displayName: string;
    mobile?: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'reverted';
    createdAt: Timestamp;
    withdrawalMethod?: string;
}

// Extend jsPDF with autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const ITEMS_PER_PAGE = 10;

export default function AdminWithdrawalHistoryPage() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, "withdrawals"), orderBy("createdAt", "desc"));
    
    if (fromDate) {
        const startOfDay = new Date(fromDate);
        startOfDay.setHours(0, 0, 0, 0);
        q = query(q, where("createdAt", ">=", Timestamp.fromDate(startOfDay)));
    }
    if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        q = query(q, where("createdAt", "<=", Timestamp.fromDate(endOfDay)));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs
            .map(doc => ({ ...doc.data(), id: doc.id } as Transaction))
            .filter(t => t.withdrawalMethod !== 'Manual (Admin)'); // Filter out manual entries
            
        setAllTransactions(data);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching withdrawals:", error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to fetch withdrawal history." });
        setLoading(false);
    });
    return () => unsubscribe();
  }, [fromDate, toDate, toast]);

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) {
        return allTransactions;
    }
    const lowercasedFilter = searchTerm.toLowerCase().trim();
    return allTransactions.filter((t) => 
        t.displayName?.toLowerCase().includes(lowercasedFilter) ||
        t.mobile?.toLowerCase().includes(lowercasedFilter)
    );
  }, [searchTerm, allTransactions]);
  
  const totalWithdrawals = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, transaction) => {
        if (transaction.status === 'approved') {
          const amt = Number(transaction.amount || 0);
          return acc + (isNaN(amt) ? 0 : amt);
        }
        return acc;
      },
      0
    );
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'approved': return 'secondary';
        case 'rejected': return 'destructive';
        case 'reverted': return 'outline';
        case 'pending':
        default:
            return 'default';
    }
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    doc.text("Admin Withdrawal History", 14, 16);

    const tableColumn = ["Date", "Username", "Mobile", "Amount (INR)", "Method", "Status"];
    const tableRows: (string | number)[][] = [];
    
    filteredTransactions.forEach(t => {
        const transactionData = [
            formatDate(t.createdAt),
            t.displayName,
            t.mobile || 'N/A',
            t.amount,
            t.withdrawalMethod || 'N/A',
            t.status,
        ];
        tableRows.push(transactionData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 20,
    });

    doc.save(`withdrawal-history.pdf`);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-between items-center mt-6 text-sm text-muted-foreground">
            <div>Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
        </div>
    );
  };

  return (
     <div className="flex-1 space-y-6">
        <Card className="bg-card/80 border-white/10 shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-3xl font-bold">Withdrawal History</CardTitle>
                    <CardDescription>View all withdrawal history for all users.</CardDescription>
                </div>
                <Button onClick={handleDownloadPDF} variant="outline" size="sm" disabled={allTransactions.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                </Button>
            </div>
          </CardHeader>
          <CardContent>
             <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
                    <ArrowDownCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-500">₹{Number(totalWithdrawals || 0).toLocaleString('en-IN')}</div>
                    <p className="text-xs text-muted-foreground">Based on selected filters (approved only, excluding manual)</p>
                </CardContent>
            </Card>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <h3 className="text-xl font-semibold">All Transactions</h3>
                <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="from-date" className="text-sm shrink-0">From</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="from-date" variant={"outline"} className={cn("w-full sm:w-[180px] justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {fromDate ? format(fromDate, "dd MMM, yyyy") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus /></PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="to-date" className="text-sm shrink-0">To</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="to-date" variant={"outline"} className={cn("w-full sm:w-[180px] justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {toDate ? format(toDate, "dd MMM, yyyy") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus /></PopoverContent>
                        </Popover>
                    </div>
                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input placeholder="Search by username or mobile..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-input h-10 rounded-lg pl-10" />
                    </div>
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
                                <TableHead>Mobile</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedTransactions.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell>{formatDate(t.createdAt)}</TableCell>
                                    <TableCell>{t.displayName}</TableCell>
                                    <TableCell>{t.mobile}</TableCell>
                                    <TableCell>₹{t.amount}</TableCell>
                                    <TableCell>{t.withdrawalMethod}</TableCell>
                                    <TableCell>
                                        <Badge 
                                          variant={getStatusBadgeVariant(t.status)} 
                                          className={cn(
                                              t.status === 'approved' && 'bg-green-500 text-white', 
                                              t.status === 'rejected' && 'bg-red-500 text-white',
                                              t.status === 'reverted' && 'border-yellow-500 text-yellow-500',
                                          )}
                                        >
                                          {t.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {paginatedTransactions.length === 0 && !loading && (<p className="text-center text-muted-foreground mt-4">No transactions found.</p>)}
                    {renderPagination()}
                </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
