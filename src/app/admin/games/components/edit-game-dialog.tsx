'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useGameStore } from '@/lib/store';
import type { Game } from '@/lib/types';
import { Loader } from '@/components/loader';

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const editGameSchema = z.object({
  name: z.string().min(1, 'Game name is required.'),
  status: z.string().min(1, 'Status is required.'),
  openTime: z.string().min(1, 'Open time is required.'),
  closeTime: z.string().min(1, 'Close time is required.'),
  activeDays: z.array(z.string()).refine((value) => value.some((day) => day), {
    message: "You have to select at least one day.",
  }),
});

type EditGameFormValues = z.infer<typeof editGameSchema>;

interface EditGameDialogProps {
  game: Game;
}

export function EditGameDialog({ game }: EditGameDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { updateGame } = useGameStore();

  const form = useForm<EditGameFormValues>({
    resolver: zodResolver(editGameSchema),
    defaultValues: {
      name: game.name || '',
      status: game.status || 'Betting is Open',
      openTime: game.openTime || '',
      closeTime: game.closeTime || '',
      activeDays: game.activeDays || daysOfWeek,
    },
  });

  const onSubmit = async (values: EditGameFormValues) => {
    try {
      await updateGame(game.id, values);
      toast({
        title: 'Success!',
        description: 'Game has been updated.',
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating game: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update the game. Please try again.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10 hover:text-blue-400">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Game: {game.name}</DialogTitle>
          <DialogDescription>
            Update the timing, betting status, and active days for this market.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Game Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Betting Status</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="openTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Open Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
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
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
                control={form.control}
                name="activeDays"
                render={() => (
                    <FormItem>
                    <div className="mb-2">
                        <FormLabel className="text-base">Game Active Days</FormLabel>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {daysOfWeek.map((day) => (
                        <FormField
                            key={day}
                            control={form.control}
                            name="activeDays"
                            render={({ field }) => (
                            <FormItem key={day} className="flex flex-row items-start space-x-2 space-y-0">
                                <FormControl>
                                <Checkbox
                                    checked={field.value?.includes(day)}
                                    onCheckedChange={(checked) => {
                                    const currentDays = field.value || [];
                                    return checked
                                        ? field.onChange([...currentDays, day])
                                        : field.onChange(currentDays.filter((value) => value !== day));
                                    }}
                                />
                                </FormControl>
                                <FormLabel className="font-normal text-sm">{day}</FormLabel>
                            </FormItem>
                            )}
                        />
                        ))}
                    </div>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader className="mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
