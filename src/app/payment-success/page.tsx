'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';

export default function PaymentSuccessPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const orderId = searchParams.get('order_id');
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState('pending');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const checkPaymentStatus = async () => {
        if (!orderId) return;
        setIsRefreshing(true);
        try {
            // Poll our own API which checks IMB directly
            const res = await fetch(`/api/verify-imb-payment?order_id=${orderId}`);
            const data = await res.json();
            console.log('Payment verification result:', data);

            if (data.status === 'approved') {
                setStatus('approved');
                setIsLoading(false);
            } else if (data.status === 'failed') {
                setStatus('failed');
                setIsLoading(false);
            }
        } catch (err) {
            console.error('Verification error:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (!orderId) {
            setIsLoading(false);
            return;
        }

        // Automatic polling every 4 seconds
        const interval = setInterval(() => {
            if (status === 'pending') {
                checkPaymentStatus();
            } else {
                clearInterval(interval);
            }
        }, 4000);

        // Stop polling after 5 minutes
        const timeout = setTimeout(() => {
            clearInterval(interval);
            if (status === 'pending') setIsLoading(false);
        }, 300000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [orderId, status]);

    if (isLoading && status === 'pending') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="text-center p-6 space-y-6">
                    <div className="relative mx-auto w-24 h-24">
                        <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                        <Clock className="absolute inset-0 m-auto h-10 w-10 text-blue-600" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-gray-800">Verifying Payment</h1>
                        <p className="text-gray-500 max-w-xs mx-auto">
                            We are confirming your payment with the bank. This usually takes a few seconds.
                        </p>
                    </div>
                    <div className="pt-4">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={checkPaymentStatus} 
                            disabled={isRefreshing}
                            className="rounded-full gap-2"
                        >
                            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                            {isRefreshing ? 'Checking...' : 'Check Status Now'}
                        </Button>
                    </div>
                    <p className="text-[10px] text-gray-400">Order ID: {orderId}</p>
                </div>
            </div>
        );
    }

    if (status === 'failed') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-50">
                <div className="text-center max-w-sm p-8 bg-white rounded-3xl shadow-xl border border-red-100 mx-4 space-y-6">
                    <XCircle className="mx-auto h-20 w-20 text-red-500 animate-bounce" />
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-gray-900">Payment Failed</h1>
                        <p className="text-gray-500">
                            Unfortunately, the payment could not be processed. If money was deducted, it will be refunded automatically.
                        </p>
                    </div>
                    <div className="space-y-3 pt-4">
                        <Button onClick={() => router.push('/add-funds')} className="w-full h-12 bg-red-600 hover:bg-red-700 rounded-xl font-bold">
                            Try Again
                        </Button>
                        <Button variant="ghost" onClick={() => router.push('/home')} className="w-full text-gray-500">
                            Back to Home
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-green-50">
            <div className="text-center max-w-sm p-8 bg-white rounded-3xl shadow-xl border border-green-100 mx-4 space-y-6">
                <div className="relative mx-auto w-20 h-20">
                    <CheckCircle2 className="h-20 w-20 text-green-500" />
                    <div className="absolute -inset-2 bg-green-500/20 rounded-full animate-ping"></div>
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-gray-900">Add Cash Successful!</h1>
                    <p className="text-gray-500">
                        ₹{searchParams.get('amount') || 'Amount'} has been added to your wallet successfully.
                    </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl text-left space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400 font-medium">Status:</span>
                        <span className="text-green-600 font-bold uppercase">Success</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400 font-medium">Transaction ID:</span>
                        <span className="text-gray-800 font-mono font-bold truncate ml-4">{orderId}</span>
                    </div>
                </div>
                <Button onClick={() => router.push('/home')} className="w-full h-12 bg-green-600 hover:bg-green-700 rounded-xl font-bold shadow-lg shadow-green-200">
                    Go to Dashboard
                </Button>
            </div>
        </div>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
