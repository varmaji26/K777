
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@/components/loader';
import { Share2, Phone, MessageSquare } from 'lucide-react';

const contactSettingsSchema = z.object({
  shareLink: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
  whatsappNumber: z.string().min(10, 'Please enter a valid phone number.'),
  supportNumber: z.string().min(10, 'Please enter a valid phone number.'),
});

type ContactSettingsFormValues = z.infer<typeof contactSettingsSchema>;

export default function ContactSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  const form = useForm<ContactSettingsFormValues>({
    resolver: zodResolver(contactSettingsSchema),
    defaultValues: {
      shareLink: '',
      whatsappNumber: '',
      supportNumber: '',
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const appSettingsDocRef = doc(db, 'settings', 'app-settings');
        const appSettingsDocSnap = await getDoc(appSettingsDocRef);

        if (appSettingsDocSnap.exists()) {
          const data = appSettingsDocSnap.data();
          form.reset({
            shareLink: data.shareLink || '',
            whatsappNumber: data.whatsappNumber || '',
            supportNumber: data.supportNumber || '',
          });
        }
      } catch (error) {
        console.error("Error fetching settings: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch settings.' });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [form, toast]);

  const onSubmit = async (values: ContactSettingsFormValues) => {
    try {
      const appSettingsDocRef = doc(db, 'settings', 'app-settings');
      await setDoc(appSettingsDocRef, values, { merge: true });
      toast({
        title: 'Contact Settings Updated!',
        description: 'The contact and share settings have been saved.',
        className: 'bg-green-600 text-white'
      });
    } catch (error) {
      console.error("Error updating contact settings: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save contact settings.' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 flex-1">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
            <div className="flex items-center gap-2">
                <Share2 className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl">Contact & Share Settings</CardTitle>
            </div>
            <CardDescription>Manage your app's contact numbers and shareable link.</CardDescription>
        </CardHeader>
        <CardContent>
             <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="shareLink"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Share Link</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Share2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="https://yourapp.com" {...field} value={field.value ?? ''} className="pl-10" />
                                </div>
                            </FormControl>
                            <FormDescription>This link will be used when users click the share button.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="whatsappNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>WhatsApp Number</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="e.g., 919876543210" {...field} value={field.value ?? ''} className="pl-10" />
                                </div>
                            </FormControl>
                            <FormDescription>Number for WhatsApp support (include country code).</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="supportNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Support Call Number</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="e.g., 919876543210" {...field} value={field.value ?? ''} className="pl-10" />
                                </div>
                            </FormControl>
                            <FormDescription>Number for call support (include country code).</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                  Save Contact Settings
                </Button>
              </form>
            </Form>
        </CardContent>
      </Card>
    </div>
  );
}

    
