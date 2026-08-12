'use client';

import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Game } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PanelChartData {
  id: string;
  gameName: string;
  title: string;
  data: string;
  activeDays?: string[];
}

const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const formSchema = z.object({
  gameId: z.string().min(1, 'A game must be selected'),
  title: z.string().min(3, 'Chart title must be at least 3 characters.'),
  data: z.string().min(1, 'Chart data cannot be empty.'),
  activeDays: z.array(z.string()).refine(value => value.some(item => item), {
    message: "You have to select at least one day.",
  })
});

type FormValues = z.infer<typeof formSchema>;

interface ChartFormProps {
  game: Game | null;
  chart: PanelChartData | null;
  onSave: (game: Game, data: Omit<PanelChartData, 'id' | 'gameName'>) => void;
  onCancel: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  allGames: Game[];
}

export function ChartForm({ game, chart, onSave, onCancel, isOpen, setIsOpen, allGames }: ChartFormProps) {

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gameId: '',
      title: '',
      data: '',
      activeDays: allDays,
    },
  });
  
  useEffect(() => {
    if (chart && game) {
        form.reset({
            gameId: game.id,
            title: chart.title || `${game.name} Panel Chart`,
            data: chart.data || '',
            activeDays: chart.activeDays || allDays,
        });
    } else {
        form.reset({
            gameId: '',
            title: '',
            data: '',
            activeDays: allDays,
        });
    }
  }, [chart, game, form]);


  const onSubmit: SubmitHandler<FormValues> = (data) => {
    const selectedGame = allGames.find(g => g.id === data.gameId);
    if (!selectedGame) {
        // This should not happen if validation is correct
        console.error("Selected game not found on submit");
        return;
    }
    const { gameId, ...chartData } = data;
    onSave(selectedGame, chartData);
  };

  return (
     <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{chart ? `Edit Chart for: ${game?.name}` : 'Add New Chart'}</DialogTitle>
              <DialogDescription>
                {chart ? "Make changes to the existing chart data." : "Enter the details below to create a new panel chart for a market."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="gameId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Game</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!chart}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a game" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {allGames.map((game) => (
                                        <SelectItem key={game.id} value={game.id}>
                                            {game.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Chart Title</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Milan Day Panel Chart" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                
                <FormField
                    control={form.control}
                    name="activeDays"
                    render={() => (
                        <FormItem>
                        <div className="mb-4">
                            <FormLabel className="text-base">Chart Active Days</FormLabel>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {allDays.map((day) => (
                            <FormField
                            key={day}
                            control={form.control}
                            name="activeDays"
                            render={({ field }) => {
                                return (
                                <FormItem
                                    key={day}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                    <FormControl>
                                    <Checkbox
                                        checked={field.value?.includes(day)}
                                        onCheckedChange={(checked) => {
                                        return checked
                                            ? field.onChange([...(field.value || []), day])
                                            : field.onChange(
                                                (field.value || []).filter(
                                                    (value) => value !== day
                                                )
                                            )
                                        }}
                                    />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                    {day}
                                    </FormLabel>
                                </FormItem>
                                )
                            }}
                            />
                        ))}
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                />


                <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Chart Data</FormLabel>
                    <FormControl>
                        <Textarea
                            placeholder="Enter data for each row."
                            className="min-h-[250px]"
                            {...field}
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <div className="flex justify-end gap-2 p-0 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                    </Button>
                    <Button type="submit">Save Changes</Button>
                </div>
            </form>
            </Form>
        </DialogContent>
    </Dialog>
  );
}
