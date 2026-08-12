'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useUserStore } from '@/lib/store';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Wallet, Eye, Percent, Gift, Trash2, MoreVertical, UserX, Shield, AlertCircle, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const betTypesKeys = [
  { key: 'singleDigit', label: 'Single Digit' },
  { key: 'jodiDigit', label: 'Jodi Digit' },
  { key: 'singlePana', label: 'Single Pana' },
  { key: 'doublePana', label: 'Double Pana' },
  { key: 'triplePana', label: 'Triple Pana' },
  { key: 'halfSangam', label: 'Half Sangam' },
  { key: 'fullSangam', label: 'Full Sangam' },
];

const ITEMS_PER_PAGE = 10;

// Memoized User Row for extreme performance
const UserRow = React.memo(({ 
  user, 
  index, 
  onAddFunds, 
  onAddBonus, 
  onSetRates, 
  onSetDepositBonus,
  onViewUser, 
  onDelete, 
  onToggleStatus 
}: {
  user: User;
  index: number;
  onAddFunds: (user: User) => void;
  onAddBonus: (user: User) => void;
  onSetRates: (user: User) => void;
  onSetDepositBonus: (user: User) => void;
  onViewUser: (user: User) => void;
  onDelete: (user: User) => void;
  onToggleStatus: (user: User) => void;
}) => {
  const balance = Number(user.balance || 0);
  const bonus = Number(user.bonusBalance || 0);
  
  return (
    <TableRow className="hover:bg-slate-50 transition-colors duration-200">
      <TableCell className="text-center font-normal text-slate-500 py-4">
        {index + 1}
      </TableCell>
      <TableCell>
        <span className="font-normal text-black truncate max-w-[200px]">{user.name}</span>
      </TableCell>
      <TableCell className="text-sm font-normal text-black">{user.mobile}</TableCell>
      <TableCell className={cn("text-right font-medium", balance < 0 ? "text-red-600" : "text-blue-600")}>
        ₹{balance.toFixed(0)}
      </TableCell>
      <TableCell className={cn("text-right font-medium", bonus < 0 ? "text-red-600" : "text-orange-600")}>
        ₹{bonus.toFixed(0)}
      </TableCell>
      <TableCell className="text-center">
        <Badge 
            variant={user.status === 'active' ? 'default' : 'destructive'}
            className={cn(
                "text-[10px] h-6 rounded-md px-3 font-normal border-none",
                user.status === 'active' ? "bg-green-600 text-white" : "bg-red-600 text-white"
            )}
        >
            {user.status.toUpperCase()}
        </Badge>
      </TableCell>
       <TableCell className="text-center text-sm text-black font-normal">
           {user.joinedAt ? format(new Date(user.joinedAt), 'dd MMM yyyy') : 'N/A'}
       </TableCell>
      <TableCell className="text-right pr-6">
        <div className="flex items-center justify-end gap-4">
            <Switch
              checked={user.status === 'active'}
              onCheckedChange={() => onToggleStatus(user)}
              className="scale-90 data-[state=checked]:bg-green-500"
            />
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-xl border-slate-100">
                <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase tracking-widest font-normal p-3">Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onAddFunds(user)} className="p-2.5">
                  <Wallet className="mr-3 h-4 w-4 text-blue-500" />
                  <span className="font-normal text-sm">Manage Balance</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddBonus(user)} className="p-2.5">
                  <Gift className="mr-3 h-4 w-4 text-orange-500" />
                  <span className="font-normal text-sm">Manage Bonus</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSetDepositBonus(user)} className="p-2.5">
                  <Zap className="mr-3 h-4 w-4 text-yellow-500" />
                  <span className="font-normal text-sm">Deposit Bonus Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetRates(user)} className="p-2.5">
                  <Percent className="mr-3 h-4 w-4 text-purple-500" />
                  <span className="font-normal text-sm">Custom Win Rates</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewUser(user)} className="p-2.5">
                  <Eye className="mr-3 h-4 w-4 text-slate-500" />
                  <span className="font-normal text-sm">Full Details</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(user)} className="text-red-600 focus:text-red-700 focus:bg-red-50 p-2.5">
                  <Trash2 className="mr-3 h-4 w-4" />
                  <span className="font-normal text-sm">Delete User</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
});
UserRow.displayName = 'UserRow';

