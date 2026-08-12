'use client';

import { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DocumentData } from 'firebase/firestore';

interface Bid extends DocumentData {
    id: string;
    numbers: string[];
    totalAmount: number;
}

const formSchema = z.object({
  numbers: z.string().min(1, 'Numbers cannot be empty.'),
  totalAmount: z.coerce.number().min(0, 'Amount must be a positive number.'),
});

type FormValues = z.infer<typeof formSchema>;

interface EditBidFormProps {
  bid: Bid;
  isOpen: boolean;
  onClose: () => void;
  onSave: (bidId: string, newNumbers: string[], newTotalAmount: number) => void;
}

export function EditBidForm({ bid, isOpen, onClose, onSave }: EditBidFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      numbers: '',
      totalAmount: 0,
    },
  });

  useEffect(() => {
    if (bid) {
      form.reset({
        numbers: bid.numbers.join(', '),
        totalAmount: bid.totalAmount,
      });
    }
  }, [bid, form]);

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    const newNumbers = data.numbers.split(',').map(n => n.trim()).filter(Boolean);
    onSave(bid.id, newNumbers, data.totalAmount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Bid</DialogTitle>
          <DialogDescription>
            Change the numbers or amount for this bid. This action is final.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="numbers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bid Numbers</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 123, 456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Amount</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
