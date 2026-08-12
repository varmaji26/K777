
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, onSnapshot, doc, DocumentData, orderBy, runTransaction, increment, getDoc, where, writeBatch, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from '@/components/loader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CircleDollarSign, Trash2, TrendingUp } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { logTransaction } from '@/lib/transactions';
import type { User } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


interface Request extends DocumentData {
    id: string;
    userId: string;
    displayName: string;
    mobile?: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;
    withdrawalMethod?: string;
    withdrawalDetails?: string;
    bonusResetAmount?: number;
}

const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const PAGE_SIZES = [10, 25, 50];

export default function WithdrawalRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRejectingAll, setIsRejectingAll] = useState(false);
  const [todaysApprovedAmount, setTodaysApprovedAmount] = useState(0);
  const { toast } = useToast();
  const [processingStatus, setProcessingStatus] = useState<{[key: string]: 'approved' | 'rejected'}>({});
  
  const fetchRequests = useCallback(async () => {
      const q = query(collection(db, "withdrawals"), where("status", "==", "pending"));
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
          const data = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Request))
            .filter(r => r.withdrawalMethod !== 'Manual (Admin)');

          data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
          setRequests(data);
          setLoading(false);
      }, (error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: 'withdrawals',
              operation: 'list'
          }));
          setLoading(false);
      });
      return unsubscribe;
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubPromise = fetchRequests();
    
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const approvedQuery = query(
        collection(db, "withdrawals"),
        where("createdAt", ">=", Timestamp.fromDate(startOfToday))
    );

    const unsubscribeApproved = onSnapshot(approvedQuery, (snapshot) => {
        let total = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            if(data.status === 'approved' && data.withdrawalMethod !== 'Manual (Admin)') {
                const amt = Number(data.amount || 0);
                if (!isNaN(amt)) {
                    total += amt;
                }
            }
        });
        setTodaysApprovedAmount(total);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'withdrawals',
            operation: 'list'
        }));
    });

    return () => {
      unsubPromise.then(unsub => unsub());
      unsubscribeApproved();
    };
  }, [fetchRequests]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const handleWithdrawalRequest = (request: Request, status: 'approved' | 'rejected') => {
    const requestDocRef = doc(db, 'withdrawals', request.id);
    const userDocRef = doc(db, 'users', request.userId);

    setProcessingStatus(prev => ({...prev, [request.id]: status}));

    runTransaction(db, async (transaction) => {
        const requestDoc = await transaction.get(requestDocRef);
        if (!requestDoc.exists() || requestDoc.data().status !== 'pending') {
            throw new Error("This request has already been processed.");
        }
        
        const userDoc = await transaction.get(userDocRef);
        const reqData = requestDoc.data() as Request;

        const transQuery = query(
            collection(db, 'transactions'), 
            where('relatedId', '==', request.id),
            where('type', '==', 'withdrawal')
        );
        const transSnapshot = await getDocs(transQuery);
        const existingTransDoc = transSnapshot.docs.length > 0 ? transSnapshot.docs[0] : null;
        
        if (userDoc.exists()) {
            const user = userDoc.data() as User;
            const balanceBefore = Number(user.balance || 0);
            
            if (status === 'rejected') {
                const balanceAfter = balanceBefore + Number(request.amount);
                const bonusToRestore = reqData.bonusResetAmount || 0;

                transaction.update(userDocRef, { balance: increment(Number(request.amount)) });
                
                if (bonusToRestore > 0) {
                    transaction.update(userDocRef, { bonusBalance: increment(bonusToRestore) });
                }

                if (existingTransDoc) {
                    transaction.update(existingTransDoc.ref, { 
                        status: 'rejected', 
                        description: `Withdrawal request for ₹${request.amount} was rejected and amount refunded.` 
                    });
                }

                await logTransaction({
                    userId: request.userId,
                    userName: request.displayName,
                    amount: Number(request.amount),
                    type: 'withdrawal_rejected',
                    description: `Refund for rejected withdrawal request ₹${request.amount}.`,
                    balanceBefore,
                    balanceAfter,
                    relatedId: request.id,
                }, transaction);

            } else if (status === 'approved') {
                if (existingTransDoc) {
                    transaction.update(existingTransDoc.ref, { 
                        status: 'approved',
                        description: `Withdrawal request for ₹${request.amount} was approved.`
                    });
                }
            }
        }

        transaction.update(requestDocRef, { status: status });
    }).then(() => {
        toast({ title: 'Success!', description: `Withdrawal request has been ${status}.` });
    }).catch((error: any) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: requestDocRef.path,
            operation: 'update',
            requestResourceData: { status }
        }));
    }).finally(() => {
        setProcessingStatus(prev => {
            const newState = {...prev};
            delete newState[request.id];
            return newState;
        });
    });
  };
  
  const handleRejectAll = async () => {
    setIsRejectingAll(true);
    if (requests.length === 0) {
        toast({ title: 'No pending requests to reject.' });
        setIsRejectingAll(false);
        return;
    }

    try {
        const batch = writeBatch(db);
        for (const request of requests) {
            const requestDocRef = doc(db, 'withdrawals', request.id);
            const userDocRef = doc(db, 'users', request.userId);

            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const reqData = request as Request;
                const bonusToRestore = reqData.bonusResetAmount || 0;
                
                batch.update(userDocRef, { 
                    balance: increment(Number(request.amount)),
                    bonusBalance: increment(bonusToRestore)
                });
            }

            batch.update(requestDocRef, { status: 'rejected' });
        }
        await batch.commit();
        toast({
            title: 'Success!',
            description: `All pending withdrawals have been rejected and refunded.`
        });
    } catch (error) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'withdrawals',
            operation: 'update'
        }));
    } finally {
        setIsRejectingAll(false);
    }
  };

  const filteredData = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase().trim();
    if (!lowercasedFilter) return requests;
    return requests.filter((req: Request) => 
        req.displayName?.toLowerCase().includes(lowercasedFilter) || 
        req.mobile?.includes(lowercasedFilter)
    );
  }, [searchTerm, requests]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const renderPagination = () => (
     <div className="flex justify-between items-center text-sm text-muted-foreground mt-4">
        <span>Showing {paginatedData.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries</span>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
            <span className="bg-primary text-primary-foreground rounded-md px-3 py-1">{currentPage}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || paginatedData.length === 0}>Next</Button>
        </div>
    </div>
  );

  return (
     <main className="container mx-auto px-4 py-8 flex-1 space-y-6">
        <Card className="bg-orange-500/10 border-orange-500/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    Today's Total Approved Withdrawal
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-orange-400" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-orange-400">
                    ₹{Number(todaysApprovedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            </CardContent>
        </Card>
        <Card className="bg-card/80 border-white/10 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-2xl">Pending Withdrawal Requests</CardTitle>
                    <CardDescription>Approve or reject user withdrawal requests.</CardDescription>
                </div>
                 {requests.length > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={isRejectingAll}>
                                {isRejectingAll ? <Loader className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Reject All
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will reject all {requests.length} pending withdrawals and refund the amount to the users. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleRejectAll}>Confirm Reject</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </CardHeader>
            <CardContent>
                 <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <span>Show</span>
                        <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                            <SelectTrigger className="w-[80px]"><SelectValue placeholder={itemsPerPage} /></SelectTrigger>
                            <SelectContent>{PAGE_SIZES.map(size => <SelectItem key={size} value={size.toString()}>{size}</SelectItem>)}</SelectContent>
                        </Select>
                        <span>entries</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span>Search:</span>
                        <Input placeholder="Search by name or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-auto"/>
                    </div>
                </div>
                {loading ? <div className="flex justify-center h-48 items-center"><Loader className="h-10 w-10 text-primary" /></div> : (
                <div className="space-y-4">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>SL</TableHead>
                                    <TableHead>NAME</TableHead>
                                    <TableHead>PHONE NO</TableHead>
                                    <TableHead>AMOUNT</TableHead>
                                    <TableHead>DATE</TableHead>
                                    <TableHead>PAYMENT METHOD</TableHead>
                                    <TableHead className="text-center">APPROVE WITHDRAWAL</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((request, index) => {
                                    const isProcessing = !!processingStatus[request.id];
                                    const isApproving = processingStatus[request.id] === 'approved';
                                    const isRejecting = processingStatus[request.id] === 'rejected';

                                    return (
                                    <TableRow key={request.id}>
                                        <TableCell>{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                                        <TableCell>{request.displayName}</TableCell>
                                        <TableCell>{request.mobile}</TableCell>
                                        <TableCell>₹{request.amount}</TableCell>
                                        <TableCell>{formatDate(request.createdAt)}</TableCell>
                                        <TableCell>
                                            <Button variant="outline" size="sm">Registered Bank Details</Button>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex gap-2 justify-center">
                                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleWithdrawalRequest(request, 'approved')} disabled={isProcessing}>
                                                    {isApproving ? <Loader className="h-4 w-4" /> : (
                                                        <>
                                                            Approve Now
                                                            <CircleDollarSign className="ml-2 h-4 w-4" />
                                                        </>
                                                    )}
                                                </Button>
                                                <Button size="sm" variant="destructive" onClick={() => handleWithdrawalRequest(request, 'rejected')} disabled={isProcessing}>
                                                    {isRejecting ? <Loader className="h-4 w-4" /> : 'Reject'}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                        </Table>
                        {paginatedData.length === 0 && <p className="text-center text-muted-foreground mt-4">No pending withdrawal requests found.</p>}
                    </div>
                    {renderPagination()}
                </div>
                )}
            </CardContent>
        </Card>
    </main>
  );
}