export default function RegisteredUsersPage() {
  const users = useUserStore(state => state.users);
  const addFunds = useUserStore(state => state.addFunds);
  const addBonus = useUserStore(state => state.addBonus);
  const setBalanceToZero = useUserStore(state => state.setBalanceToZero);
  const setBonusToZero = useUserStore(state => state.setBonusToZero);
  const toggleUserStatus = useUserStore(state => state.toggleUserStatus);
  const deleteUser = useUserStore(state => state.deleteUser);
  const updateUser = useUserStore(state => state.updateUser);

  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal States
  const [selectedUserForFunds, setSelectedUserForFunds] = useState<User | null>(null);
  const [selectedUserForBonus, setSelectedUserForBonus] = useState<User | null>(null);
  const [selectedUserForView, setSelectedUserForView] = useState<User | null>(null);
  const [selectedUserForRates, setSelectedUserForRates] = useState<User | null>(null);
  const [selectedUserForDepositBonus, setSelectedUserForDepositBonus] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userForStatusToggle, setUserForStatusToggle] = useState<User | null>(null);
  
  const [amountToAdd, setAmountToAdd] = useState('');
  const [amountForBonus, setAmountForBonus] = useState('');
  const [customRates, setCustomRates] = useState<Record<string, string>>({});
  const [userBonusEnabled, setUserBonusEnabled] = useState(false);
  const [userBonusPercentage, setUserBonusPercentage] = useState('0');

  useEffect(() => {
    localStorage.setItem('lastViewedUsersTimestamp', Date.now().toString());
  }, []);

  const filteredUsers = useMemo(() => {
    const nonAdmins = users.filter(u => !u.isAdmin);
    if (!searchTerm) {
      return [...nonAdmins].sort((a, b) => {
        const timeA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
        const timeB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
        return timeB - timeA;
      });
    }
    
    const lowerSearch = searchTerm.toLowerCase();
    return nonAdmins
      .filter(u => u.name.toLowerCase().includes(lowerSearch) || u.mobile.includes(searchTerm))
      .sort((a, b) => {
        const timeA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
        const timeB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
        return timeB - timeA;
      });
  }, [users, searchTerm]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleToggleStatus = useCallback((user: User) => {
    setUserForStatusToggle(user);
  }, []);

  const handleConfirmToggleStatus = async () => {
    if (!userForStatusToggle || isProcessing) return;
    setIsProcessing(true);
    try {
        await toggleUserStatus(userForStatusToggle.id);
        const isBlocking = userForStatusToggle.status === 'active';
        toast({ 
            title: isBlocking ? 'User Blocked' : 'User Activated', 
            description: `Account for ${userForStatusToggle.name} is now ${isBlocking ? 'Blocked' : 'Active'}.`,
            className: isBlocking ? 'bg-red-600 text-white' : 'bg-green-600 text-white' 
        });
    } catch (err) {
        toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    } finally {
        setIsProcessing(false);
        setUserForStatusToggle(null);
    }
  };

  const handleConfirmAddFunds = async () => {
    if (!selectedUserForFunds || !amountToAdd || isProcessing) return;
    setIsProcessing(true);
    const numericAmount = Number(amountToAdd);
    const success = await addFunds(selectedUserForFunds.mobile, numericAmount);
    if (success) {
        toast({ title: 'Success', description: `₹${Math.abs(numericAmount)} ${numericAmount < 0 ? 'deducted' : 'added'}.`, className: 'bg-green-600 text-white' });
        setSelectedUserForFunds(null);
        setAmountToAdd('');
    }
    setIsProcessing(false);
  };

  const handleSetZeroBalance = async () => {
    if (!selectedUserForFunds || isProcessing) return;
    setIsProcessing(true);
    const success = await setBalanceToZero(selectedUserForFunds.id);
    if (success) {
        toast({ title: 'Balance Reset', description: 'User balance set to ₹0.', className: 'bg-orange-600 text-white' });
        setSelectedUserForFunds(null);
    }
    setIsProcessing(false);
  };

  const handleConfirmGiveBonus = async () => {
    if (!selectedUserForBonus || !amountForBonus || isProcessing) return;
    setIsProcessing(true);
    const numericAmount = Number(amountForBonus);
    await addBonus(selectedUserForBonus.id, numericAmount);
    toast({ title: 'Success', description: `Bonus ₹${Math.abs(numericAmount)} updated.`, className: 'bg-green-600 text-white' });
    setSelectedUserForBonus(null);
    setAmountForBonus('');
    setIsProcessing(false);
  };

  const handleSetZeroBonus = async () => {
    if (!selectedUserForBonus || isProcessing) return;
    setIsProcessing(true);
    const success = await setBonusToZero(selectedUserForBonus.id);
    if (success) {
        toast({ title: 'Bonus Reset', description: 'Bonus balance set to ₹0.', className: 'bg-orange-600 text-white' });
        setSelectedUserForBonus(null);
    }
    setIsProcessing(false);
  };

  const handleConfirmSetRates = () => {
    if (!selectedUserForRates) return;
    const finalRates: Record<string, number> = {};
    let hasValue = false;
    Object.entries(customRates).forEach(([key, val]) => {
        if (val.trim() !== '') {
            const num = parseFloat(val);
            if (!isNaN(num)) {
                finalRates[key] = num;
                hasValue = true;
            }
        }
    });
    const userDocRef = doc(db, 'users', selectedUserForRates.id);
    updateDoc(userDocRef, { customRates: hasValue ? finalRates : null }).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userDocRef.path, operation: 'update' }));
    });
    toast({ title: 'Rates Updated', className: 'bg-green-600 text-white' });
    setSelectedUserForRates(null);
  };

  const handleConfirmSetDepositBonus = async () => {
    if (!selectedUserForDepositBonus || isProcessing) return;
    setIsProcessing(true);
    try {
        await updateUser({
            id: selectedUserForDepositBonus.id,
            depositBonusEnabled: userBonusEnabled,
            depositBonusPercentage: parseFloat(userBonusPercentage) || 0
        });
        toast({
            title: 'Settings Saved',
            description: `Deposit bonus is now ${userBonusEnabled ? 'Enabled' : 'Disabled'} for ${selectedUserForDepositBonus.name}.`,
            className: 'bg-green-600 text-white'
        });
        setSelectedUserForDepositBonus(null);
    } catch (err) {
        toast({ title: 'Error', description: 'Failed to update settings.', variant: 'destructive' });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    await deleteUser(userToDelete.id);
    toast({ title: 'User Deleted', className: 'bg-red-600 text-white' });
    setUserToDelete(null);
  };

  return (
    <>
    <main className="container mx-auto px-4 py-8 flex-1 animate-in fade-in duration-500 font-normal">
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="space-y-6 bg-white pb-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Manage Users</h1>
            <p className="text-sm font-normal text-slate-500">View and manage all registered users</p>
          </div>
          <div className="relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
            <input
              placeholder="Search by name or mobile..."
              className="w-full pl-12 h-12 bg-slate-100/50 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:bg-white transition-all font-normal text-base placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-100 hover:bg-slate-50">
                  <TableHead className="w-16 text-center text-xs font-normal uppercase tracking-widest text-slate-500">#</TableHead>
                  <TableHead className="text-xs font-normal uppercase tracking-widest text-slate-500">Username</TableHead>
                  <TableHead className="text-xs font-normal uppercase tracking-widest text-slate-500">Mobile</TableHead>
                  <TableHead className="text-right text-xs font-normal uppercase tracking-widest text-slate-500">Balance</TableHead>
                  <TableHead className="text-right text-xs font-normal uppercase tracking-widest text-slate-500">Bonus</TableHead>
                  <TableHead className="text-center text-xs font-normal uppercase tracking-widest text-slate-500">Status</TableHead>
                  <TableHead className="text-center text-xs font-normal uppercase tracking-widest text-slate-500">Joined</TableHead>
                  <TableHead className="text-right pr-10 text-xs font-normal uppercase tracking-widest text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user, idx) => (
                    <UserRow 
                      key={user.id}
                      user={user}
                      index={(currentPage - 1) * ITEMS_PER_PAGE + idx}
                      onAddFunds={setSelectedUserForFunds}
                      onAddBonus={setSelectedUserForBonus}
                      onSetRates={u => {
                        setSelectedUserForRates(u);
                        const rates: Record<string, string> = {};
                        betTypesKeys.forEach(bt => rates[bt.key] = u.customRates?.[bt.key]?.toString() || '');
                        setCustomRates(rates);
                      }}
                      onSetDepositBonus={u => {
                          setSelectedUserForDepositBonus(u);
                          setUserBonusEnabled(u.depositBonusEnabled || false);
                          setUserBonusPercentage(u.depositBonusPercentage?.toString() || '0');
                      }}
                      onViewUser={setSelectedUserForView}
                      onDelete={setUserToDelete}
                      onToggleStatus={handleToggleStatus}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center text-slate-400 font-normal">
                      No users found matching your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between p-6 bg-white border-t border-slate-50">
            <p className="text-xs text-slate-500 font-normal">
              Showing <span className="font-normal text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-normal text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)}</span> of <span className="font-normal text-slate-900">{filteredUsers.length}</span> users
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="h-10 px-5 rounded-xl border-slate-200 text-sm font-normal"
              >
                Previous
              </Button>
              <div className="flex items-center justify-center bg-slate-100 text-slate-900 h-10 w-10 rounded-xl text-sm font-normal">
                {currentPage}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-10 px-5 rounded-xl border-slate-200 text-sm font-normal"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>

    <Dialog open={!!selectedUserForFunds} onOpenChange={o => !o && setSelectedUserForFunds(null)}>
        <DialogContent className="max-w-[280px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl animate-in zoom-in-95 duration-200 font-normal">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white text-center">
            <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-xl backdrop-blur-md">
                <Wallet className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-lg font-normal">Manage Balance</DialogTitle>
            <p className="text-blue-100 text-[9px] mt-1 font-normal uppercase tracking-widest">{selectedUserForFunds?.name}</p>
          </div>
          <div className="p-5 space-y-4 bg-white">
            <div className="space-y-1">
              <Label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">Amount (+ / -)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amountToAdd}
                onChange={e => setAmountToAdd(e.target.value)}
                className="h-12 text-center text-xl font-normal rounded-2xl border-gray-100 bg-gray-50 focus:ring-blue-500"
                disabled={isProcessing}
              />
            </div>
            <div className="flex flex-col gap-2">
                <Button onClick={handleConfirmAddFunds} disabled={isProcessing || !amountToAdd} className="h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 font-normal shadow-lg shadow-blue-100 text-white">
                    {isProcessing ? 'Processing...' : 'Submit'}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setSelectedUserForFunds(null)} disabled={isProcessing} className="h-10 rounded-2xl border-gray-100 font-normal text-xs">Cancel</Button>
                    <Button variant="destructive" onClick={handleSetZeroBalance} disabled={isProcessing} className="h-10 rounded-2xl font-normal text-xs text-white">Set Zero</Button>
                </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedUserForBonus} onOpenChange={o => !o && setSelectedUserForBonus(null)}>
        <DialogContent className="max-w-[280px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl animate-in zoom-in-95 duration-200 font-normal">
          <div className="bg-gradient-to-br from-orange-500 to-red-600 p-6 text-white text-center">
            <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
                <Gift className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-lg font-normal">Manage Bonus</DialogTitle>
            <p className="text-orange-100 text-[9px] mt-1 font-normal uppercase tracking-widest">{selectedUserForBonus?.name}</p>
          </div>
          <div className="p-5 space-y-4 bg-white">
            <div className="space-y-1">
              <Label className="text-[9px] font-normal text-gray-400 uppercase tracking-widest ml-1">Bonus Points (+ / -)</Label>
              <Input
                  type="number"
                  placeholder="0.00"
                  value={amountForBonus}
                  onChange={e => setAmountForBonus(e.target.value)}
                  className="h-12 text-center text-xl font-normal rounded-2xl bg-gray-50 border-gray-100"
                  disabled={isProcessing}
              />
            </div>
            <div className="flex flex-col gap-2">
                <Button onClick={handleConfirmGiveBonus} disabled={isProcessing || !amountForBonus} className="h-11 rounded-2xl bg-orange-600 hover:bg-orange-700 font-normal shadow-lg shadow-orange-100 text-white">
                    {isProcessing ? 'Processing...' : 'Update'}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setSelectedUserForBonus(null)} disabled={isProcessing} className="h-10 rounded-2xl border-gray-100 font-normal text-xs">Cancel</Button>
                    <Button variant="destructive" onClick={handleSetZeroBonus} disabled={isProcessing} className="h-10 rounded-2xl font-normal text-xs text-white">Set Zero</Button>
                </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit Bonus Dialog */}
      <Dialog open={!!selectedUserForDepositBonus} onOpenChange={o => !o && setSelectedUserForDepositBonus(null)}>
        <DialogContent className="max-w-[300px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl font-normal">
          <div className="bg-gradient-to-br from-yellow-500 to-orange-600 p-6 text-white text-center">
            <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
                <Zap className="h-6 w-6 text-white fill-white" />
            </div>
            <DialogTitle className="text-lg font-normal">Deposit Bonus</DialogTitle>
            <p className="text-yellow-100 text-[9px] mt-1 font-normal uppercase tracking-widest">{selectedUserForDepositBonus?.name}</p>
          </div>
          <div className="p-6 space-y-6 bg-white">
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-slate-700">Auto Bonus</Label>
                    <p className="text-[10px] text-slate-400">Give bonus on every deposit</p>
                </div>
                <Switch 
                    checked={userBonusEnabled} 
                    onCheckedChange={setUserBonusEnabled}
                    className="data-[state=checked]:bg-orange-500"
                />
            </div>
            
            <div className="space-y-1.5 px-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bonus Percentage (%)</Label>
              <div className="relative">
                <Input
                    type="number"
                    placeholder="0"
                    value={userBonusPercentage}
                    onChange={e => setUserBonusPercentage(e.target.value)}
                    className="h-12 pr-10 text-center text-xl font-bold rounded-2xl bg-gray-50 border-gray-100 focus:ring-orange-500"
                    disabled={!userBonusEnabled || isProcessing}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
                <Button onClick={handleConfirmSetDepositBonus} disabled={isProcessing} className="h-12 rounded-2xl bg-[#154c79] hover:bg-[#0a2e4a] font-bold shadow-lg shadow-blue-100 text-white">
                    {isProcessing ? 'Saving...' : 'Save Settings'}
                </Button>
                <Button variant="ghost" onClick={() => setSelectedUserForDepositBonus(null)} disabled={isProcessing} className="h-10 rounded-2xl font-normal text-xs text-slate-400">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedUserForRates} onOpenChange={o => !o && setSelectedUserForRates(null)}>
        <DialogContent className="max-w-[320px] rounded-3xl p-5 shadow-2xl border-none font-normal">
          <DialogHeader>
            <DialogTitle className="text-lg font-normal text-primary flex items-center gap-2">
                <Percent className="h-5 w-5 text-purple-500" />
                Rates: {selectedUserForRates?.name}
            </DialogTitle>
            <DialogDescription className="text-[10px] font-normal">Empty = Default rates.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            {betTypesKeys.map((bt) => (
                <div key={bt.key} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100 hover:bg-white transition-colors">
                    <Label className="font-normal text-[10px] text-[#154c79]">{bt.label}</Label>
                    <div className="relative w-20">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-normal text-muted-foreground">x</span>
                        <Input
                            type="number"
                            step="0.1"
                            value={customRates[bt.key] || ''}
                            onChange={e => setCustomRates({ ...customRates, [bt.key]: e.target.value })}
                            className="h-8 pl-5 text-right font-normal bg-white rounded-lg border-gray-200 text-xs"
                        />
                    </div>
                </div>
            ))}
          </div>
          <DialogFooter className="mt-3 gap-2 flex-row">
            <Button variant="outline" onClick={() => setSelectedUserForRates(null)} className="rounded-xl h-10 flex-1 font-normal text-xs">Cancel</Button>
            <Button onClick={handleConfirmSetRates} className="rounded-xl h-10 flex-1 bg-purple-600 hover:bg-purple-700 font-normal shadow-lg shadow-purple-100 text-xs text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!selectedUserForView} onOpenChange={o => !o && setSelectedUserForView(null)}>
        <DialogContent className="max-w-[300px] rounded-[2rem] p-0 overflow-hidden shadow-2xl border-none animate-in slide-in-from-bottom-8 duration-300 font-normal">
            {selectedUserForView && (
                <>
                <div className="bg-gradient-to-b from-[#1e638f] to-[#154c79] p-8 text-center text-white relative">
                    <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
                        <Shield className="h-3.5 w-3.5" />
                    </div>
                    <div className="h-20 w-20 mb-3 rounded-full border-4 border-white/20 mx-auto shadow-2xl bg-white/10 flex items-center justify-center text-3xl font-normal">
                        {selectedUserForView.name.charAt(0).toUpperCase()}
                    </div>
                    <DialogTitle className="text-xl font-normal tracking-tight">{selectedUserForView.name}</DialogTitle>
                    <p className="text-blue-100/80 font-normal text-xs mt-1">{selectedUserForView.mobile}</p>
                </div>
                <div className="p-6 space-y-3 bg-white">
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Password</span>
                        <span className="font-normal text-[#154c79] font-mono text-base tracking-[0.15em]">{selectedUserForView.password}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Wallet</span>
                        <span className="font-normal text-blue-600 text-base">₹{(selectedUserForView.balance || 0).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Bonus</span>
                        <span className="font-normal text-orange-600 text-base">₹{(selectedUserForView.bonusBalance || 0).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Promo</span>
                        <span className="font-bold text-slate-900 text-xs">
                            {selectedUserForView.depositBonusEnabled ? `${selectedUserForView.depositBonusPercentage}% Bonus Enabled` : 'Bonus Disabled'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <span className="text-[9px] font-normal text-gray-400 uppercase tracking-widest">Joined</span>
                        <span className="font-normal text-slate-900 text-[10px]">
                            {selectedUserForView.joinedAt ? format(new Date(selectedUserForView.joinedAt), 'dd MMM yyyy') : 'N/A'}
                        </span>
                    </div>
                    <Button variant="secondary" className="w-full mt-4 rounded-xl h-10 font-normal uppercase text-[10px] tracking-widest bg-gray-100 hover:bg-gray-200" onClick={() => setSelectedUserForView(null)}>Close</Button>
                </div>
                </>
            )}
        </DialogContent>
    </Dialog>

    <AlertDialog open={!!userToDelete} onOpenChange={o => !o && setUserToDelete(null)}>
      <AlertDialogContent className="max-w-[300px] rounded-3xl p-6 border-none shadow-2xl font-normal">
        <div className="text-center space-y-4">
            <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-500 shadow-inner">
                <UserX className="h-8 w-8" />
            </div>
            <AlertDialogHeader>
                <AlertDialogTitle className="text-center text-xl font-normal text-gray-800">Delete User?</AlertDialogTitle>
                <AlertDialogDescription className="text-center text-[10px] font-normal leading-relaxed text-muted-foreground">
                    Permanently remove <span className="font-normal text-red-600">{userToDelete?.name}</span>? This is irreversible.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col gap-2">
                <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-10 font-normal shadow-lg shadow-red-100 border-none text-xs">
                    Yes, Delete
                </AlertDialogAction>
                <AlertDialogCancel className="rounded-xl border-gray-100 h-10 text-gray-500 font-normal text-xs">Cancel</AlertDialogCancel>
            </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>

    {/* Confirmation Dialog for Status Toggle (Block/Activate) */}
    <AlertDialog open={!!userForStatusToggle} onOpenChange={o => !o && setUserForStatusToggle(null)}>
      <AlertDialogContent className="max-w-[300px] rounded-3xl p-6 border-none shadow-2xl font-normal">
        <div className="text-center space-y-4">
            <div className={cn(
                "h-16 w-16 rounded-2xl flex items-center justify-center mx-auto shadow-inner",
                userForStatusToggle?.status === 'active' ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"
            )}>
                {userForStatusToggle?.status === 'active' ? <UserX className="h-8 w-8" /> : <Shield className="h-8 w-8" />}
            </div>
            <AlertDialogHeader>
                <AlertDialogTitle className="text-center text-xl font-normal text-gray-800">
                    {userForStatusToggle?.status === 'active' ? 'Block User?' : 'Activate User?'}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-center text-[10px] font-normal leading-relaxed text-muted-foreground">
                    Are you sure you want to {userForStatusToggle?.status === 'active' ? 'BLOCK' : 'ACTIVATE'} <span className="font-bold text-slate-900">{userForStatusToggle?.name}</span>?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col gap-2">
                <AlertDialogAction 
                    onClick={handleConfirmToggleStatus} 
                    disabled={isProcessing}
                    className={cn(
                        "text-white rounded-xl h-10 font-normal shadow-lg border-none text-xs",
                        userForStatusToggle?.status === 'active' ? "bg-red-600 hover:bg-red-700 shadow-red-100" : "bg-green-600 hover:bg-green-700 shadow-green-100"
                    )}
                >
                    {isProcessing ? 'Processing...' : (userForStatusToggle?.status === 'active' ? 'Yes, Block' : 'Yes, Activate')}
                </AlertDialogAction>
                <AlertDialogCancel className="rounded-xl border-gray-100 h-10 text-gray-500 font-normal text-xs" disabled={isProcessing}>
                    Cancel
                </AlertDialogCancel>
            </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
