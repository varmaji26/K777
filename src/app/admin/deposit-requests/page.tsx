
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, onSnapshot, doc, DocumentData, orderBy, runTransaction, increment, getDoc, where, writeBatch, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from '@/components/loader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, TrendingUp } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { logTransaction } from '@/lib/transactions';
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
    paymentMethod?: string;
    transactionId?: string;
}

const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const PAGE_SIZES = [10, 25, 50];

export default function DepositRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRejectingAll, setIsRejectingAll] = useState(false);
  const [todaysApprovedAmount, setTodaysApprovedAmount] = useState(0);
  const { toast } = useToast();
  const [processingStatus, setProcessingStatus] = useState<{[key: string]: 'approved' | 'rejected'}>({});
  
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "deposits"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const allDeposits = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Request))
            .filter(r => r.paymentMethod !== 'Manual (Admin)');
        
        const pendingRequests = allDeposits.filter(r => r.status === 'pending');
        setRequests(pendingRequests);
        
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        
        let total = 0;
        allDeposits.forEach(deposit => {
            const createdAtDate = deposit.createdAt?.toDate();
            if (deposit.status === 'approved' && createdAtDate && createdAtDate >= startOfToday && createdAtDate <= endOfToday) {
               total += Number(deposit.amount || 0);
            }
        });
        setTodaysApprovedAmount(total);

        setLoading(false);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'deposits',
            operation: 'list'
        }));
        setLoading(false);
    });

    return () => {
        unsubscribe();
    };
  }, []);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const handleDepositRequest = (request: Request, status: 'approved' | 'rejected') => {
    const requestDocRef = doc(db, 'deposits', request.id);
    const userDocRef = doc(db, 'users', request.userId);
    const statsDocRef = doc(db, 'app-stats', 'dashboard');
    const settingsDocRef = doc(db, 'settings', 'app-settings');

    setProcessingStatus(prev => ({...prev, [request.id]: status}));

    runTransaction(db, async (transaction) => {
        const requestDoc = await transaction.get(requestDocRef);
        if (!requestDoc.exists() || requestDoc.data().status !== 'pending') {
          throw new Error("This request has already been processed.");
        }
        
        const userDoc = await transaction.get(userDocRef);
        
        const transQuery = query(collection(db, 'transactions'), where('relatedId', '==', request.id));
        const transSnapshot = await getDocs(transQuery);
        const transDoc = transSnapshot.docs.length > 0 ? transSnapshot.docs[0] : null;

        if (userDoc.exists()) {
            const userData = userDoc.data();
            const balanceBefore = Number(userData.balance || 0);
            let balanceAfter = balanceBefore;

            if (status === 'approved') {
              const settingsDoc = await transaction.get(settingsDocRef);
              const settings = settingsDoc.data();
              
              let bonusAmount = 0;

              if (userData.depositBonusEnabled === true && userData.depositBonusPercentage > 0) {
                  bonusAmount = (Number(request.amount) * Number(userData.depositBonusPercentage)) / 100;
              } 
              else {
                  const bonusSettings = settings?.bonus || { enabled: false, percentage: 0 };
                  if (bonusSettings.enabled && bonusSettings.percentage > 0) {
                      bonusAmount = (Number(request.amount) * bonusSettings.percentage) / 100;
                  }
              }

              balanceAfter = balanceBefore + Number(request.amount);

              transaction.update(userDocRef, { 
                  balance: increment(Number(request.amount)),
                  bonusBalance: increment(bonusAmount),
                  totalBonusGiven: increment(bonusAmount),
                  hasDeposited: true
              });
              transaction.update(statsDocRef, { totalBalance: increment(Number(request.amount)) });
              
              if(transDoc) {
                transaction.update(transDoc.ref, { 
                    status: 'approved',
                    balanceAfter: balanceAfter,
                    description: `Deposit of ₹${request.amount} approved.${bonusAmount > 0 ? ` Bonus of ₹${bonusAmount} added.` : ''}`
                });
              }
              
              const referralSettings = settings?.referralBonus || { enabled: false, referrerAmount: 0, refereeAmount: 0 };
              if (referralSettings.enabled && !userData.hasDeposited && userData.referredBy) {
                  const referrerDocRef = doc(db, 'users', userData.referredBy);
                  const referrerDoc = await transaction.get(referrerDocRef);

                  if (referrerDoc.exists()) {
                      if (referralSettings.referrerAmount > 0) {
                        transaction.update(referrerDocRef, { bonusBalance: increment(referralSettings.referrerAmount) });
                        await logTransaction({
                            userId: userData.referredBy,
                            userName: referrerDoc.data()?.displayName,
                            amount: referralSettings.referrerAmount,
                            type: 'bonus',
                            description: `Referral bonus for referring ${userData.displayName}`,
                            balanceBefore: Number(referrerDoc.data().balance || 0),
                            balanceAfter: Number(referrerDoc.data().balance || 0),
                        }, transaction);
                      }
                      if (referralSettings.refereeAmount > 0) {
                          transaction.update(userDocRef, { bonusBalance: increment(referralSettings.refereeAmount) });
                          await logTransaction({
                              userId: request.userId,
                              userName: userData.displayName,
                              amount: referralSettings.refereeAmount,
                              type: 'bonus',
                              description: 'Bonus for being referred',
                              balanceBefore: balanceAfter,
                              balanceAfter: balanceAfter,
                          }, transaction);
                      }
                  }
              }
            } else if (status === 'rejected' && transDoc) {
                transaction.delete(transDoc.ref);
            }
        }
        
        transaction.update(requestDocRef, { status: status });
      }).then(() => {
        toast({ title: 'Success!', description: `Request has been ${status}.` });
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
        const transactionsRef = collection(db, 'transactions');
        
        for (const request of requests) {
            const docRef = doc(db, 'deposits', request.id);
            batch.update(docRef, { status: 'rejected' });
            
            const transQuery = query(transactionsRef, where('relatedId', '==', request.id), where('status', '==', 'pending'));
            const transSnapshot = await getDocs(transQuery);
            transSnapshot.forEach(tDoc => {
                batch.delete(tDoc.ref);
            });
        }
        await batch.commit();
        toast({
            title: 'Success!',
            description: `All pending deposit requests have been rejected and hidden from user passbooks.`
        });
    } catch (error) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'deposits',
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
        <Card className="bg-teal-500/10 border-teal-500/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    Today's Total Approved Deposit
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-teal-400" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-teal-400">
                    ₹{Number(todaysApprovedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            </CardContent>
        </Card>
        <Card className="bg-card/80 border-white/10 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-2xl">Pending Deposit Requests</CardTitle>
                    <CardDescription>Approve or reject user fund requests. (Rejected requests are hidden from users)</CardDescription>
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
                                    This will reject all {requests.length} pending deposit requests. This action cannot be undone and will hide these entries from user history.
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
                                    <TableHead>Username</TableHead>
                                    <TableHead>Mobile</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead>Transaction ID</TableHead>
                                    <TableHead className="text-center">Actions</TableHead>
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
                                        <TableCell>{request.paymentMethod}</TableCell>
                                        <TableCell>{request.transactionId}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex gap-2 justify-center">
                                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleDepositRequest(request, 'approved')} disabled={isProcessing}>
                                                    {isApproving ? <Loader className="h-4 w-4" /> : 'Approve' }
                                                </Button>
                                                <Button size="sm" variant="destructive" onClick={() => handleDepositRequest(request, 'rejected')} disabled={isProcessing}>
                                                    {isRejecting ? <Loader className="h-4 w-4" /> : 'Reject'}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                        </Table>
                        {paginatedData.length === 0 && <p className="text-center text-muted-foreground mt-4">No pending deposit requests found.</p>}
                    </div>
                    {renderPagination()}
                </div>
                )}
            </CardContent>
        </Card>
    </main>
  );
}
