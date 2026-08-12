
'use client';

import { useState, useEffect } from 'react';
import { useUserStore, useSettingsStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditCard, AlertCircle, CheckCircle2, QrCode, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/loader';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Image from 'next/image';

const CustomWalletIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg">
    <path style={{ fill: '#A35425' }} d="M480,143.996h-96v368h96c17.672,0,32-14.328,32-32v-304C512,158.324,497.672,143.996,480,143.996z" />
    <circle style={{ fill: '#F19920' }} cx="176" cy="144.004" r="64" />
    <path style={{ fill: '#F19920' }} d="M209.92,177.916c18.752-18.736,18.776-49.128,0.04-67.88c-0.016-0.016-0.024-0.024-0.04-0.04 L142,177.916c18.736,18.752,49.128,18.776,67.88,0.04C209.896,177.94,209.904,177.924,209.92,177.916z" />
    <path style={{ fill: '#F6B545' }} d="M142.08,110.076c-18.752,18.736-18.776,49.128-0.04,67.88c0.016,0.016,0.024,0.024,0.04,0.04 l67.92-67.92c-18.736-18.752-49.128-18.776-67.88-0.04C142.104,110.052,142.096,110.06,142.08,110.076z" />
    <circle style={{ fill: '#F19920' }} cx="320" cy="64.004" r="64" />
    <path style={{ fill: '#89C763' }} d="M472,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C496,170.74,485.256,159.996,472,159.996z" />
    <path style={{ fill: '#3CB54A' }} d="M456,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C480,170.74,469.256,159.996,456,159.996z" />
    <path style={{ fill: '#89C763' }} d="M440,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C464,170.74,453.256,159.996,440,159.996z" />
    <path style={{ fill: '#3CB54A' }} d="M424,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C448,170.74,437.256,159.996,424,159.996z" />
    <path style={{ fill: '#C97629' }} d="M32,143.996h352c17.672,0,32,14.328,32,32v304c0,17.672-14.328,32-32,32H32 c-17.672,0-32-14.328-32-32v-304C0,158.324,14.328,143.996,32,143.996z" />
    <path style={{ fill: '#89C763' }} d="M411.76,159.996c2.816,4.864,4.28,10.384,4.24,16v304c0.04,5.616-1.424,11.136-4.24,16 c11.768-1.864,20.384-12.088,20.24-24v-288C432.144,172.076,423.528,161.86,411.76,159.996z" />
    <rect x="416" y="271.996" style={{ fill: '#D5E3EF' }} width="96" height="112" />
    <path style={{ fill: '#ECF0F9' }} d="M320,271.996c-30.928,0-56,25.072-56,56s25.072,56,56,56h96v-112H320z" />
    <circle style={{ fill: '#7F4122' }} cx="320" cy="327.996" r="24" />
    <rect x="496" y="383.996" style={{ fill: '#7F4122' }} width="16" height="16" />
    <rect x="480" y="383.996" style={{ fill: '#3CB54A' }} width="16" height="16" />
    <rect x="448" y="383.996" style={{ fill: '#3CB54A' }} width="16" height="16" />
    <rect x="416" y="383.996" style={{ fill: '#3CB54A' }} width="16" height="16" />
    <rect x="464" y="383.996" style={{ fill: '#0E9347' }} width="16" height="16" />
    <rect x="432" y="383.996" style={{ fill: '#0E9347' }} width="16" height="16" />
    <path style={{ fill: '#B06328' }} d="M320,383.996c-27.816-0.032-51.384-20.472-55.36-48c-4.416,30.608,16.816,59.008,47.424,63.424 c2.624,0.376,5.28,0.568,7.936,0.576h80v80c0,8.84-7.16,16-16,16H48c-8.84,0-16,7.16-16,16h352c17.672,0,32-14.328,32-32v-96H320z" />
    <path style={{ fill: '#D5E3EF' }} d="M336,367.996h80l0,0v16l0,0h-96l0,0l0,0C320,375.156,327.16,367.996,336,367.996z" />
    <path style={{ fill: '#B0C4D9' }} d="M496,287.996v80h-80v16h96v-112l0,0C503.16,271.996,496,279.156,496,287.996z" />
    <path style={{ fill: '#F19920' }} d="M353.92,97.916c18.752-18.736,18.776-49.128,0.04-67.88c-0.016-0.016-0.024-0.024-0.04-0.04 L286,97.916c18.736,18.752,49.128,18.776,67.88,0.04C353.896,97.94,353.904,97.924,353.92,97.916z" />
    <path style={{ fill: '#F6B545' }} d="M286.08,30.076c-18.752,18.736-18.776,49.128-0.04,67.88c0.016,0.016,0.024,0.024,0.04,0.04 L354,30.076c-18.736-18.752-49.128-18.776-67.88-0.04C286.104,30.052,286.096,30.06,286.08,30.076z" />
  </svg>
);

