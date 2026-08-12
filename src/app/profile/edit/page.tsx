
'use client';

import { useUserStore } from '@/lib/store';
import { notFound, useRouter } from 'next/navigation';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Edit } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ProfileForm } from './components/profile-form';

export default function EditUserProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, updateUser } = useUserStore();

  if (!currentUser) {
    if (typeof window !== 'undefined') {
      notFound();
    }
    return null;
  }

  const handleSave = (data: Partial<User>) => {
    const updatedUser = { ...currentUser, ...data };
    
    // Ensure password is only updated if a new one is provided
    if (!data.password) {
      delete updatedUser.password;
    }

    updateUser(updatedUser);
    toast({
      title: 'Profile Updated',
      description: 'Your details have been successfully saved.',
      className: 'bg-green-600 text-white border-green-600',
    });
    router.push('/profile');
  };

  return (
    <main className="container mx-auto px-4 py-8 flex-1">
        <h1 className="text-xl font-semibold text-center mb-8">Edit Your Profile</h1>
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
                <Edit/>
                <CardTitle>Update Your Information</CardTitle>
            </div>
            <CardDescription>Change your name or update your password below.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm user={currentUser} onSave={handleSave} />
          </CardContent>
        </Card>
       </div>
    </main>
  );
}
