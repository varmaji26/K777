'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp, deleteDoc, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@/components/loader';
import { Search, Download, Trash2, Plus, Calendar as CalendarIcon, User, Landmark, BookOpen, History, ArrowRight, UserSearch, RefreshCw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

// Types
interface LedgerEntry {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  type: 'credit' | 'debit';
  gameName: string;
  description: string;
  entryDate: Timestamp;
  createdAt: any;
}

interface AppUser {
  id: string;
  name: string;
  mobile: string;
}

// Extend jsPDF
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export default function CustomerLedgerPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set());
  const [selectedUserId, setSelectedGameUserId] = useState<string>('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isInitialDashboardLoading, setIsInitialDashboardLoading] = useState(true);
  
  // Filters
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [userSearch, setUserSearch] = useState('');

  // Form
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [gameName, setGameName] = useState('Main Market');
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState<Date>(new Date());

  const gameOptions = [
    'Main Market',
    'Milan Day',
    'Milan Night',
    'Kalyan',
    'Rajdhani Day',
    'Rajdhani Night',
    'Main Bazar',
    'Time Bazar'
  ];

  // Fetch all users for selection
  useEffect(() => {
    const q = query(collection(db, 'users'), where('isAdmin', '==', false));
    const unsub = onSnapshot(q, (snap) => {
      const u = snap.docs.map(d => ({ id: d.id, name: d.data().name, mobile: d.data().mobile }));
      setUsers(u);
    });
    return () => unsub();
  }, []);

  // Fetch unique user IDs that have ledger entries
  useEffect(() => {
    const q = collection(db, 'customerLedger');
    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set<string>();
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.userId) ids.add(data.userId);
      });
      setActiveUserIds(ids);
      setIsInitialDashboardLoading(false);
    }, (err) => {
      console.error("Ledger Sync Error:", err);
      setIsInitialDashboardLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch entries for selected user
  useEffect(() => {
    if (!selectedUserId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'customerLedger'),
      where('userId', '==', selectedUserId)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const e = snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
      setEntries(e);
      setLoading(false);
    }, (error) => {
        console.error("Ledger Fetch Error:", error);
        setLoading(false);
    });
    return () => unsub();
  }, [selectedUserId]);

  const filteredUsers = useMemo(() => {
    let list = [...users];
    
    if (userSearch) {
      list = list.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.mobile.includes(userSearch));
    }

    // Sort Logic: Active users first, then by name
    return list.sort((a, b) => {
      const aActive = activeUserIds.has(a.id);
      const bActive = activeUserIds.has(b.id);
      
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      
      return a.name.localeCompare(b.name);
    });
  }, [users, userSearch, activeUserIds]);

  const filteredEntries = useMemo(() => {
    let result = [...entries];
    
    result.sort((a, b) => {
        const timeA = a.entryDate?.toMillis() || 0;
        const timeB = b.entryDate?.toMillis() || 0;
        return timeB - timeA;
    });

    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter(e => e.entryDate.toDate() >= start);
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(e => e.entryDate.toDate() <= end);
    }
    return result;
  }, [entries, fromDate, toDate]);

  const netBalance = useMemo(() => {
    return filteredEntries.reduce((acc, e) => {
      return e.type === 'credit' ? acc + e.amount : acc - e.amount;
    }, 0);
  }, [filteredEntries]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !amount || parseFloat(amount) <= 0) {
      toast({ title: 'Invalid Data', description: 'Please select user and enter valid amount.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const user = users.find(u => u.id === selectedUserId);
    
    try {
      const newRef = doc(collection(db, 'customerLedger'));
      await setDoc(newRef, {
        userId: selectedUserId,
        userName: user?.name || 'Unknown',
        amount: parseFloat(amount),
        type,
        gameName,
        description,
        entryDate: Timestamp.fromDate(entryDate),
        createdAt: serverTimestamp(),
      });
      
      toast({ title: 'Entry Saved', description: 'Offline ledger entry added successfully.', className: 'bg-green-600 text-white' });
      setAmount('');
      setDescription('');
    } catch (error) {
      console.error("Save Error:", error);
      toast({ title: 'Error', description: 'Could not save entry.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'customerLedger', id));
      toast({ title: 'Deleted', description: 'Entry removed from ledger.' });
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleDownloadPDF = () => {
    if (filteredEntries.length === 0) return;
    const user = users.find(u => u.id === selectedUserId);
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`Offline Ledger: ${user?.name || 'Customer'}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Mobile: ${user?.mobile || 'N/A'}`, 14, 28);
    doc.text(`Date Range: ${fromDate ? format(fromDate, 'dd/MM/yyyy') : 'Start'} to ${toDate ? format(toDate, 'dd/MM/yyyy') : 'End'}`, 14, 34);
    doc.text(`Final Net Balance: INR ${netBalance.toFixed(2)}`, 14, 40);

    const tableColumn = ["Date", "Game", "Description", "Type", "Amount"];
    const tableRows = filteredEntries.map(e => [
      format(e.entryDate.toDate(), 'dd/MM/yy'),
      e.gameName,
      e.description || '-',
      e.type.toUpperCase(),
      e.amount.toFixed(2)
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      headStyles: { fillColor: [21, 76, 121] },
    });

    doc.save(`Ledger_${user?.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="container mx-auto space-y-4 pb-20 max-w-full px-0 md:px-4">
      <div className="bg-gradient-to-r from-blue-700 to-teal-600 text-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-3xl font-black tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 md:h-8 md:h-8" />
            Customer Len Den
          </h2>
          <p className="text-blue-100 text-xs md:text-sm mt-1 font-medium opacity-90">Manage offline accounts for users.</p>
        </div>
        <div className="flex items-center gap-3">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                    <Button className="bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl h-10 md:h-12 px-4 md:px-6 shadow-lg gap-2 text-xs md:text-sm">
                        <UserSearch className="h-4 w-4 md:h-5 md:h-5" />
                        Find Customer
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] md:w-[350px] p-0 border-none">
                    <SheetHeader className="bg-blue-600 p-4 md:p-6 text-white text-left">
                        <SheetTitle className="text-white text-lg md:text-xl flex items-center gap-2">
                            <Search className="h-4 w-4 md:h-5 md:h-5" />
                            Select Customer
                        </SheetTitle>
                        <div className="relative pt-4">
                            <Search className="absolute left-3 top-[70%] -translate-y-1/2 h-4 w-4 text-blue-300" />
                            <Input 
                                placeholder="Search name or mobile..." 
                                className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-blue-200 h-10 md:h-11 rounded-xl text-xs"
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                            />
                        </div>
                    </SheetHeader>
                    <div className="overflow-y-auto h-full pb-20">
                        {filteredUsers.length === 0 ? (
                            <div className="p-10 text-center text-muted-foreground">
                                <p className="font-bold text-xs">No customers found</p>
                            </div>
                        ) : (
                            filteredUsers.map(u => {
                                const isActive = activeUserIds.has(u.id);
                                return (
                                    <SheetClose asChild key={u.id}>
                                        <div 
                                            onClick={() => setSelectedGameUserId(u.id)}
                                            className={cn(
                                                "p-3 md:p-4 border-b last:border-none cursor-pointer transition-all flex justify-between items-center group",
                                                selectedUserId === u.id ? "bg-blue-50 text-blue-700 border-l-4 border-l-blue-600" : "hover:bg-slate-50"
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="font-bold text-xs md:text-sm truncate">{u.name}</p>
                                                    {isActive && (
                                                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[7px] md:text-[8px] font-black uppercase bg-blue-100 text-blue-600">
                                                            History
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">{u.mobile}</p>
                                            </div>
                                            <ArrowRight className="h-3 w-3 md:h-4 md:h-4 text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </SheetClose>
                                )
                            })
                        )}
                    </div>
                </SheetContent>
            </Sheet>
            <Landmark className="hidden md:block h-12 w-12 opacity-20" />
        </div>
      </div>

      <div className="w-full space-y-4">
          {!selectedUserId ? (
            <div className="space-y-4 animate-in fade-in duration-500 px-1 md:px-0">
               <div className="flex items-center justify-between">
                  <h3 className="text-base md:text-xl font-black text-gray-700 flex items-center gap-2">
                    <History className="h-4 w-4 md:h-5 md:h-5 text-blue-600" />
                    Active Accounts
                  </h3>
                  <p className="text-[9px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">{activeUserIds.size} Found</p>
               </div>
               
               {isInitialDashboardLoading ? (
                 <Card className="h-48 rounded-xl flex flex-col items-center justify-center p-10 text-muted-foreground border-none bg-white/50">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mb-2" />
                    <p className="font-bold text-sm text-center">Checking Accounts...</p>
                 </Card>
               ) : activeUserIds.size === 0 ? (
                  <Card className="h-full rounded-xl flex flex-col items-center justify-center p-10 md:p-20 text-muted-foreground border-2 border-dashed border-muted bg-white/50">
                    <div className="bg-muted h-16 w-16 md:h-20 md:w-20 rounded-full flex items-center justify-center mb-4 md:6">
                      <User className="h-8 w-8 md:h-10 md:w-10 opacity-20" />
                    </div>
                    <p className="font-bold text-base md:text-lg text-center">No active ledgers yet</p>
                    <p className="text-[10px] md:text-sm opacity-60 text-center max-w-xs mt-1 md:2">Click "Find Customer" to start.</p>
                  </Card>
               ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {users.filter(u => activeUserIds.has(u.id)).map(u => (
                      <Card 
                        key={u.id}
                        onClick={() => setSelectedGameUserId(u.id)}
                        className="p-3 md:p-5 rounded-xl md:rounded-2xl shadow-sm hover:shadow-md cursor-pointer transition-all border-none bg-white group"
                      >
                         <div className="flex items-center gap-2 md:gap-4">
                            <div className="h-8 w-8 md:h-12 md:w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black group-hover:bg-blue-600 group-hover:text-white transition-colors uppercase text-xs md:text-base">
                                {u.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-gray-800 text-[10px] md:text-sm truncate">{u.name}</p>
                                <p className="text-[8px] md:text-[10px] text-muted-foreground font-medium">{u.mobile}</p>
                            </div>
                         </div>
                         <div className="mt-2 md:4 pt-2 md:4 border-t border-slate-50 flex justify-between items-center text-[8px] md:text-[10px] font-bold uppercase text-blue-600">
                            <span>Open</span>
                            <ArrowRight className="h-2 w-2 md:h-3 md:h-3" />
                         </div>
                      </Card>
                    ))}
                  </div>
               )}
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-4 px-1 md:px-0">
              {/* Summary & Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                 <Card className="bg-white rounded-xl md:rounded-2xl shadow-md border-none flex flex-col justify-center p-4 md:p-6 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 h-16 w-16 md:h-24 md:w-24 bg-blue-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-[9px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 relative">Net Balance</p>
                    <p className={cn("text-2xl md:text-4xl font-black relative", netBalance >= 0 ? "text-green-600" : "text-red-600")}>
                      ₹{netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[8px] md:text-[10px] text-muted-foreground mt-1 relative italic">* Separate from app wallet.</p>
                 </Card>

                 <Card className="bg-white rounded-xl md:rounded-2xl shadow-md border-none p-4 md:p-6 space-y-3 md:space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Filters</p>
                        <Button variant="ghost" size="sm" className="h-5 text-[8px]" onClick={() => { setFromDate(undefined); setToDate(undefined); }}>Reset</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-9 md:h-10 text-[9px] md:text-[11px] justify-start px-2 rounded-xl">
                                    <CalendarIcon className="mr-1 h-3 w-3" />
                                    {fromDate ? format(fromDate, 'dd/MM/yy') : 'From'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus /></PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-9 md:h-10 text-[9px] md:text-[11px] justify-start px-2 rounded-xl">
                                    <CalendarIcon className="mr-1 h-3 w-3" />
                                    {toDate ? format(toDate, 'dd/MM/yy') : 'To'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus /></PopoverContent>
                        </Popover>
                    </div>
                    <Button onClick={handleDownloadPDF} variant="outline" className="w-full h-8 md:h-9 rounded-xl border-blue-100 text-blue-600 hover:bg-blue-50 text-[10px] md:text-sm">
                        <Download className="mr-2 h-3 w-3 md:h-4 md:h-4" /> PDF Report
                    </Button>
                 </Card>
              </div>

              {/* Add Entry Form */}
              <Card className="rounded-xl md:rounded-2xl shadow-lg border-none overflow-hidden">
                <CardHeader className="bg-[#154c79] text-white p-3 md:p-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs md:text-base font-bold flex items-center gap-2">
                    <Plus className="h-4 w-4 md:h-5 md:h-5" />
                    Entry for {users.find(u => u.id === selectedUserId)?.name}
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 h-7 md:h-8 text-[10px] md:text-sm" onClick={() => setSelectedGameUserId('')}>Dashboard</Button>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  <form onSubmit={handleAddEntry} className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    <div className="space-y-1">
                      <Label className="text-[9px] md:text-xs uppercase font-bold text-muted-foreground">Amount</Label>
                      <Input 
                        type="number" 
                        placeholder="₹ 0.00" 
                        className="h-10 md:h-11 rounded-xl text-base md:text-lg font-bold"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] md:text-xs uppercase font-bold text-muted-foreground">Type</Label>
                      <Select value={type} onValueChange={(v: any) => setType(v)}>
                        <SelectTrigger className="h-10 md:h-11 rounded-xl font-bold text-xs md:text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="credit" className="text-green-600 font-bold">CREDIT (आय)</SelectItem>
                          <SelectItem value="debit" className="text-red-600 font-bold">DEBIT (व्यय)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] md:text-xs uppercase font-bold text-muted-foreground">Market / Game</Label>
                      <Select value={gameName} onValueChange={setGameName}>
                        <SelectTrigger className="h-10 md:h-11 rounded-xl text-xs md:text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {gameOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-[9px] md:text-xs uppercase font-bold text-muted-foreground">Remarks</Label>
                      <Input 
                        placeholder="Optional" 
                        className="h-10 md:h-11 rounded-xl text-xs"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] md:text-xs uppercase font-bold text-muted-foreground">Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-10 md:h-11 justify-start rounded-xl text-xs">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(entryDate, 'dd MMM yy')}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={entryDate} onSelect={(d) => d && setEntryDate(d)} initialFocus /></PopoverContent>
                      </Popover>
                    </div>
                    <div className="md:col-span-3 pt-1 md:pt-2">
                        <Button type="submit" className="w-full h-11 md:h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold text-white shadow-md text-sm" disabled={isSubmitting}>
                            {isSubmitting ? <Loader className="h-5 w-5" /> : "Save Entry"}
                        </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Transactions Table */}
              <Card className="rounded-xl md:rounded-2xl shadow-lg border-none overflow-hidden bg-white">
                <CardHeader className="bg-muted/30 p-3 md:p-4">
                    <CardTitle className="text-sm md:text-base font-bold">Recent History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-[8px] md:text-[10px] uppercase font-bold px-2 md:px-4">Date</TableHead>
                          <TableHead className="text-[8px] md:text-[10px] uppercase font-bold px-2 md:px-4">Game</TableHead>
                          <TableHead className="text-right text-[8px] md:text-[10px] uppercase font-bold px-2 md:px-4">Amount</TableHead>
                          <TableHead className="text-right text-[8px] md:text-[10px] uppercase font-bold px-2 md:px-4"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader /></TableCell></TableRow>
                        ) : filteredEntries.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="h-40 text-center text-muted-foreground text-xs">No entries found.</TableCell></TableRow>
                        ) : (
                          filteredEntries.map((e) => (
                            <TableRow key={e.id} className="hover:bg-slate-50">
                              <TableCell className="text-[10px] md:text-xs font-medium px-2 md:px-4">{format(e.entryDate.toDate(), 'dd/MM/yy')}</TableCell>
                              <TableCell className="text-[10px] md:text-xs font-bold text-[#154c79] px-2 md:px-4">{e.gameName}</TableCell>
                              <TableCell className="text-right px-2 md:px-4">
                                <div className="flex flex-col items-end">
                                  <span className={cn("text-xs md:text-sm font-black", e.type === 'credit' ? "text-green-600" : "text-red-600")}>
                                    {e.type === 'credit' ? '+' : '-'} ₹{e.amount}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-2 md:px-4">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7">
                                      <Trash2 className="h-3.5 w-3.5 md:h-4 md:h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="max-w-[300px] rounded-xl p-5 border-none shadow-2xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-base font-black text-slate-900">Confirm Deletion</AlertDialogTitle>
                                      <AlertDialogDescription className="text-[10px] font-medium text-slate-500">
                                        Delete this entry? Irreversible action.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex flex-col gap-2 mt-3">
                                      <AlertDialogAction onClick={() => handleDeleteEntry(e.id)} className="rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white font-bold text-xs">Delete Entry</AlertDialogAction>
                                      <AlertDialogCancel className="rounded-xl h-10 border-slate-100 font-bold text-slate-400 text-xs">Cancel</AlertDialogCancel>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
      </div>
    </div>
  );
}
