'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function IMBPaymentGateway() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const orderId = searchParams.get('order_id');
    const amount = searchParams.get('amount');
    const [isProcessing, setIsProcessing] = useState(false);
    const [timeLeft, setTimeLeft] = useState(30);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handlePaymentComplete();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const handlePaymentComplete = () => {
        router.push(`/payment-success?order_id=${orderId}`);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="text-4xl font-bold text-indigo-600 mb-2">IMB Gateway</div>
                    <p className="text-gray-600">Complete Your Payment</p>
                </div>

                {/* QR Code Simulation */}
                <div className="bg-gray-100 p-8 rounded-lg mb-6 flex flex-col items-center">
                    <div className="w-48 h-48 bg-gradient-to-br from-gray-300 to-gray-400 rounded-lg flex items-center justify-center mb-4">
                        <div className="text-center">
                            <div className="text-6xl mb-2">📱</div>
                            <p className="text-sm text-gray-700">QR Code</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 text-center">
                        Scan this QR code with your phone to complete payment
                    </p>
                </div>

                {/* Payment Details */}
                <div className="bg-indigo-50 p-4 rounded-lg mb-6 space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Order ID:</span>
                        <span className="font-mono font-semibold text-gray-900">{orderId}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Amount:</span>
                        <span className="font-semibold text-gray-900">₹{amount}</span>
                    </div>
                    <div className="border-t border-indigo-200 pt-3 flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className="text-amber-600 font-semibold">Waiting for payment...</span>
                    </div>
                </div>

                {/* Timer */}
                <div className="text-center mb-6">
                    <p className="text-sm text-gray-600 mb-2">Auto-completing in:</p>
                    <div className="text-3xl font-bold text-indigo-600">{timeLeft}s</div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <Button
                        onClick={handlePaymentComplete}
                        disabled={isProcessing}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                    >
                        {isProcessing ? 'Processing...' : 'Complete Payment ✓'}
                    </Button>
                    <Button
                        onClick={() => router.push('/add-funds')}
                        variant="outline"
                        className="w-full"
                    >
                        Cancel Payment
                    </Button>
                </div>

                {/* Info Text */}
                <p className="text-xs text-gray-500 text-center mt-4">
                    This is a simulated payment gateway for testing purposes
                </p>
            </div>
        </div>
    );
}