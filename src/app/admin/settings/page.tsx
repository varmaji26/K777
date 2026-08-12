
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
import { Settings, Text, Gift, Landmark, Clock, Banknote, AlertCircle, Youtube, Link as LinkIcon, Coins, Star, Zap } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useSettingsStore } from '@/lib/store';

const ratesSchema = z.object({
  singleDigit: z.coerce.number().min(1, 'Rate is required'),
  jodiDigit: z.coerce.number().min(1, 'Rate is required'),
  singlePana: z.coerce.number().min(1, 'Rate is required'),
  doublePana: z.coerce.number().min(1, 'Rate is required'),
  triplePana: z.coerce.number().min(1, 'Rate is required'),
  halfSangam: z.coerce.number().min(1, 'Rate is required'),
  fullSangam: z.coerce.number().min(1, 'Rate is required'),
});

const appSettingsSchema = z.object({
  marqueeText: z.string().min(1, 'Marquee text cannot be empty.'),
  headerMarqueeSpeed: z.coerce.number().min(1, 'Speed must be at least 1.'),
  headerMarqueeSize: z.coerce.number().min(8, 'Size must be at least 8.'),
  withdrawalMarqueeText: z.string().min(1, 'Withdrawal marquee text cannot be empty.'),
  withdrawalMarqueeSpeed: z.coerce.number().min(1, 'Speed must be at least 1.'),
  withdrawalMarqueeSize: z.coerce.number().min(8, 'Size must be at least 8.'),
  addFundNotice: z.string().optional(),
  withdrawalNoticeText: z.string().optional(),
  starlineRateSingleDigit: z.coerce.number().optional(),
  starlineRateSinglePana: z.coerce.number().optional(),
  starlineRateDoublePana: z.coerce.number().optional(),
  starlineRateTriplePana: z.coerce.number().optional(),
  shareLink: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
});

const transactionLimitsSchema = z.object({
    minDeposit: z.coerce.number().min(0, 'Minimum deposit must be a positive number.'),
    minWithdrawal: z.coerce.number().min(0, 'Minimum withdrawal must be a positive number.'),
    maxWithdrawal: z.coerce.number().min(0, 'Maximum withdrawal must be a positive number.'),
});

const bonusSchema = z.object({
    enabled: z.boolean(),
    amount: z.coerce.number().min(0, 'Bonus amount must be a positive number.'),
});

const autoResetSchema = z.object({
    autoResetEnabled: z.boolean(),
    autoResetTime: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'Please enter a valid HH:MM AM/PM time.'),
});

const autoResultSchema = z.object({
    autoResultEnabled: z.boolean(),
});

const marketTimeSchema = z.object({
    marketOpenTime: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'Please enter a valid HH:MM AM/PM time.'),
});

const withdrawalTimeSchema = z.object({
    withdrawalStartTime: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'Please enter a valid HH:MM AM/PM time.'),
    withdrawalEndTime: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'Please enter a valid HH:MM AM/PM time.'),
});

const upiSettingsSchema = z.object({
  appName: z.string().min(1, "App Name is required for UPI payments."),
  upiId: z.string().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, "Please enter a valid UPI ID (e.g., yourname@bank)."),
});

const videoLinksSchema = z.object({
  videoClaimBonus: z.string().url({ message: "Invalid URL" }).optional().or(z.literal('')),
  videoChangeLanguage: z.string().url({ message: "Invalid URL" }).optional().or(z.literal('')),
  videoWithdrawal: z.string().url({ message: "Invalid URL" }).optional().or(z.literal('')),
  videoDeposit: z.string().url({ message: "Invalid URL" }).optional().or(z.literal('')),
  videoHowToPlay: z.string().url({ message: "Invalid URL" }).optional().or(z.literal('')),
});

