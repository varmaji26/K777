
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, DocumentData, orderBy, Timestamp, onSnapshot, where, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from '@/components/loader';
import { Badge } from '@/components/ui/badge';
import { Search, Calendar as CalendarIcon, Download, XCircle, Trash2, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { runTransaction, doc, increment } from 'firebase/firestore';
import { EditBidForm } from './components/edit-bid-form';
import { logTransaction } from '@/lib/transactions';


interface Bid extends DocumentData {
    id: string;
    userId: string;
    displayName: string;
    mobile?: string;
    gameName: string;
    betType: string;
    session: string;
    numbers: string[];
    totalAmount: number;
    status: 'running' | 'won' | 'lost' | 'cancelled';
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

export default function AdminBidHistoryPage() {
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [editingBid, setEditingBid] = useState<Bid | null>(null);

  const viewed = searchParams.get('viewed');

  useEffect(() => {
    if (viewed === 'true') {
        localStorage.setItem('lastViewedBidsTimestamp', Date.now().toString());
    }
  }, [viewed]);
  
  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, "bids"), orderBy("createdAt", "desc"));
    
    if (selectedDate) {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        q = query(q, where("createdAt", ">=", Timestamp.fromDate(startOfDay)), where("createdAt", "<=", Timestamp.fromDate(endOfDay)));
    }
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const bidsData = querySnapshot.docs.map(bidDoc => ({ id: bidDoc.id, ...bidDoc.data() } as Bid));
        setAllBids(bidsData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching bids: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to fetch bids."});
        setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate, toast]);

  const filteredBids = useMemo(() => {
    if (!searchTerm.trim()) {
        return allBids;
    }
    
    const lowercasedFilter = searchTerm.toLowerCase().trim();
    return allBids.filter((bid) => {
        return (
          bid.displayName?.toLowerCase().includes(lowercasedFilter) ||
          bid.gameName?.toLowerCase().includes(lowercasedFilter) ||
          bid.mobile?.includes(lowercasedFilter)
        );
    });
  }, [searchTerm, allBids]);
  
  const totalBiddingAmount = useMemo(() => {
    return filteredBids
      .filter(bid => bid.status !== 'cancelled')
      .reduce((acc, bid) => {
        const amt = Number(bid.totalAmount || 0);
        return acc + (isNaN(amt) ? 0 : amt);
      }, 0);
  }, [filteredBids]);

  const totalPages = Math.ceil(filteredBids.length / ITEMS_PER_PAGE);
  const paginatedBids = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBids.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredBids, currentPage]);

  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, selectedDate]);


  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp.seconds * 1000).toLocaleString('en-GB');
  };
  
  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    const reportDate = selectedDate ? format(selectedDate, "PPP") : 'All Time';
    doc.text(`Bid History Report - ${reportDate}`, 14, 16);
    
    // Use the already client-side filtered bids for the PDF
    const bidsForPdf = filteredBids;

    const tableColumn = ["Date", "Username", "Mobile", "Game", "Bet Details", "Amount (₹)", "Status"];
    const tableRows: (string | number)[][] = [];

    bidsForPdf.forEach(bid => {
        const bidRow = [
            formatDate(bid.createdAt),
            bid.displayName,
            bid.mobile || 'N/A',
            `${bid.gameName} (${bid.session})`,
            `${bid.betType} - ${bid.numbers.join(', ')}`,
            Number(bid.totalAmount).toFixed(2),
            bid.status
        ];
        tableRows.push(bidRow);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 24,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 163, 74] }
    });

    doc.save(`bid-history-report-${selectedDate ? format(selectedDate, "yyyy-MM-dd") : 'all-time'}.pdf`);
  };
  
  const handleCancelBid = async (bid: Bid) => {
    const bidDocRef = doc(db, 'bids', bid.id);
    const userDocRef = doc(db, 'users', bid.userId);

    try {
        await runTransaction(db, async (transaction) => {
            const bidDoc = await transaction.get(bidDocRef);
            if (!bidDoc.exists() || bidDoc.data().status !== 'running') {
                throw new Error("This bid is no longer running and cannot be cancelled.");
            }
            const bidData = bidDoc.data() as Bid;
            
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error("User associated with the bid not found.");
            }
            const userData = userDoc.data();
            
            const realBalanceBefore = userData.balance || 0;
            const bonusBalanceBefore = userData.bonusBalance || 0;

            if (bidData.betSource === 'bonus') {
                transaction.update(userDocRef, { bonusBalance: increment(Number(bid.totalAmount)) });
            } else {
                transaction.update(userDocRef, { balance: increment(Number(bid.totalAmount)) });
            }

            transaction.update(bidDocRef, { status: 'cancelled' });
            
            await logTransaction({
                userId: bid.userId,
                userName: bid.displayName,
                amount: Number(bid.totalAmount),
                type: 'bid_cancelled',
                description: `Bid for ${bid.gameName} was cancelled. Amount refunded.`,
                balanceBefore: realBalanceBefore,
                balanceAfter: bid.betSource === 'bonus' ? realBalanceBefore : realBalanceBefore + Number(bid.totalAmount),
                bonusBalanceBefore: bonusBalanceBefore,
                bonusBalanceAfter: bid.betSource === 'bonus' ? bonusBalanceBefore + Number(bid.totalAmount) : bonusBalanceBefore,
                relatedId: bid.id,
            }, transaction);
        });
        toast({
            title: 'Success!',
            description: `Bid #${bid.id} has been cancelled and ₹${bid.totalAmount} refunded to ${bid.displayName}.`
        });
    } catch (error: any) {
        console.error('Error cancelling bid:', error);
        toast({
            variant: 'destructive',
            title: 'Error Cancelling Bid',
            description: error.message || 'An unexpected error occurred.',
        });
    }
  };

  const handleDeleteOldBids = async () => {
    setIsDeleting(true);
    try {
        const tenDaysAgo = subDays(new Date(), 10);
        const tenDaysAgoTimestamp = Timestamp.fromDate(tenDaysAgo);

        const bidsRef = collection(db, 'bids');
        const q = query(bidsRef, where('createdAt', '<', tenDaysAgoTimestamp));

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            toast({ title: 'No Old Bids Found', description: 'There are no bids older than 10 days to delete.' });
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
            description: `${querySnapshot.size} old bid(s) have been permanently deleted.`,
            className: 'bg-green-600 text-white',
        });
    } catch (error) {
        console.error('Error deleting old bids:', error);
        toast({
            variant: 'destructive',
            title: 'Deletion Failed',
            description: 'Could not delete old bids. Please try again.',
        });
    } finally {
        setIsDeleting(false);
    }
  };
  
    const handleSaveBid = async (bidId: string, newNumbers: string[], newTotalAmount: number) => {
        const bidDocRef = doc(db, 'bids', bidId);
        try {
            await updateDoc(bidDocRef, {
                numbers: newNumbers,
                totalAmount: Number(newTotalAmount)
            });
            toast({
                title: 'Bid Updated',
                description: 'The bid has been successfully updated.',
            });
            setEditingBid(null);
        } catch (error) {
            console.error('Error updating bid:', error);
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: 'Could not update the bid. Please try again.',
            });
        }
    };


  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'won': return 'secondary';
        case 'lost': return 'destructive';
        case 'cancelled': return 'outline';
        case 'running':
        default:
            return 'default';
    }
  };

  const renderPagination = () => {
    if(totalPages <= 1) return null;

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
        {editingBid && (
            <EditBidForm
                bid={editingBid}
                isOpen={!!editingBid}
                onClose={() => setEditingBid(null)}
                onSave={handleSaveBid}
            />
        )}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-3xl font-bold">Bid History</CardTitle>
                <CardDescription>View all bids placed by users across all games.</CardDescription>
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
                            This will permanently delete all bids older than 10 days. This action cannot be undone.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex flex-col gap-2 mt-4">
                        <AlertDialogAction onClick={handleDeleteOldBids} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 text-sm">Confirm Delete</AlertDialogAction>
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
                <h3 className="text-xl font-semibold">All Bids</h3>
                 <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full sm:w-[180px] justify-start text-left font-normal",
                                !selectedDate && "text-muted-foreground"
                            )}
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "dd MMM, yyyy") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            initialFocus
                            />
                        </PopoverContent>
                    </Popover>
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
                        <p className="text-lg font-semibold">Total Bidding Amount</p>
                        <p className="text-2xl font-bold text-primary">
                            ₹{totalBiddingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader className="h-8 w-8 text-primary" />
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
                                <TableHead className="p-2">Amount</TableHead>
                                <TableHead className="p-2">Status</TableHead>
                                <TableHead className="text-right p-2">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedBids.length > 0 ? (
                                paginatedBids.map((bid) => (
                                <TableRow key={bid.id}>
                                    <TableCell className="p-2">{formatDate(bid.createdAt)}</TableCell>
                                    <TableCell className="p-2">{bid.displayName}</TableCell>
                                    <TableCell className="p-2">{bid.mobile}</TableCell>
                                    <TableCell className="text-xs p-2">{bid.gameName} ({bid.session})</TableCell>
                                    <TableCell className="p-2">
                                        <div className="flex flex-col">
                                            <span>{bid.betType}</span>
                                            <span className="text-xs text-muted-foreground">{bid.numbers.join(', ')}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="p-2">₹{bid.totalAmount}</TableCell>
                                    <TableCell className="p-2">
                                        <Badge 
                                            variant={getStatusBadgeVariant(bid.status)}
                                            className={cn(
                                                bid.status === 'won' && 'bg-green-500 text-white',
                                                bid.status === 'cancelled' && 'border-yellow-500 text-yellow-500',
                                            )}
                                        >
                                            {bid.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right p-2">
                                        {bid.status === 'running' && (
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="outline" size="sm" onClick={() => setEditingBid(bid)}>
                                                    <Edit className="h-4 w-4 mr-1" />
                                                    Edit
                                                </Button>
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
                                                            This will cancel the bid and refund ₹{bid.totalAmount} to {bid.displayName}'s wallet.
                                                        </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="flex flex-col gap-2 mt-4">
                                                        <AlertDialogAction onClick={() => handleCancelBid(bid)} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 text-sm">Confirm Cancel</AlertDialogAction>
                                                        <AlertDialogCancel className="rounded-xl h-10 text-sm border-gray-200">Close</AlertDialogCancel>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                           ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                      {searchTerm || selectedDate ? "No bids found for the selected criteria." : "No bids found."}
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
