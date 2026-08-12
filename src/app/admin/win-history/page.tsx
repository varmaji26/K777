'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, DocumentData, orderBy, Timestamp, where, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from '@/components/loader';
import { Badge } from '@/components/ui/badge';
import { Search, Trophy, Calendar as CalendarIcon, Download, XCircle, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { runTransaction, doc, increment } from 'firebase/firestore';


interface Win extends DocumentData {
    id: string;
    userId: string;
    displayName: string;
    mobile?: string;
    gameName: string;
    betType: string;
    session: string;
    numbers: string[];
    totalAmount: number;
    winningAmount: number;
    status: 'won' | 'cancelled';
    createdAt: Timestamp;
    betSource?: 'real' | 'bonus';
}

// Extend jsPDF with autoTable for TypeScript
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const ITEMS_PER_PAGE = 10;

export default function AdminWinHistoryPage() {
  const [allWins, setAllWins] = useState<Win[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [currentPage, setCurrentPage] = useState(1);

  const viewed = searchParams.get('viewed');

  useEffect(() => {
    if (viewed === 'true') {
        localStorage.setItem('lastViewedWinsTimestamp', Date.now().toString());
    }
  }, [viewed]);

  useEffect(() => {
      setLoading(true);
      
      let q = query(
          collection(db, "bids"), 
          orderBy("createdAt", "desc")
      );
      
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

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const winsData = querySnapshot.docs
            .filter(doc => {
                const data = doc.data();
                return data.status === 'won' || (data.status === 'cancelled' && data.winningAmount > 0)
            })
            .map(bidDoc => ({ id: bidDoc.id, ...bidDoc.data() } as Win));
          
          setAllWins(winsData);
          setLoading(false);
      }, (error) => {
          console.error("Error fetching wins: ", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch wins' });
          setLoading(false);
      });
      
      return () => unsubscribe();
  }, [fromDate, toDate, toast]);

  const filteredWins = useMemo(() => {
    if (!searchTerm.trim()) {
        return allWins;
    }

    const lowercasedFilter = searchTerm.toLowerCase().trim();
    return allWins.filter((win) => {
        return (
          win.displayName?.toLowerCase().includes(lowercasedFilter) ||
          win.gameName?.toLowerCase().includes(lowercasedFilter) ||
          win.mobile?.toLowerCase().includes(lowercasedFilter)
        );
    });
  }, [searchTerm, allWins]);
  
  const totalWinningAmount = useMemo(() => {
    return filteredWins
        .filter(win => win.status === 'won') // Only sum 'won' bids for the total
        .reduce((acc, win) => acc + (win.winningAmount || 0), 0);
  }, [filteredWins]);
  
  const totalPages = Math.ceil(filteredWins.length / ITEMS_PER_PAGE);
  const paginatedWins = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredWins.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredWins, currentPage]);


  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);


  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp.seconds * 1000).toLocaleString('en-GB');
  };
  
  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    const dateRange = fromDate && toDate ? `${format(fromDate, "PPP")} to ${format(toDate, "PPP")}` : "All Time";
    doc.text(`Win History Report - ${dateRange}`, 14, 16);
    
    const winsForPdf = filteredWins;
    const totalForPdf = winsForPdf.filter(w => w.status === 'won').reduce((acc, win) => acc + (win.winningAmount || 0), 0);
    doc.text(`Total Winning Amount: ${totalForPdf.toFixed(2)}`, 14, 22);

    const tableColumn = ["Date", "Username", "Mobile", "Game", "Bet Details", "Bet (₹)", "Win (₹)", "Status"];
    const tableRows: (string | number)[][] = [];

    winsForPdf.forEach(win => {
        const winRow = [
            formatDate(win.createdAt),
            win.displayName,
            win.mobile || 'N/A',
            `${win.gameName} (${win.session})`,
            `${win.betType} - ${win.numbers.join(', ')}`,
            win.totalAmount.toFixed(2),
            win.winningAmount.toFixed(2),
            win.status
        ];
        tableRows.push(winRow);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 163, 74] }
    });

    doc.save(`win-history-report-${fromDate ? format(fromDate, "yyyy-MM-dd") : 'all-time'}.pdf`);
  };

  const handleCancelWin = async (win: Win) => {
    const bidDocRef = doc(db, 'bids', win.id);
    const userDocRef = doc(db, 'users', win.userId);

    try {
        await runTransaction(db, async (transaction) => {
            const bidDoc = await transaction.get(bidDocRef);
            if (!bidDoc.exists() || bidDoc.data().status !== 'won') {
                throw new Error("This bid is not in a 'won' state.");
            }
            const bidData = bidDoc.data() as Win;

            // Revert winnings from user's balance based on where the bet came from
            if (bidData.betSource === 'bonus') {
                transaction.update(userDocRef, { bonusBalance: increment(-win.winningAmount) });
            } else {
                transaction.update(userDocRef, { balance: increment(-win.winningAmount) });
            }
            
            // Update bid status
            transaction.update(bidDocRef, { status: 'cancelled' });
        });
        toast({
            title: 'Success!',
            description: `Win for bid #${win.id} has been cancelled and ₹${win.winningAmount} deducted from ${win.displayName}.`
        });
    } catch (error: any) {
        console.error('Error cancelling win:', error);
        toast({
            variant: 'destructive',
            title: 'Error Cancelling Win',
            description: error.message || 'An unexpected error occurred.',
        });
    }
  };
  
    const handleDeleteOldWins = async () => {
        setIsDeleting(true);
        try {
            const tenDaysAgo = subDays(new Date(), 10);
            const tenDaysAgoTimestamp = Timestamp.fromDate(tenDaysAgo);

            const bidsRef = collection(db, 'bids');
            const q = query(bidsRef, where('createdAt', '<', tenDaysAgoTimestamp), where('status', 'in', ['won', 'cancelled']));

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ title: 'No Old Wins Found', description: 'There are no won or cancelled bids older than 10 days to delete.' });
                setIsDeleting(false);
                return;
            }

            const batch = writeBatch(db);
            querySnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();

            toast({
                title: 'Success!',
                description: `${querySnapshot.size} old win/cancelled record(s) have been permanently deleted.`,
                className: 'bg-green-600 text-white',
            });
        } catch (error) {
            console.error('Error deleting old records:', error);
            toast({
                variant: 'destructive',
                title: 'Deletion Failed',
                description: 'Could not delete old records. Please try again.',
            });
        } finally {
            setIsDeleting(false);
        }
    };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'won': return 'secondary';
        case 'cancelled': return 'outline';
        default: return 'default';
    }
  };


  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
        <div className="flex justify-between items-center mt-6 text-sm text-muted-foreground">
            <div>Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                >
                    Next
                </Button>
            </div>
        </div>
    )
  }

  return (
     <main className="container mx-auto px-4 py-8 flex-1">
        <Card>
          <CardHeader>
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-3xl font-bold flex items-center gap-2">
                        <Trophy className="text-amber-400" />
                        Win History
                    </CardTitle>
                    <CardDescription>View all winning bids and payouts.</CardDescription>
                </div>
                 <div className="flex gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={isDeleting}>
                                {isDeleting ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Delete Old Data
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[340px] rounded-2xl p-4">
                            <AlertDialogHeader className="space-y-2">
                            <AlertDialogTitle className="text-lg">Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs">
                                This will permanently delete all won/cancelled bids older than 10 days. This action cannot be undone.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex flex-col gap-2 mt-4">
                            <AlertDialogAction onClick={handleDeleteOldWins} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 text-sm">Confirm Delete</AlertDialogAction>
                            <AlertDialogCancel className="rounded-xl h-10 text-sm border-gray-200">Cancel</AlertDialogCancel>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={handleDownloadPDF} variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                    </Button>
                 </div>
             </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <h3 className="text-xl font-semibold">All Wins</h3>
                <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="from-date" className="text-sm shrink-0">From</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                id="from-date"
                                variant={"outline"}
                                className={cn(
                                    "w-full sm:w-[180px] justify-start text-left font-normal",
                                    !fromDate && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {fromDate ? format(fromDate, "dd MMM, yyyy") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                mode="single"
                                selected={fromDate}
                                onSelect={setFromDate}
                                initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex items-center gap-2">
                         <Label htmlFor="to-date" className="text-sm shrink-0">To</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                id="to-date"
                                variant={"outline"}
                                className={cn(
                                    "w-full sm:w-[180px] justify-start text-left font-normal",
                                    !toDate && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {toDate ? format(toDate, "dd MMM, yyyy") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                mode="single"
                                selected={toDate}
                                onSelect={setToDate}
                                initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="relative w-full sm:w-auto sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Search by username, game, or mobile..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-input h-10 rounded-lg pl-10"
                        />
                    </div>
                </div>
            </div>
            
            <Card className="bg-primary/10 border-primary/20 mb-4">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-lg font-semibold">Total Winning Amount</p>
                        <p className="text-2xl font-bold text-green-400">
                            ₹{totalWinningAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader className="h-10 w-10 text-primary" />
                </div>
            ) : (
                <>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="p-2">Date</TableHead>
                                <TableHead className="p-2">Username</TableHead>
                                <TableHead className="p-2">Mobile</TableHead>
                                <TableHead className="p-2">Game</TableHead>
                                <TableHead className="p-2">Bet Details</TableHead>
                                <TableHead className="p-2">Bet Amount</TableHead>
                                <TableHead className="p-2">Win Amount</TableHead>
                                <TableHead className="p-2">Status</TableHead>
                                <TableHead className="text-right p-2">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedWins.length > 0 ? (
                                paginatedWins.map((win) => (
                                    <TableRow key={win.id}>
                                        <TableCell className="p-2">{formatDate(win.createdAt)}</TableCell>
                                        <TableCell className="p-2">{win.displayName}</TableCell>
                                        <TableCell className="p-2">{win.mobile}</TableCell>
                                        <TableCell className="text-xs p-2">{win.gameName} ({win.session})</TableCell>
                                        <TableCell className="p-2">
                                            <div className="flex flex-col">
                                                <span>{win.betType}</span>
                                                <span className="text-xs text-muted-foreground">{win.numbers.join(', ')}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-2">₹{win.totalAmount}</TableCell>
                                         <TableCell className="font-bold text-green-400 p-2">
                                            ₹{win.winningAmount.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Badge
                                                variant={getStatusBadgeVariant(win.status)}
                                                className={cn(
                                                    win.status === 'won' && 'bg-green-500 text-white',
                                                    win.status === 'cancelled' && 'border-yellow-500 text-yellow-500',
                                                )}
                                            >
                                                {win.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right p-2">
                                            {win.status === 'won' && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="sm">
                                                            <XCircle className="h-4 w-4 mr-1" />
                                                            Cancel
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="max-w-[340px] rounded-2xl p-4">
                                                        <AlertDialogHeader className="space-y-2">
                                                        <AlertDialogTitle className="text-lg">Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-xs">
                                                            This will deduct ₹{win.winningAmount.toFixed(2)} from {win.displayName}'s wallet.
                                                        </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="flex flex-col gap-2 mt-4">
                                                        <AlertDialogAction onClick={() => handleCancelWin(win)} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 text-sm">Confirm Cancel</AlertDialogAction>
                                                        <AlertDialogCancel className="rounded-xl h-10 text-sm border-gray-200">Close</AlertDialogCancel>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">
                                      {searchTerm || fromDate ? "No wins found for the selected criteria." : "No wins found."}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                 {renderPagination()}
                </>
            )}
          </CardContent>
        </Card>
      </main>
  );
}
