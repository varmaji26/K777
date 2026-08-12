'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from '@/components/loader';
import { useToast } from '@/hooks/use-toast';
import { Send, Trash2, Bell } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: Timestamp;
}

export default function SendNotificationPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast({ title: 'Error', description: 'Please fill in both title and message.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        title: title.trim(),
        body: body.trim(),
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Success', description: 'Notification sent to all users.', className: 'bg-green-600 text-white' });
      setTitle('');
      setBody('');
    } catch (error) {
      console.error("Error sending notification:", error);
      toast({ title: 'Error', description: 'Failed to send notification.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast({ title: 'Deleted', description: 'Notification removed from history.' });
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast({ title: 'Error', description: 'Failed to delete notification.', variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Send Broadcast Notification</CardTitle>
          </div>
          <CardDescription>This message will be sent to all users and will appear in their notification bell.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Notification Title</label>
              <Input 
                placeholder="e.g. Results are out!" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message Body</label>
              <Textarea 
                placeholder="Type your message here..." 
                value={body} 
                onChange={(e) => setBody(e.target.value)} 
                disabled={isSubmitting}
                className="min-h-[100px]"
              />
            </div>
            <Button type="submit" className="w-full h-12 bg-primary" disabled={isSubmitting}>
              {isSubmitting ? <Loader className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
              Send Notification
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Notification History</CardTitle>
          <CardDescription>Recently sent notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-medium">{n.title}</TableCell>
                        <TableCell className="max-w-xs truncate">{n.body}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(n.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No notifications sent yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
