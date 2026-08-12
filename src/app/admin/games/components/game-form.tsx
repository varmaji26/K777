'use client';

import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Game } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  name: z.string().min(3, 'Game name must be at least 3 characters.'),
  openTime: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, "Invalid time format. Use hh:mm AM/PM."),
  closeTime: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, "Invalid time format. Use hh:mm AM/PM."),
  openResult: z.string().regex(/^$|^\d{3}$/, 'Must be a 3-digit number or empty.'),
  closeResult: z.string().regex(/^$|^\d{3}$/, 'Must be a 3-digit number or empty.'),
});

type FormValues = z.infer<typeof formSchema>;

interface GameFormProps {
  game: Game | null;
  onSave: (data: Omit<Game, 'id' | 'createdAt'> | Game) => void;
  onCancel: () => void;
}

export function GameForm({ game, onSave, onCancel }: GameFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: game?.name || '',
      openTime: game?.openTime || '',
      closeTime: game?.closeTime || '',
      openResult: game?.openResult || '',
      closeResult: game?.closeResult || '',
    },
  });

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    if (game) {
      onSave({ ...game, ...data });
    } else {
      onSave(data);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{game ? 'Edit Game' : 'Add New Game'}</CardTitle>
        <CardDescription>
          {game ? 'Update the details for this game.' : 'Fill in the details for the new game.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Game Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Milan Day" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="openTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Open Time</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 02:00 PM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="closeTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Close Time</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 04:00 PM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="openResult"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Open Result (Pana)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="closeResult"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Close Result (Pana)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <CardFooter className="flex justify-end gap-2 p-0 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
                </Button>
                <Button type="submit">Save Game</Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
