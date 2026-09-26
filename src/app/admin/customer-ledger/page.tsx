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
import { Search, Download, Trash2, Plus, Calendar as CalendarIcon, User, Landmark, BookOpen, History } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jsPDF';
import 'jspdf-autotable';

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
  
  // Filters
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [userSearch, setUserSearch] = useState('');

  // Form
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [gameName, setGameName] = useState('N/A');
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState<Date>(new Date());

  const gameOptions = [
    'N/A',
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

  // Fetch unique user IDs that have ledger entries to sort them at top
  useEffect(() => {
    const q = collection(db, 'customerLedger');
    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set<string>();
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.userId) ids.add(data.userId);
      });
      setActiveUserIds(ids);
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

    // Sort Logic: Active users (with entries) first, then by name
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
    <div className="container mx-auto space-y-6 pb-20">
      <div className="bg-gradient-to-r from-blue-700 to-teal-600 text-white p-6 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <BookOpen className="h-8 w-8" />
            Customer Len Den (Offline)
          </h2>
          <p className="text-blue-100 mt-1 font-medium opacity-90">Manage offline accounts and local transactions for users.</p>
        </div>
        <Landmark className="h-16 w-16 opacity-20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User Selection Sidebar */}
        <Card className="lg:col-span-4 rounded-2xl shadow-lg border-none overflow-hidden h-fit">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Select Customer
            </CardTitle>
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search name or mobile..." 
                className="pl-9 bg-white border-none shadow-inner h-11"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            {activeUserIds.size > 0 && (
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-2 px-1">
                Recent active users shown at top
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              {filteredUsers.map(u => {
                const isActive = activeUserIds.has(u.id);
                return (
                  <div 
                    key={u.id}
                    onClick={() => setSelectedGameUserId(u.id)}
                    className={cn(
                      "p-4 border-b last:border-none cursor-pointer transition-all flex justify-between items-center group",
                      selectedUserId === u.id ? "bg-blue-600 text-white" : "hover:bg-blue-50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold truncate">{u.name}</p>
                        {isActive && (
                           <div className={cn(
                             "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase",
                             selectedUserId === u.id ? "bg-white/20 text-white" : "bg-blue-100 text-blue-600"
                           )}>
                             <History className="h-2 w-2" /> History
                           </div>
                        )}
                      </div>
                      <p className={cn("text-xs", selectedUserId === u.id ? "text-blue-100" : "text-muted-foreground")}>{u.mobile}</p>
                    </div>
                    {selectedUserId === u.id && <div className="h-2 w-2 rounded-full bg-white animate-pulse shrink-0 ml-2" />}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Ledger Details */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedUserId ? (
            <Card className="h-full rounded-2xl flex flex-col items-center justify-center p-20 text-muted-foreground border-2 border-dashed border-muted bg-white/50">
              <div className="bg-muted h-20 w-20 rounded-full flex items-center justify-center mb-6">
                <User className="h-10 w-10 opacity-20" />
              </div>
              <p className="font-bold text-lg">Please select a customer to view ledger</p>
              <p className="text-sm opacity-60">Active customers are automatically moved to the top of the list.</p>
            </Card>
          ) : (
            <>
              {/* Summary & Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Card className="bg-white rounded-2xl shadow-md border-none flex flex-col justify-center p-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Customer Net Balance</p>
                    <p className={cn("text-4xl font-black", netBalance >= 0 ? "text-green-600" : "text-red-600")}>
                      ₹{netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2 italic">* This balance is separate from app wallet.</p>
                 </Card>

                 <Card className="bg-white rounded-2xl shadow-md border-none p-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-gray-400 uppercase">Filters</p>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setFromDate(undefined); setToDate(undefined); }}>Reset</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-10 text-[11px] justify-start px-2">
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {fromDate ? format(fromDate, 'dd/MM/yy') : 'From'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus /></PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-10 text-[11px] justify-start px-2">
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {toDate ? format(toDate, 'dd/MM/yy') : 'To'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus /></PopoverContent>
                        </Popover>
                    </div>
                    <Button onClick={handleDownloadPDF} variant="outline" className="w-full h-9 rounded-xl border-blue-100 text-blue-600 hover:bg-blue-50">
                        <Download className="mr-2 h-4 w-4" /> Download PDF Report
                    </Button>
                 </Card>
              </div>

              {/* Add Entry Form */}
              <Card className="rounded-2xl shadow-lg border-none overflow-hidden">
                <CardHeader className="bg-[#154c79] text-white p-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    New Len-Den Entry
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleAddEntry} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Amount</Label>
                      <Input 
                        type="number" 
                        placeholder="₹ 0.00" 
                        className="h-11 rounded-xl text-lg font-bold"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Type</Label>
                      <Select value={type} onValueChange={(v: any) => setType(v)}>
                        <SelectTrigger className="h-11 rounded-xl font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="credit" className="text-green-600 font-bold">CREDIT (आय - पैसा आया)</SelectItem>
                          <SelectItem value="debit" className="text-red-600 font-bold">DEBIT (व्यय - पैसा गया)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Market / Game</Label>
                      <Select value={gameName} onValueChange={setGameName}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {gameOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Description / Remarks</Label>
                      <Input 
                        placeholder="Why this entry? (Optional)" 
                        className="h-11 rounded-xl"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Entry Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-11 justify-start rounded-xl">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(entryDate, 'dd MMM yyyy')}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={entryDate} onSelect={(d) => d && setEntryDate(d)} initialFocus /></PopoverContent>
                      </Popover>
                    </div>
                    <div className="md:col-span-3 pt-2">
                        <Button type="submit" className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold text-white shadow-lg" disabled={isSubmitting}>
                            {isSubmitting ? <Loader className="h-5 w-5" /> : "Save Entry to Ledger"}
                        </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Transactions Table */}
              <Card className="rounded-2xl shadow-lg border-none overflow-hidden bg-white">
                <CardHeader className="bg-muted/30 pb-2">
                    <CardTitle className="text-base font-bold">Recent History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-[10px] uppercase font-bold">Date</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold">Game</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold">Description</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-bold">Amount</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-bold">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow><TableCell colSpan={5} className="h-40 text-center"><Loader /></TableCell></TableRow>
                        ) : filteredEntries.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="h-40 text-center text-muted-foreground">No entries found for this user.</TableCell></TableRow>
                        ) : (
                          filteredEntries.map((e) => (
                            <TableRow key={e.id} className="hover:bg-slate-50">
                              <TableCell className="text-xs font-medium">{format(e.entryDate.toDate(), 'dd/MM/yy')}</TableCell>
                              <TableCell className="text-xs font-bold text-[#154c79]">{e.gameName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground italic truncate max-w-[150px]">{e.description || '-'}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                  <span className={cn("text-sm font-black", e.type === 'credit' ? "text-green-600" : "text-red-600")}>
                                    {e.type === 'credit' ? '+' : '-'} ₹{e.amount}
                                  </span>
                                  <span className="text-[8px] uppercase font-bold opacity-50">{e.type}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(e.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}