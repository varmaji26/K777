'use client';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { DollarSign, Plus, Smartphone } from 'lucide-react';

interface DepositDialogProps {
    buttonText?: string;
}

export function DepositDialog({ buttonText = "Add Points" }: DepositDialogProps) {
  const paymentMethods = ['PhonePe', 'GPay', 'Paytm'];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-green-600 text-white hover:bg-green-700">
          <Plus className="mr-2 h-5 w-5" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Choose Deposit Method</DialogTitle>
          <DialogDescription>Select your preferred UPI app to make a payment.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex justify-center space-x-4 mb-6">
            {paymentMethods.map((method) => (
              <Button key={method} variant="outline" className="flex-1">
                <Smartphone className="mr-2 h-4 w-4" />
                {method}
              </Button>
            ))}
          </div>
          <div className="bg-card p-4 rounded-lg border flex flex-col items-center gap-4">
            <h4 className="text-lg font-semibold text-center">Scan QR Code to Pay</h4>
            <div className="bg-white p-2 rounded-md">
               <Image
                src="https://placehold.co/200x200/png"
                alt="QR Code for Payment"
                width={200}
                height={200}
                className="rounded-md"
                data-ai-hint="qr code"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Scan this QR code using your preferred UPI app.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
