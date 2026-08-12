'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose, SheetDescription } from '@/components/ui/sheet';
import { Home, Menu, Trophy, User, LogOut, LayoutDashboard, Star, History, PlayCircle, Bell, HelpCircle, FileText, Languages, ChevronRight, Lock, Share2, Shield, BarChart2, Clock, Tag } from 'lucide-react';
import { useState, useEffect, CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserStore, useSettingsStore } from '@/lib/store';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { doc, onSnapshot, DocumentData, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { NotificationBell } from '@/components/notification-bell';

// Custom Wallet Icon Component
const CustomWalletIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg">
    <path style={{ fill: '#A35425' }} d="M480,143.996h-96v368h96c17.672,0,32-14.328,32-32v-304C512,158.324,497.672,143.996,480,143.996z" />
    <circle style={{ fill: '#F19920' }} cx="176" cy="144.004" r="64" />
    <path style={{ fill: '#F19920' }} d="M209.92,177.916c18.752-18.736,18.776-49.128,0.04-67.88c-0.016-0.016-0.024-0.024-0.04-0.04 L142,177.916c18.736,18.752,49.128,18.776,67.88,0.04C209.896,177.94,209.904,177.924,209.92,177.916z" />
    <path style={{ fill: '#F6B545' }} d="M142.08,110.076c-18.752,18.736-18.776,49.128-0.04,67.88c0.016,0.016,0.024,0.024,0.04,0.04 l67.92-67.92c-18.736-18.752-49.128-18.776-67.88-0.04C142.104,110.052,142.096,110.06,142.08,110.076z" />
    <circle style={{ fill: '#F19920' }} cx="320" cy="64.004" r="64" />
    <path style={{ fill: '#89C763' }} d="M472,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C496,170.74,485.256,159.996,472,159.996z" />
    <path style={{ fill: '#3CB54A' }} d="M456,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C480,170.74,469.256,159.996,456,159.996z" />
    <path style={{ fill: '#89C763' }} d="M440,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C464,170.74,453.256,159.996,440,159.996z" />
    <path style={{ fill: '#3CB54A' }} d="M424,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C448,170.74,437.256,159.996,424,159.996z" />
    <path style={{ fill: '#C97629' }} d="M32,143.996h352c17.672,0,32,14.328,32,32v304c0,17.672-14.328,32-32,32H32 c-17.672,0-32-14.328-32-32v-304C0,158.324,14.328,143.996,32,143.996z" />
    <path style={{ fill: '#89C763' }} d="M411.76,159.996c2.816,4.864,4.28,10.384,4.24,16v304c0.04,5.616-1.424,11.136-4.24,16 c11.768-1.864,20.384-12.088,20.24-24v-288C432.144,172.076,423.528,161.86,411.76,159.996z" />
    <rect x="416" y="271.996" style={{ fill: '#D5E3EF' }} width="96" height="112" />
    <path style={{ fill: '#ECF0F9' }} d="M320,271.996c-30.928,0-56,25.072-56,56s25.072,56,56,56h96v-112H320z" />
    <circle style={{ fill: '#7F4122' }} cx="320" cy="327.996" r="24" />
    <rect x="496" y="383.996" style={{ fill: '#7F4122' }} width="16" height="16" />
    <rect x="480" y="383.996" style={{ fill: '#3CB54A' }} width="16" height="16" />
    <rect x="448" y="383.996" style={{ fill: '#3CB54A' }} width="16" height="16" />
    <rect x="416" y="383.996" style={{ fill: '#3CB54A' }} width="16" height="16" />
    <rect x="464" y="383.996" style={{ fill: '#0E9347' }} width="16" height="16" />
    <rect x="432" y="383.996" style={{ fill: '#0E9347' }} width="16" height="16" />
    <path style={{ fill: '#B06328' }} d="M320,383.996c-27.816-0.032-51.384-20.472-55.36-48c-4.416,30.608,16.816,59.008,47.424,63.424 c2.624,0.376,5.28,0.568,7.936,0.576h80v80c0,8.84-7.16,16-16,16H48c-8.84,0-16,7.16-16,16h352c17.672,0,32-14.328,32-32v-96H320z" />
    <path style={{ fill: '#D5E3EF' }} d="M336,367.996h80l0,0v16l0,0h-96l0,0l0,0C320,375.156,327.16,367.996,336,367.996z" />
    <path style={{ fill: '#B0C4D9' }} d="M496,287.996v80h-80v16h96v-112l0,0C503.16,271.996,496,279.156,496,287.996z" />
    <path style={{ fill: '#F19920' }} d="M353.92,97.916c18.752-18.736,18.776-49.128,0.04-67.88c-0.016-0.016-0.024-0.024-0.04-0.04 L286,97.916c18.736,18.752,49.128,18.776,67.88,0.04C353.896,97.94,353.904,97.924,353.92,97.916z" />
    <path style={{ fill: '#F6B545' }} d="M286.08,30.076c-18.752,18.736-18.776,49.128-0.04,67.88c0.016,0.016,0.024,0.024,0.04,0.04 L354,30.076c-18.736-18.752-49.128-18.776-67.88-0.04C286.104,30.052,286.096,30.06,286.08,30.076z" />
  </svg>
);