const minBidsSchema = z.object({
  minBidSingleDigit: z.coerce.number().min(1, "Minimum 1 required"),
  minBidJodiDigit: z.coerce.number().min(1, "Minimum 1 required"),
  minBidSinglePana: z.coerce.number().min(1, "Minimum 1 required"),
  minBidDoublePana: z.coerce.number().min(1, "Minimum 1 required"),
  minBidTriplePana: z.coerce.number().min(1, "Minimum 1 required"),
  minBidHalfSangam: z.coerce.number().min(1, "Minimum 1 required"),
  minBidFullSangam: z.coerce.number().min(1, "Minimum 1 required"),
  minBidSingleDigitBulk: z.coerce.number().min(1, "Minimum 1 required"),
  minBidSinglePanaBulk: z.coerce.number().min(1, "Minimum 1 required"),
  minBidDoublePanaBulk: z.coerce.number().min(1, "Minimum 1 required"),
  minBidSpDpTp: z.coerce.number().min(1, "Minimum 1 required"),
  minBidSpMotor: z.coerce.number().min(1, "Minimum 1 required"),
  minBidDpMotor: z.coerce.number().min(1, "Minimum 1 required"),
});


type RatesFormValues = z.infer<typeof ratesSchema>;
type AppSettingsFormValues = z.infer<typeof appSettingsSchema>;
type TransactionLimitsFormValues = z.infer<typeof transactionLimitsSchema>;
type BonusFormValues = z.infer<typeof bonusSchema>;
type AutoResetFormValues = z.infer<typeof autoResetSchema>;
type AutoResultFormValues = z.infer<typeof autoResultSchema>;
type MarketTimeFormValues = z.infer<typeof marketTimeSchema>;
type WithdrawalTimeFormValues = z.infer<typeof withdrawalTimeSchema>;
type UpiSettingsFormValues = z.infer<typeof upiSettingsSchema>;
type VideoLinksFormValues = z.infer<typeof videoLinksSchema>;
type MinBidsFormValues = z.infer<typeof minBidsSchema>;