export default function AddFundsPage() {
  const { currentUser } = useUserStore();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const { appSettings } = useSettingsStore();
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const presetAmounts = [200, 300, 500, 1000, 1500, 2000, 2500];

  const handleInstantPay = () => {
    const numericAmount = parseFloat(amount);
    const minDeposit = appSettings.minDeposit || 100;

    if (!numericAmount || numericAmount < minDeposit) {
      toast({
        title: '❌ Invalid Amount',
        description: `Minimum deposit amount is ₹${minDeposit}.`,
        className: 'bg-header text-white border-none shadow-lg'
      });
      return;
    }

    if (!appSettings.upiId) {
      toast({
        title: '⚠️ System Busy',
        description: 'Instant payment is temporarily unavailable. Please contact support.',
        variant: 'destructive'
      });
      return;
    }

    setIsQrModalOpen(true);
  };

  const handleFinalSubmit = async () => {
    setIsAddingFunds(true);

    try {
      // Create a deposit request in Firestore
      await addDoc(collection(db, 'deposits'), {
        userId: currentUser?.id,
        displayName: currentUser?.name || 'User',
        mobile: currentUser?.mobile || '',
        amount: parseFloat(amount),
        status: 'pending',
        createdAt: serverTimestamp(),
        paymentMethod: 'UPI Instant (QR)',
        transactionId: `TXN${Date.now().toString().slice(-6)}`, // Auto-generated ID
      });

      toast({
        title: '✅ Request Submitted',
        description: 'Your deposit request has been sent to admin for verification.',
        className: 'bg-green-600 text-white'
      });
      
      setIsQrModalOpen(false);
      setAmount('');
    } catch (error: any) {
      console.error("Error creating deposit request:", error);
      toast({
        title: '❌ Error',
        description: 'Could not submit request. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsAddingFunds(false);
    }
  };

  const upiUri = `upi://pay?pa=${appSettings.upiId || ''}&pn=${encodeURIComponent(appSettings.appName || 'Matka App')}&am=${amount}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;

  const handleCopyUpi = () => {
    if (appSettings.upiId) {
        navigator.clipboard.writeText(appSettings.upiId);
        toast({ title: "UPI ID Copied!" });
    }
  };

  const defaultNotice = "!! Add Fund Notice !!\nMinimum Deposit - ₹100\nपेमेंट एड करने के बाद एप को रिफ्रेश करे। अगर आपका पेमेंट आपके वॉलेट में नहीं आता है तो पेमेंट का स्क्रीन शॉट व्हाट्सएप पर एडमिन को भेजे।";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 w-full border-b bg-header text-white">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="w-8"></div>
          <h1 className="font-bold text-base">Add Funds</h1>
          <CustomWalletIcon className="h-6 w-6" />
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="text-center mb-4">
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Current Balance</h2>
          <div className="flex justify-center items-center flex-col mt-2">
            <div className="relative flex items-center justify-center h-20 w-20 rounded-3xl bg-white shadow-lg mb-2 border border-gray-100">
              <CustomWalletIcon className="h-12 w-12" />
            </div>
            <p className="text-2xl font-bold text-gray-800">₹{currentUser?.balance?.toFixed(0) ?? '0'}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-header text-white rounded-xl p-3 text-center shadow-md border border-white/10 overflow-hidden relative">
            <div className="flex items-center justify-center gap-2 mb-1">
              <AlertCircle className="h-3 w-3 text-yellow-400" />
              <h3 className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">!! Add Fund Notice !!</h3>
            </div>
            <p className="text-[10px] whitespace-pre-wrap leading-tight text-white/90">
              {appSettings.addFundNotice || defaultNotice}
            </p>
          </div>

          <div className="pt-1">
            <label htmlFor="amount" className="text-[10px] font-bold text-gray-500 mb-1.5 block ml-1 uppercase">
              Enter Deposit Amount (Min: ₹{appSettings.minDeposit || 100})
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-base font-bold text-primary">₹</span>
              <Input
                id="amount"
                type="number"
                placeholder=""
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 h-12 text-lg font-bold rounded-xl border-gray-200 focus:ring-primary shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {presetAmounts.map((preset) => (
              <Button
                key={preset}
                variant="outline"
                className={cn(
                  "h-10 text-xs bg-white border-gray-200 shadow-sm text-gray-700 font-bold rounded-lg active:scale-95 transition-all",
                  amount === preset.toString() && 'bg-primary text-white border-primary shadow-md'
                )}
                onClick={() => setAmount(preset.toString())}
              >
                ₹{preset}
              </Button>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full h-12 text-base font-bold bg-gradient-to-b from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 rounded-xl shadow-md mt-2 active:scale-[0.98] transition-all"
            onClick={handleInstantPay}
          >
            <QrCode className="mr-2 h-5 w-5" />
            Proceed to Pay (Instant)
          </Button>
        </div>
      </main>

      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="max-w-[90%] sm:max-w-md rounded-2xl p-0 overflow-hidden">
            <div className="bg-header p-4 text-white text-center">
                <DialogTitle className="text-lg font-bold">Scan QR to Pay</DialogTitle>
                <p className="text-xs opacity-80 uppercase tracking-widest mt-1">Instant Wallet Update</p>
            </div>
            
            <div className="p-6 flex flex-col items-center gap-6">
                <div className="relative bg-white p-3 rounded-2xl shadow-xl border-2 border-dashed border-gray-200">
                    <Image 
                        src={qrUrl} 
                        alt="UPI QR Code" 
                        width={200} 
                        height={200} 
                        className="rounded-lg"
                        priority
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                        <QrCode className="w-24 h-24 text-primary" />
                    </div>
                </div>

                <div className="w-full space-y-4">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col items-center gap-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Payable Amount</p>
                        <p className="text-2xl font-black text-primary">₹{amount}</p>
                        
                        <div className="flex items-center gap-2 mt-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                            <span className="text-[11px] font-medium text-gray-600 truncate max-w-[150px]">{appSettings.upiId}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={handleCopyUpi}>
                                <Copy className="h-3 w-3 text-blue-500" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <DialogFooter className="p-4 bg-gray-50 flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="rounded-xl border-gray-200" onClick={() => setIsQrModalOpen(false)}>Cancel</Button>
                <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl font-bold" 
                    onClick={handleFinalSubmit}
                    disabled={isAddingFunds}
                >
                    {isAddingFunds ? <Loader className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {isAddingFunds ? 'Verifying...' : 'I Have Paid (Submit)'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