const navLinks = [
  { href: '/profile', label: 'My Profile', icon: User },
  { href: '/time-table', label: 'Time Table', icon: Clock },
  { href: '/game-rates', label: 'Game Rates', icon: BarChart2 },
  { href: '/how-to-play', label: 'How To Play', icon: PlayCircle },
  { href: '/win-history', label: 'Win History', icon: Trophy },
  { href: '#', label: 'Notification', icon: Bell },
  { href: '/rules', label: 'Notice Board/Rules', icon: FileText },
  { href: '/change-language', label: 'Change Language', icon: Languages },
  { href: '/profile/edit', label: 'Change Password', icon: Lock },
  { href: '#', label: 'Share', icon: Share2, isShare: true },
];


function getInitials(name: string) {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

export function Header() {
  const [isSheetOpen, setSheetOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, logout } = useUserStore();
  const { appSettings } = useSettingsStore();

  const handleLogout = () => {
    logout();
    router.push('/');
  };
  
  const handleShare = async () => {
    const shareData = {
        title: 'Check out this awesome app!',
        text: 'Join me on this amazing app!',
        url: appSettings.shareLink || window.location.origin,
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (error) {
            console.warn('Web Share API failed or was cancelled:', error);
        }
    } else {
        try {
            await navigator.clipboard.writeText(shareData.url);
            toast({
                title: "Sharing not supported",
                description: "Link copied to clipboard instead.",
            });
        } catch (copyError) {
            toast({
                title: "Action Failed",
                description: "Could not share or copy the link.",
                variant: "destructive",
            });
        }
    }
    setSheetOpen(false);
};


  if (!currentUser) {
      return null;
  }
  
  const marqueeStyle: CSSProperties = {
    '--marquee-duration': `${appSettings.headerMarqueeSpeed || 15}s`,
    fontSize: `${appSettings.headerMarqueeSize || 14}px`,
  } as CSSProperties;
  
  const totalBalance = (currentUser?.balance || 0) + (currentUser?.bonusBalance || 0);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-header text-foreground">
      <div className="px-4 flex h-14 items-center justify-between">
        <div className="flex items-center gap-2">
          <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/10">
                <Menu className="h-8 w-8" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-white text-gray-800 p-0 w-4/5">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menu</SheetTitle>
                <SheetDescription>Main application navigation menu.</SheetDescription>
              </SheetHeader>

              <div className="flex flex-col h-full">
                {/* Profile Section */}
                <div className="p-4 bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-white rounded-b-2xl shadow-lg">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-14 w-14 border-2 border-white bg-transparent overflow-hidden">
                            <svg 
                                viewBox="0 0 508 508" 
                                className="h-full w-full"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <g>
                                    <circle style={{ fill: '#ff370a' }} cx="254" cy="254" r="254"></circle>
                                    <g>
                                        <path style={{ fill: '#02587e' }} d="M255.2,362.8c-0.4,0-0.8,0.4-1.2,0.4c-0.4,0-0.8-0.4-1.2-0.4H255.2z"></path>
                                        <path style={{ fill: '#02587e' }} d="M451.2,414c-46.4,57.2-117.6,94-197.2,94s-150.8-36.8-197.2-94c33.2-44.4,84-66.4,125.6-77.2 c-3.2,26.4,10.4,61.6,10.8,60.8c14-32,60.8-34.8,60.8-34.8s46.8,2.8,60.4,34.8c0.4,0.8,14.4-34.4,10.8-60.8 C367.2,347.6,418.4,369.6,451.2,414z"></path>
                                    </g>
                                    <path style={{ fill: '#FFFFFF' }} d="M311.2,312c0,0,0,0,0,0.4c0,4-2,29.6-56,50h-2.4c-54-20.4-56-46-56-50c0-0.4,0-0.4,0-0.4 c0-5.2,1.2-10.4,2.4-15.6c15.6,19.6,34.4,32.8,54.8,32.8s39.2-13.2,54.8-32.8C310,301.6,311.2,306.8,311.2,312z"></path>
                                    <g>
                                        <path style={{ fill: '#64c2e8' }} d="M311.2,312c0,0,2.8,28.8-57.2,51.2c0,0,46.8,2.8,60.4,34.8C315.2,398.8,342,329.2,311.2,312z"></path>
                                        <path style={{ fill: '#64c2e8' }} d="M196.8,312c-30.8,17.2-4,86.8-3.2,85.6c14-32,60.4-34.8,60.4-34.8C194,340.8,196.8,312,196.8,312z"></path>
                                    </g>
                                    <g>
                                        <path style={{ fill: '#FFFFFF' }} d="M338,210.8c-3.6,24.8-14.4,48-32.4,65.6c-3.6,3.6-6.8,6.4-10.8,9.2l-6.4-20.4h-68.8l-6.4,20.4 c-12.8-9.6-39.6-36.4-40-61.6C162,80.4,272,110.8,272,110.8C346,105.6,343.6,170.8,338,210.8z"></path>
                                        <path style={{ fill: '#FFFFFF' }} d="M352.8,236.8c-5.6,9.2-13.2,15.6-20.4,18c2.8-6.4,5.2-13.2,7.2-20c0,0,0,0,0-0.4 c1.6-6,3.2-12,4.8-18H344c1.6-6,3.2-12,4.4-18c1.6,0,3.2,0.8,4.8,1.6C362,205.6,361.6,222,352.8,236.8z"></path>
                                        <path style={{ fill: '#FFFFFF' }} d="M175.6,254.8c-7.2-2.4-14.8-8.8-20.4-18c-9.2-14.8-9.2-31.2-0.4-36.4c0.8-0.4,1.2-0.8,2-0.8 c4.8,18.8,10.4,32.8,11.6,35.6C170.4,241.6,172.8,248.4,175.6,254.8z"></path>
                                    </g>
                                    <path style={{ fill: '#324A5E' }} d="M297.6,70.8c3.2-36.8-55.2-34.4-55.2-34.4c-88.4,12.8-98,95.2-98,95.2l12-14.4 c-18.8,41.2,9.6,112,12,117.6c14.8,49.2,47.6,94.4,85.6,94.4s70.8-45.2,85.6-94.4l0,0c0,0,0,0,0-0.4c1.6-6,3.2-12,4.4-18h-0.4 c8-32,16.8-64.4,16.8-64.4C383.2,37.2,297.6,70.8,297.6,70.8z M338,210.8c-3.6,24.8-14.4,48-32.4,65.6c-3.6,3.6-7.2,6.4-10.8,9.2 l-6.4-20h-68.8l-6.4,20.4c-12.8-9.6-39.6-36.4-40-61.6C162,80.8,272,111.2,272,111.2C346,105.6,343.6,170.8,338,210.8z"></path>
                                    <path style={{ fill: '#FFFFFF' }} d="M226,279.2c6.8,7.6,16.8,12.8,28,12.8c11.2,0,21.2-4.8,28-12.8H226z"></path>
                                </g>
                            </svg>
                            <AvatarFallback className="sr-only">{getInitials(currentUser.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold text-lg">{currentUser.name}</p>
                            <p className="text-sm">{currentUser.mobile}</p>
                        </div>
                    </div>
                    <div className="flex items-center mt-4">
                        <Button variant="outline" className="bg-white/90 text-orange-600 font-bold h-8 text-xs rounded-full border-none shadow-md hover:bg-white">SUBSCRIBE</Button>
                        <p className="ml-3 text-xs font-medium">To get extra benefits</p>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto p-4">
                  <SheetClose asChild>
                      <Link
                        href="/home"
                        className="flex items-center gap-4 rounded-lg px-3 py-3 text-gray-700 transition-all hover:bg-gray-100"
                      >
                        <Home className="h-5 w-5 text-blue-600" />
                        <span className="flex-1 font-medium text-sm">Home</span>
                      </Link>
                  </SheetClose>
                    {navLinks.map((link) => {
                      if (link.isShare) {
                        return (
                          <div key={link.label} onClick={handleShare} className="flex items-center gap-4 rounded-lg px-3 py-3 text-gray-700 transition-all hover:bg-gray-100 cursor-pointer">
                            <link.icon className="h-5 w-5 text-blue-600" />
                            <span className="flex-1 font-medium text-sm">{link.label}</span>
                          </div>
                        );
                      }
                      return (
                      <SheetClose asChild key={link.label}>
                          <Link
                            href={link.href}
                            className="flex items-center gap-4 rounded-lg px-3 py-3 text-gray-700 transition-all hover:bg-gray-100"
                          >
                            <link.icon className="h-5 w-5 text-blue-600" />
                            <span className="flex-1 font-medium text-sm">{link.label}</span>
                          </Link>
                      </SheetClose>
                    )})}
                    {currentUser.isAdmin && (
                        <SheetClose asChild>
                            <Link
                                href="/admin"
                                className="flex items-center gap-4 rounded-lg px-3 py-3 text-red-600 transition-all hover:bg-gray-100"
                            >
                                <Shield className="h-5 w-5" />
                                <span className="flex-1 font-medium text-sm">Admin Panel</span>
                            </Link>
                        </SheetClose>
                    )}
                </nav>
                {/* Admin Panel and Logout Button */}
                <div className="p-4 border-t border-gray-200 space-y-2">
                    <SheetClose asChild>
                        <Button className="w-full justify-center text-white bg-orange-500 hover:bg-orange-600 h-12" onClick={handleLogout}>
                            <LogOut className="mr-3 h-5 w-5" /> 
                            <span className="font-medium">Logout</span>
                        </Button>
                    </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/home" className="flex items-center gap-2">
              <span className="font-luxury text-xl font-bold text-white whitespace-nowrap">KALYAN 777</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button variant="outline" className="bg-background/10 border-white/20 text-white hover:bg-white/20 h-8 px-3 gap-1">
              <CustomWalletIcon className="h-5 w-5" />
              <span className="font-bold text-white">{totalBalance.toFixed(0) ?? '0'}</span>
          </Button>
        </div>
      </div>
       <div className="container mx-auto px-4 py-2 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-4">
            <Button asChild className="bg-gradient-to-b from-green-500 to-green-700 text-white hover:from-green-600 hover:to-green-800 transition-transform active:scale-95 border-none rounded-xl h-11">
                <Link href="/add-funds">
                    <CustomWalletIcon className="mr-2 h-6 w-6" />
                    Add Money
                </Link>
            </Button>
            <Button asChild variant="default" className="bg-gradient-to-b from-red-500 to-red-700 text-white hover:from-red-600 hover:to-red-800 transition-transform active:scale-95 border-none rounded-xl h-11">
                <Link href="/withdraw">
                    <Image src="https://img.icons8.com/external-nawicon-flat-nawicon/64/external-Bank-economy-nawicon-flat-nawicon.png" alt="external-Bank-economy-nawicon-flat-nawicon" width={24} height={24} className="mr-2 h-6 w-6" priority />
                    Withdraw
                </Link>
            </Button>
        </div>
        
        {/* Centered NX Starline and NX Jackpot Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-1">
            <Button asChild variant="outline" className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white rounded-full h-11 shadow-md border-none active:scale-95 transition-transform overflow-hidden p-1 relative flex items-center justify-start">
                <Link href="/starline" className="w-full h-full flex items-center">
                    <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md">
                        <Star className="h-5 w-5 text-orange-500 fill-orange-500" />
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center leading-none pr-4">
                        <span className="text-[10px] font-bold text-white">KALYAN 777</span>
                        <span className="text-[12px] font-bold uppercase tracking-tight text-white">STARLINE</span>
                    </div>
                </Link>
            </Button>
            <Button asChild variant="outline" className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white rounded-full h-11 shadow-md border-none active:scale-95 transition-transform overflow-hidden p-1 relative flex items-center justify-start">
                <Link href="/jackpot" className="w-full h-full flex items-center">
                    <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md">
                        <Trophy className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center leading-none pr-4">
                        <span className="text-[10px] font-bold text-white">KALYAN 777</span>
                        <span className="text-[12px] font-bold uppercase tracking-tight text-white">JACKPOT</span>
                    </div>
                </Link>
            </Button>
        </div>
      </div>
       <section className="bg-header text-white overflow-hidden border-t border-border/40">
        {appSettings.marqueeText && (
          <div className="relative flex">
              <div className="marquee" style={marqueeStyle}>
                   <p className="shrink-0 text-sm py-2 px-4">
                      {appSettings.marqueeText} <Star className="inline-block w-4 h-4 text-yellow-400 mx-1" />
                   </p>
                   <p className="shrink-0 text-sm py-2 px-4">
                      {appSettings.marqueeText} <Star className="inline-block w-4 h-4 text-yellow-400 mx-1" />
                   </p>
              </div>
          </div>
        )}
      </section>
    </header>
  );
}