export default function GameSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const { appSettings } = useSettingsStore();

  const ratesForm = useForm<RatesFormValues>({
    resolver: zodResolver(ratesSchema),
    defaultValues: {
      singleDigit: 10,
      jodiDigit: 100,
      singlePana: 150,
      doublePana: 300,
      triplePana: 600,
      halfSangam: 1000,
      fullSangam: 10000,
    },
  });

  const appSettingsForm = useForm<AppSettingsFormValues>({
    resolver: zodResolver(appSettingsSchema),
    defaultValues: {
      marqueeText: '',
      headerMarqueeSpeed: 15,
      headerMarqueeSize: 14,
      withdrawalMarqueeText: '',
      withdrawalMarqueeSpeed: 15,
      withdrawalMarqueeSize: 14,
      addFundNotice: '',
      withdrawalNoticeText: '',
      starlineRateSingleDigit: 100,
      starlineRateSinglePana: 1500,
      starlineRateDoublePana: 3000,
      starlineRateTriplePana: 7000,
      shareLink: '',
    },
  });
  
  const transactionLimitsForm = useForm<TransactionLimitsFormValues>({
    resolver: zodResolver(transactionLimitsSchema),
    defaultValues: {
      minDeposit: 500,
      minWithdrawal: 1000,
      maxWithdrawal: 50000,
    },
  });

  const bonusForm = useForm<BonusFormValues>({
    resolver: zodResolver(bonusSchema),
    defaultValues: {
      enabled: false,
      amount: 100,
    },
  });

  const autoResetForm = useForm<AutoResetFormValues>({
      resolver: zodResolver(autoResetSchema),
      defaultValues: {
          autoResetEnabled: false,
          autoResetTime: '12:00 AM',
      },
  });

  const autoResultForm = useForm<AutoResultFormValues>({
      resolver: zodResolver(autoResultSchema),
      defaultValues: {
          autoResultEnabled: false,
      },
  });
  
  const marketTimeForm = useForm<MarketTimeFormValues>({
      resolver: zodResolver(marketTimeSchema),
      defaultValues: {
          marketOpenTime: '12:00 AM',
      },
  });

  const withdrawalTimeForm = useForm<WithdrawalTimeFormValues>({
      resolver: zodResolver(withdrawalTimeSchema),
      defaultValues: {
          withdrawalStartTime: '10:00 AM',
          withdrawalEndTime: '10:00 PM',
      },
  });

  const upiSettingsForm = useForm<UpiSettingsFormValues>({
    resolver: zodResolver(upiSettingsSchema),
    defaultValues: {
        appName: '',
        upiId: '',
    },
  });

  const videoLinksForm = useForm<VideoLinksFormValues>({
    resolver: zodResolver(videoLinksSchema),
    defaultValues: {
      videoClaimBonus: '',
      videoChangeLanguage: '',
      videoWithdrawal: '',
      videoDeposit: '',
      videoHowToPlay: '',
    },
  });

  const minBidsForm = useForm<MinBidsFormValues>({
    resolver: zodResolver(minBidsSchema),
    defaultValues: {
      minBidSingleDigit: 10,
      minBidJodiDigit: 10,
      minBidSinglePana: 10,
      minBidDoublePana: 10,
      minBidTriplePana: 10,
      minBidHalfSangam: 10,
      minBidFullSangam: 10,
      minBidSingleDigitBulk: 10,
      minBidSinglePanaBulk: 10,
      minBidDoublePanaBulk: 10,
      minBidSpDpTp: 10,
      minBidSpMotor: 10,
      minBidDpMotor: 10,
    },
  });

  useEffect(() => {
    const fetchOtherSettings = async () => {
      setLoading(true);
      try {
        const ratesDocRef = doc(db, 'settings', 'gameRates');
        const bonusDocRef = doc(db, 'settings', 'bonus');
        
        const [ratesDocSnap, bonusDocSnap] = await Promise.all([
          getDoc(ratesDocRef),
          getDoc(bonusDocRef),
        ]);

        if (ratesDocSnap.exists()) {
          ratesForm.reset(ratesDocSnap.data());
        }
        if (bonusDocSnap.exists()) {
          bonusForm.reset(bonusDocSnap.data());
        }

      } catch (error: any) {
        if (!error.message?.includes('offline')) {
            console.error("Error fetching other settings: ", error);
            toast({ variant: 'destructive', title: 'Connection Issue', description: 'Working in offline mode. Please refresh when back online.' });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchOtherSettings();
  }, [ratesForm, bonusForm, toast]);

  useEffect(() => {
    if (appSettings) {
        appSettingsForm.reset({
            marqueeText: appSettings.marqueeText || '',
            headerMarqueeSpeed: appSettings.headerMarqueeSpeed || 15,
            headerMarqueeSize: appSettings.headerMarqueeSize || 14,
            withdrawalMarqueeText: appSettings.withdrawalMarqueeText || '',
            withdrawalMarqueeSpeed: appSettings.withdrawalMarqueeSpeed || 15,
            withdrawalMarqueeSize: appSettings.withdrawalMarqueeSize || 14,
            addFundNotice: appSettings.addFundNotice || '',
            withdrawalNoticeText: appSettings.withdrawalNoticeText || '',
            starlineRateSingleDigit: appSettings.starlineRateSingleDigit || 100,
            starlineRateSinglePana: appSettings.starlineRateSinglePana || 1500,
            starlineRateDoublePana: appSettings.starlineRateDoublePana || 3000,
            starlineRateTriplePana: appSettings.starlineRateTriplePana || 7000,
            shareLink: appSettings.shareLink || '',
        });
        transactionLimitsForm.reset({
            minDeposit: appSettings.minDeposit || 500,
            minWithdrawal: appSettings.minWithdrawal || 1000,
            maxWithdrawal: appSettings.maxWithdrawal || 50000,
        });
        autoResetForm.reset({
            autoResetEnabled: appSettings.autoResetEnabled || false,
            autoResetTime: appSettings.autoResetTime || '12:00 AM',
        });
        autoResultForm.reset({
            autoResultEnabled: appSettings.autoResultEnabled || false,
        });
        marketTimeForm.reset({
            marketOpenTime: appSettings.marketOpenTime || '12:00 AM',
        });
        withdrawalTimeForm.reset({
            withdrawalStartTime: appSettings.withdrawalStartTime || '10:00 AM',
            withdrawalEndTime: appSettings.withdrawalEndTime || '10:00 PM',
        });
        upiSettingsForm.reset({
            appName: appSettings.appName || '',
            upiId: appSettings.upiId || '',
        });
        videoLinksForm.reset({
          videoClaimBonus: appSettings.videoClaimBonus || '',
          videoChangeLanguage: appSettings.videoChangeLanguage || '',
          videoWithdrawal: appSettings.videoWithdrawal || '',
          videoDeposit: appSettings.videoDeposit || '',
          videoHowToPlay: appSettings.videoHowToPlay || '',
        });
        minBidsForm.reset({
          minBidSingleDigit: appSettings.minBidSingleDigit || 10,
          minBidJodiDigit: appSettings.minBidJodiDigit || 10,
          minBidSinglePana: appSettings.minBidSinglePana || 10,
          minBidDoublePana: appSettings.minBidDoublePana || 10,
          minBidTriplePana: appSettings.minBidTriplePana || 10,
          minBidHalfSangam: appSettings.minBidHalfSangam || 10,
          minBidFullSangam: appSettings.minBidFullSangam || 10,
          minBidSingleDigitBulk: appSettings.minBidSingleDigitBulk || 10,
          minBidSinglePanaBulk: appSettings.minBidSinglePanaBulk || 10,
          minBidDoublePanaBulk: appSettings.minBidDoublePanaBulk || 10,
          minBidSpDpTp: appSettings.minBidSpDpTp || 10,
          minBidSpMotor: appSettings.minBidSpMotor || 10,
          minBidDpMotor: appSettings.minBidDpMotor || 10,
        });
    }
  }, [appSettings, appSettingsForm, transactionLimitsForm, autoResetForm, autoResultForm, marketTimeForm, withdrawalTimeForm, upiSettingsForm, videoLinksForm, minBidsForm]);

  const onRatesSubmit = async (values: RatesFormValues) => {
    try {
      const ratesDocRef = doc(db, 'settings', 'gameRates');
      await setDoc(ratesDocRef, values, { merge: true });
      toast({
        title: 'Rates Updated!',
        description: 'The game winning rates have been saved successfully.',
        className: 'bg-green-600 text-white'
      });
    } catch (error) {
      console.error("Error updating rates: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save the new rates.' });
    }
  };

  const onAppSettingsSubmit = async (values: AppSettingsFormValues) => {
    try {
      const appSettingsDocRef = doc(db, 'settings', 'app-settings');
      await setDoc(appSettingsDocRef, values, { merge: true });
      toast({
        title: 'App Settings Updated!',
        description: 'The application settings have been saved.',
        className: 'bg-green-600 text-white'
      });
    } catch (error) {
      console.error("Error updating app settings: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save app settings.' });
    }
  };

  const onTransactionLimitsSubmit = async (values: TransactionLimitsFormValues) => {
    try {
      const appSettingsDocRef = doc(db, 'settings', 'app-settings');
      await setDoc(appSettingsDocRef, values, { merge: true });
      toast({
        title: 'Transaction Limits Updated!',
        description: 'The minimum deposit and withdrawal limits have been saved.',
        className: 'bg-green-600 text-white'
      });
    } catch (error) {
      console.error("Error updating transaction limits: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save transaction limits.' });
    }
  };
  
  const onBonusSubmit = async (values: BonusFormValues) => {
        try {
            const bonusDocRef = doc(db, 'settings', 'bonus');
            await setDoc(bonusDocRef, values, { merge: true });
            toast({
                title: 'Bonus Settings Updated!',
                description: 'The welcome bonus settings have been saved.',
                className: 'bg-green-600 text-white'
            });
        } catch (error) {
            console.error("Error updating bonus settings: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save bonus settings.' });
        }
    };
    
  const onAutoResetSubmit = async (values: AutoResetFormValues) => {
    try {
        const appSettingsDocRef = doc(db, 'settings', 'app-settings');
        await setDoc(appSettingsDocRef, values, { merge: true });
        toast({
            title: 'Auto Reset Settings Updated!',
            description: 'The daily automatic reset settings have been saved.',
            className: 'bg-green-600 text-white'
        });
    } catch (error) {
        console.error("Error updating auto reset settings: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save auto reset settings.' });
    }
  };

  const onAutoResultSubmit = async (values: AutoResultFormValues) => {
    try {
        const appSettingsDocRef = doc(db, 'settings', 'app-settings');
        await setDoc(appSettingsDocRef, values, { merge: true });
        toast({
            title: 'Auto Result Settings Updated!',
            description: `Automatic result generation is now ${values.autoResultEnabled ? 'ENABLED' : 'DISABLED'}.`,
            className: 'bg-green-600 text-white'
        });
    } catch (error) {
        console.error("Error updating auto result settings: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save auto result settings.' });
    }
  };

  const onMarketTimeSubmit = async (values: MarketTimeFormValues) => {
    try {
        const appSettingsDocRef = doc(db, 'settings', 'app-settings');
        await setDoc(appSettingsDocRef, values, { merge: true });
        toast({
            title: 'Market Time Updated!',
            description: 'The market open time has been saved.',
            className: 'bg-green-600 text-white'
        });
    } catch (error) {
        console.error("Error updating market time settings: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save market open time.' });
    }
  };

  const onWithdrawalTimeSubmit = async (values: WithdrawalTimeFormValues) => {
    try {
        const appSettingsDocRef = doc(db, 'settings', 'app-settings');
        await setDoc(appSettingsDocRef, values, { merge: true });
        toast({
            title: 'Withdrawal Time Updated!',
            description: 'The withdrawal time window has been saved.',
            className: 'bg-green-600 text-white'
        });
    } catch (error) {
        console.error("Error updating withdrawal time settings: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save withdrawal time.' });
    }
  };

  const onUpiSettingsSubmit = async (values: UpiSettingsFormValues) => {
    try {
        const appSettingsDocRef = doc(db, 'settings', 'app-settings');
        await setDoc(appSettingsDocRef, values, { merge: true });
        toast({
            title: 'UPI Settings Updated!',
            description: 'The UPI settings have been saved.',
            className: 'bg-green-600 text-white'
        });
    } catch (error) {
        console.error("Error updating UPI settings: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save UPI settings.' });
    }
  };

  const onVideoLinksSubmit = async (values: VideoLinksFormValues) => {
    try {
      const appSettingsDocRef = doc(db, 'settings', 'app-settings');
      await setDoc(appSettingsDocRef, values, { merge: true });
      toast({
        title: 'Video Links Updated!',
        description: 'The YouTube video links have been saved.',
        className: 'bg-green-600 text-white'
      });
    } catch (error) {
      console.error("Error updating video links: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save video links.' });
    }
  };

  const onMinBidsSubmit = async (values: MinBidsFormValues) => {
    try {
      const appSettingsDocRef = doc(db, 'settings', 'app-settings');
      await setDoc(appSettingsDocRef, values, { merge: true });
      toast({
        title: 'Min Bid Limits Updated!',
        description: 'Dynamic minimum bid amounts have been saved.',
        className: 'bg-green-600 text-white'
      });
    } catch (error) {
      console.error("Error updating min bid limits: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save min bid limits.' });
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
      <Accordion type="single" collapsible className="w-full max-w-2xl mx-auto space-y-4">
        
        <AccordionItem value="item-upi" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Banknote className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">UPI Payment QR Settings</CardTitle>
                </div>
                <CardDescription>Configure your UPI details for instant QR payments.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...upiSettingsForm}>
                    <form onSubmit={upiSettingsForm.handleSubmit(onUpiSettingsSubmit)} className="space-y-6">
                        <FormField
                            control={upiSettingsForm.control}
                            name="appName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>App/Payee Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Example: Matka King App" {...field} />
                                    </FormControl>
                                    <FormDescription>This name will be shown in the QR code details.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={upiSettingsForm.control}
                            name="upiId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Your UPI ID</FormLabel>
                                    <FormControl>
                                        <Input placeholder="example@upi" {...field} />
                                    </FormControl>
                                    <FormDescription>The UPI ID where funds will be received.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={upiSettingsForm.formState.isSubmitting}>
                            {upiSettingsForm.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            Save UPI Settings
                        </Button>
                    </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-starline" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Star className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">Starline Game Settings</CardTitle>
                </div>
                <CardDescription>Manage rates for Starline hourly games.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...appSettingsForm}>
                  <form onSubmit={appSettingsForm.handleSubmit(onAppSettingsSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={appSettingsForm.control}
                        name="starlineRateSingleDigit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Single Digit Rate (₹10 - ₹X)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={appSettingsForm.control}
                        name="starlineRateSinglePana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Single Pana Rate (₹10 - ₹X)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={appSettingsForm.control}
                        name="starlineRateDoublePana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Double Pana Rate (₹10 - ₹X)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={appSettingsForm.control}
                        name="starlineRateTriplePana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Triple Pana Rate (₹10 - ₹X)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button type="submit" className="w-full">Save Starline Rates</Button>
                  </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-auto-result" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Zap className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">Auto Result Settings</CardTitle>
                </div>
                <CardDescription>Automatically publish results 5 mins after slot time.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...autoResultForm}>
                  <form onSubmit={autoResultForm.handleSubmit(onAutoResultSubmit)} className="space-y-6">
                    <FormField
                      control={autoResultForm.control}
                      name="autoResultEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Enable Auto Result
                            </FormLabel>
                            <FormDescription>
                              Pick number with least load for Starline and Jackpot automatically.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={autoResultForm.formState.isSubmitting}>
                      {autoResultForm.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                      Save Auto Result Settings
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-min-bids" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Coins className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">Minimum Bid Settings</CardTitle>
                </div>
                <CardDescription>Set the minimum amount allowed for each bet type.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...minBidsForm}>
                  <form onSubmit={minBidsForm.handleSubmit(onMinBidsSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={minBidsForm.control}
                        name="minBidSingleDigit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Single Digit Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidJodiDigit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jodi Digit Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidSinglePana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Single Pana Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidDoublePana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Double Pana Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidTriplePana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Triple Pana Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidHalfSangam"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Half Sangam Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidFullSangam"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Sangam Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidSingleDigitBulk"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Single Digit Bulk Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidSinglePanaBulk"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Single Pana Bulk Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidDoublePanaBulk"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Double Pana Bulk Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidSpDpTp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SP DP TP Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidSpMotor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SP Motor Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={minBidsForm.control}
                        name="minBidDpMotor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>DP Motor Min</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={minBidsForm.formState.isSubmitting}>
                      {minBidsForm.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                      Save Bid Limits
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-1" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Settings className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">Game Rate Settings</CardTitle>
                </div>
                <CardDescription>Update the winning rates for various bet types.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...ratesForm}>
                  <form onSubmit={ratesForm.handleSubmit(onRatesSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={ratesForm.control}
                        name="singleDigit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Single Digit Rate (x)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={ratesForm.control}
                        name="jodiDigit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jodi Digit Rate (x)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={ratesForm.control}
                        name="singlePana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Single Pana Rate (x)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={ratesForm.control}
                        name="doublePana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Double Pana Rate (x)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={ratesForm.control}
                        name="triplePana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Triple Pana Rate (x)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={ratesForm.control}
                        name="halfSangam"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Half Sangam Rate (x)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={ratesForm.control}
                        name="fullSangam"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Sangam Rate (x)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={ratesForm.formState.isSubmitting}>
                      {ratesForm.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                      Save Rates
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-2" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Text className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">App Settings</CardTitle>
                </div>
                <CardDescription>Manage general application settings.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...appSettingsForm}>
                  <form onSubmit={appSettingsForm.handleSubmit(onAppSettingsSubmit)} className="space-y-6">
                    <FormField
                      control={appSettingsForm.control}
                      name="marqueeText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Header Marquee Text</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter the text to scroll in the header" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={appSettingsForm.control}
                          name="headerMarqueeSpeed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Header Speed</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 15" {...field} />
                              </FormControl>
                               <FormDescription className="text-xs">Duration in seconds. Higher is slower.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={appSettingsForm.control}
                          name="headerMarqueeSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Header Font Size</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 14" {...field} />
                              </FormControl>
                               <FormDescription className="text-xs">Size in pixels.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                     </div>
                    <FormField
                      control={appSettingsForm.control}
                      name="withdrawalMarqueeText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Withdrawal Page Marquee</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter text for withdrawal page marquee" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={appSettingsForm.control}
                          name="withdrawalMarqueeSpeed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Withdrawal Speed</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 15" {...field} />
                              </FormControl>
                              <FormDescription className="text-xs">Duration in seconds. Higher is slower.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={appSettingsForm.control}
                          name="withdrawalMarqueeSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Withdrawal Font Size</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 14" {...field} />
                              </FormControl>
                              <FormDescription className="text-xs">Size in pixels.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                     </div>
                     <FormField
                      control={appSettingsForm.control}
                      name="withdrawalNoticeText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Withdrawal Page Notice</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter text for withdrawal page notice box" {...field} className="min-h-[100px]" />
                          </FormControl>
                          <FormDescription className="text-xs text-muted-foreground">This notice will be displayed on the Withdraw page above the bank selection.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={appSettingsForm.control}
                      name="addFundNotice"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            <FormLabel>Add Fund Notice</FormLabel>
                          </div>
                          <FormControl>
                            <Textarea placeholder="Enter notice for Add Funds page" {...field} className="min-h-[100px]" />
                          </FormControl>
                          <FormDescription className="text-xs text-muted-foreground">This notice will be displayed on the Add Funds page above the amount input.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={appSettingsForm.control}
                      name="shareLink"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>App Share Link</FormLabel>
                          <FormControl>
                            <div className="relative">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="https://yourapp.com" {...field} value={field.value ?? ''} className="pl-10" />
                            </div>
                          </FormControl>
                          <FormDescription>Link used when users share the app via menu.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={appSettingsForm.formState.isSubmitting}>
                      {appSettingsForm.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                      Save App Settings
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-videolinks" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Youtube className="h-6 w-6 text-red-600" />
                  <CardTitle className="text-2xl">How To Play Video Links</CardTitle>
                </div>
                <CardDescription>Manage YouTube links for the "How To Play" page.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...videoLinksForm}>
                  <form onSubmit={videoLinksForm.handleSubmit(onVideoLinksSubmit)} className="space-y-6">
                    <FormField
                      control={videoLinksForm.control}
                      name="videoClaimBonus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>How to Claim Bonus (Youtube URL)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={videoLinksForm.control}
                      name="videoChangeLanguage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>How to Change Language (Youtube URL)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={videoLinksForm.control}
                      name="videoWithdrawal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>How to Withdrawal (Youtube URL)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={videoLinksForm.control}
                      name="videoDeposit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>How to Deposit (Youtube URL)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={videoLinksForm.control}
                      name="videoHowToPlay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>How to Play (Youtube URL)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={videoLinksForm.formState.isSubmitting}>
                      {videoLinksForm.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                      Save Video Links
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-3" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Landmark className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">Transaction Limits</CardTitle>
                </div>
                <CardDescription>Set min/max for deposits and withdrawals.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...transactionLimitsForm}>
                    <form onSubmit={transactionLimitsForm.handleSubmit(onTransactionLimitsSubmit)} className="space-y-6">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={transactionLimitsForm.control}
                              name="minDeposit"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Minimum Deposit</FormLabel>
                                  <FormControl>
                                    <Input type="number" placeholder="e.g., 500" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={transactionLimitsForm.control}
                              name="minWithdrawal"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Minimum Withdrawal</FormLabel>
                                  <FormControl>
                                    <Input type="number" placeholder="e.g., 1000" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={transactionLimitsForm.control}
                              name="maxWithdrawal"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Maximum Withdrawal</FormLabel>
                                  <FormControl>
                                    <Input type="number" placeholder="e.g., 50000" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                         </div>
                        <Button type="submit" className="w-full" disabled={transactionLimitsForm.formState.isSubmitting}>
                            {transactionLimitsForm.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            Save Transaction Limits
                        </Button>
                    </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-4" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Gift className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">Bonus Settings</CardTitle>
                </div>
                <CardDescription>Manage welcome bonus for new users.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...bonusForm}>
                  <form onSubmit={bonusForm.handleSubmit(onBonusSubmit)} className="space-y-6">
                    <FormField
                      control={bonusForm.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Enable Welcome Bonus
                            </FormLabel>
                            <FormDescription>
                              Give a bonus to all new users upon registration.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                     <FormField
                        control={bonusForm.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bonus Amount</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                             <FormDescription>
                              The amount of bonus points to give to a new user.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    <Button type="submit" className="w-full" disabled={bonusForm.formState.isSubmitting}>
                      {bonusForm.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                      Save Bonus Settings
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
        
        <AccordionItem value="item-6" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Clock className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">Market Time Settings</CardTitle>
                </div>
                <CardDescription>Set the global open time for all markets.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...marketTimeForm}>
                    <form onSubmit={marketTimeForm.handleSubmit(onMarketTimeSubmit)} className="space-y-6">
                        <FormField
                            control={marketTimeForm.control}
                            name="marketOpenTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Market Open Time</FormLabel>
                                    <FormControl>
                                        <Input type="text" placeholder="e.g., 01:00 AM" {...field} />
                                    </FormControl>
                                    <FormDescription>The time (in HH:MM AM/PM format) at which all games become available for betting.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={marketTimeForm.formState.isSubmitting}>
                            {marketTimeForm.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            Save Market Time
                        </Button>
                    </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-withdrawal-time" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Clock className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">Withdrawal Time Settings</CardTitle>
                </div>
                <CardDescription>Set the window when users can request withdrawals.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...withdrawalTimeForm}>
                    <form onSubmit={withdrawalTimeForm.handleSubmit(onWithdrawalTimeSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                                control={withdrawalTimeForm.control}
                                name="withdrawalStartTime"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Start Time</FormLabel>
                                        <FormControl>
                                            <Input type="text" placeholder="e.g., 10:00 AM" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={withdrawalTimeForm.control}
                                name="withdrawalEndTime"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>End Time</FormLabel>
                                        <FormControl>
                                            <Input type="text" placeholder="e.g., 10:00 PM" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormDescription className="text-xs">Users will only be able to click &quot;Process Withdrawal&quot; within this time range.</FormDescription>
                        <Button type="submit" className="w-full" disabled={withdrawalTimeForm.formState.isSubmitting}>
                            {withdrawalTimeForm.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            Save Withdrawal Time
                        </Button>
                    </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        <AccordionItem value="item-5" className="border-none">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-left">
                <div className="flex items-center gap-2">
                  <Clock className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">Automatic Daily Reset</CardTitle>
                </div>
                <CardDescription>Set a time to automatically reset game results every day.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent>
                <Form {...autoResetForm}>
                    <form onSubmit={autoResetForm.handleSubmit(onAutoResetSubmit)} className="space-y-6">
                        <FormField
                            control={autoResetForm.control}
                            name="autoResetEnabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enable Auto Reset</FormLabel>
                                        <FormDescription>Automatically reset all game results at a specific time daily.</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={autoResetForm.control}
                            name="autoResetTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reset Time</FormLabel>
                                    <FormControl>
                                        <Input type="text" placeholder="e.g., 11:59 PM" {...field} />
                                    </FormControl>
                                    <FormDescription>The time (in HH:MM AM/PM format) at which the results will be reset.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={autoResetForm.formState.isSubmitting}>
                            {autoResetForm.formState.isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            Save Auto Reset Settings
                        </Button>
                    </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

      </Accordion>
    </div>
  );
}
