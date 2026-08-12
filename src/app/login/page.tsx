
'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUserStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

const formSchema = z.object({
  mobile: z.string().length(10, 'Please enter a valid 10-digit mobile number.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type FormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { login } = useUserStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mobile: '',
      password: '',
    },
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setIsSubmitting(true);
    
    try {
      const user = await login(data.mobile, data.password);
      if (user) {
        toast({
          title: 'Login Successful',
          description: `Welcome back, ${user.name}!`,
          className: 'bg-gradient-to-b from-green-500 to-green-700 text-white border-none shadow-lg',
        });
        if (user.isAdmin) {
          router.replace('/admin');
        } else {
          router.replace('/home');
        }
      } else {
        toast({
          title: 'Login Failed',
          description: 'Invalid mobile number or password. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error("Login Error:", error);
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to the server. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-header p-4 overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      <Card className="w-full max-w-sm rounded-3xl shadow-2xl border-none overflow-hidden z-10 animate-in fade-in zoom-in duration-500 slide-in-from-bottom-12">
        <CardHeader className="text-center space-y-2 p-8 bg-gradient-to-br from-orange-400 to-orange-600 text-white relative">
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-2 backdrop-blur-sm animate-bounce duration-[2000ms]">
            <LockKeyhole className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome Back</CardTitle>
          <CardDescription className="text-orange-50/80 font-medium">Enter your credentials to continue</CardDescription>
          
          {/* Subtle Decorative Wave */}
          <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10"></div>
        </CardHeader>
        
        <CardContent className="p-6 pt-8 bg-white dark:bg-slate-900">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-700 delay-200">
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-gray-500 uppercase ml-1">Mobile Number</FormLabel>
                      <FormControl>
                        <Input 
                          type="tel" 
                          placeholder="" 
                          {...field}
                          onInput={(e) => {
                              const target = e.target as HTMLInputElement;
                              target.value = target.value.replace(/\D/g, '').slice(0, 10);
                              field.onChange(target.value);
                          }}
                          disabled={isSubmitting} 
                          className="bg-gray-50 border-gray-100 h-12 rounded-xl focus-visible:ring-orange-500 transition-all text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-gray-500 uppercase ml-1">Password</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            type={showPassword ? 'text' : 'password'} 
                            placeholder="" 
                            {...field} 
                            disabled={isSubmitting} 
                            className="bg-gray-50 border-gray-100 h-12 rounded-xl focus-visible:ring-orange-500 transition-all text-base"
                          />
                        </FormControl>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 hover:text-orange-500 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl shadow-lg shadow-orange-200 transition-all active:scale-95 animate-in slide-in-from-bottom-4 duration-700 delay-300" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Logging in...
                  </div>
                ) : 'Login'}
              </Button>
            </form>
          </Form>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4 justify-center pb-8 bg-white dark:bg-slate-900 animate-in slide-in-from-bottom-4 duration-700 delay-400">
            <div className="w-full h-px bg-gray-100"></div>
            <p className="text-sm text-gray-500">
                Don't have an account?{' '}
                <Link href="/signup" replace className="font-bold text-orange-500 hover:text-orange-600 transition-colors">
                    Sign up for free
                </Link>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
