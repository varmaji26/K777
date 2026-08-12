
'use client';
import { Button } from '@/components/ui/button';
import { Bell, ChevronRight, Gamepad2, LogOut, Settings, User, Home, Eye, Users, PlusSquare, Image as ImageIcon, MessageSquare, Send, CheckCircle, XCircle, BarChart2, LineChart, History, Award, Gift, FileText, FileSpreadsheet, Lock, Shield, Settings2, BarChart, FileDigit, PanelTop, Menu, ChevronDown, ArrowUp, ArrowDown, Share2, Star, Trophy, Search } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sheet, SheetTrigger, SheetContent, SheetClose, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


function getInitials(name: string) {
    if (!name) return 'A';
    const names = name.split(' ');
    const initials = names.map(n => n[0]).join('');
    return initials.toUpperCase();
}

const NavLink = ({ href, icon: Icon, children, badgeCount, onClick, className }: { href: string, icon: React.ElementType, children: React.ReactNode, badgeCount?: number, onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void, className?: string }) => {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link 
            href={href} 
            onClick={onClick}
            className={cn(
                "flex items-center gap-4 rounded-lg px-3 py-3 text-gray-700 transition-all hover:bg-gray-100", 
                isActive && "bg-gray-100",
                className
            )}
        >
            <Icon className={cn("h-5 w-5 text-orange-500", className?.includes("text-") && className.split(" ").find(c => c.startsWith("text-")))} />
            <span className="flex-1 font-medium text-sm">{children}</span>
            {badgeCount != null && badgeCount > 0 && <span className="ml-auto inline-block rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white min-w-[20px] text-center">{badgeCount}</span>}
        </Link>
    );
};

const SidebarContent = ({ closeSheet }: { closeSheet?: () => void }) => {
    const { currentUser, logout } = useUserStore();
    const router = useRouter();
    const pathname = usePathname();
    const isSheet = !!closeSheet;
    const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
    const [pendingDeposits, setPendingDeposits] = useState(0);
    const [newBidsCount, setNewBidsCount] = useState(0);
    const [newWinsCount, setNewWinsCount] = useState(0);
    const [newUsersCount, setNewUsersCount] = useState(0);

    useEffect(() => {
        const qWithdrawals = query(collection(db, "withdrawals"), where("status", "==", "pending"));
        const unsubWithdrawals = onSnapshot(qWithdrawals, (snapshot) => setPendingWithdrawals(snapshot.size), (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'withdrawals',
                operation: 'list'
            }));
        });

        const qDeposits = query(collection(db, "deposits"), where("status", "==", "pending"));
        const unsubDeposits = onSnapshot(qDeposits, (snapshot) => setPendingDeposits(snapshot.size), (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'deposits',
                operation: 'list'
            }));
        });
        
        const lastViewedBidsTimestamp = parseInt(localStorage.getItem('lastViewedBidsTimestamp') || '0', 10);
        const bidsQuery = query(collection(db, "bids"), where("createdAt", ">", Timestamp.fromMillis(lastViewedBidsTimestamp)));
        const unsubBids = onSnapshot(bidsQuery, (snapshot) => {
            setNewBidsCount(snapshot.size);
            const lastViewedWinsTimestamp = parseInt(localStorage.getItem('lastViewedWinsTimestamp') || '0', 10);
            const newWins = snapshot.docs.filter(doc => {
                const data = doc.data();
                const createdAtMillis = data.createdAt.toMillis();
                return data.status === 'won' && createdAtMillis > lastViewedWinsTimestamp;
            });
            setNewWinsCount(newWins.length);
        }, (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'bids',
                operation: 'list'
            }));
        });

        const lastViewedUsersTimestamp = parseInt(localStorage.getItem('lastViewedUsersTimestamp') || '0', 10);
        const qUsers = query(collection(db, "users"), where("isAdmin", "==", false));
        const unsubUsers = onSnapshot(qUsers, (snapshot) => {
            const count = snapshot.docs.filter(doc => {
                const data = doc.data();
                if (!data.joinedAt) return false;
                return new Date(data.joinedAt).getTime() > lastViewedUsersTimestamp;
            }).length;
            setNewUsersCount(count);
        }, (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'users',
                operation: 'list'
            }));
        });

        return () => {
            unsubWithdrawals();
            unsubDeposits();
            unsubBids();
            unsubUsers();
        };
    }, [pathname]);
    
    const adminNavLinks = [
      { key: 'dashboard', href: '/admin', label: 'Dashboard', icon: Home },
      { key: 'users', href: '/admin/users', label: 'Registered Users', icon: Users, badgeCount: newUsersCount },
      { key: 'add-game', href: '/admin/games', label: 'Add New Game', icon: PlusSquare },
      { key: 'manage-starline', href: '/admin/starline', label: 'Manage Starline', icon: Star },
      { key: 'manage-jackpot', href: '/admin/jackpot', label: 'Manage Jackpot', icon: Trophy },
      { key: 'banners', href: '#/manage-banners', label: 'Manage Banners', icon: ImageIcon },
      { key: 'withdrawal-requests', href: '/admin/withdrawal-requests', label: 'Withdrawal Requests', icon: FileText, isSubItem: true, badgeCount: pendingWithdrawals },
      { key: 'deposit-requests', href: '/admin/deposit-requests', label: 'Deposit Requests', icon: FileText, isSubItem: true, badgeCount: pendingDeposits },
      { key: 'update-open', href: '/admin/update-result-open', label: 'Update Result (Open)', icon: CheckCircle, className: "text-green-600" },
      { key: 'update-close', href: '/admin/update-result-close', label: 'Update Result (Close)', icon: XCircle, className: "text-red-600" },
      { key: 'send-notification', href: '/admin/send-notification', label: 'Send Notification', icon: Send },
      { key: 'market-load', href: '/admin/market-wise-load', label: 'Market-wise Load', icon: LineChart },
      { key: 'bid-history', href: '/admin/bids-history?viewed=true', label: 'Bid History', icon: History, badgeCount: newBidsCount },
      { key: 'win-history', href: '/admin/win-history?viewed=true', label: 'Win History', icon: Award, badgeCount: newWinsCount },
      { key: 'bonus-history', href: '/admin/bonus-history', label: 'Bonus History', icon: Gift },
      { key: 'deposit-history', href: '/admin/deposit-history', label: 'Deposit History', icon: ArrowUp, isSubItem: true },
      { key: 'withdrawal-history', href: '/admin/withdrawal-history', label: 'Withdrawal History', icon: ArrowDown, isSubItem: true },
      { key: 'panel-chart', href: '/admin/charts', label: 'Manage Panel Chart', icon: PanelTop },
      { key: 'contact-settings', href: '/admin/contact-settings', label: 'Contact Settings', icon: Share2 },
      { key: 'settings', href: '/admin/settings', label: 'Settings', icon: Settings2 },
    ];

    const handleLogout = () => {
        logout();
        router.push('/');
        if (closeSheet) closeSheet();
    };

    const handleLinkClick = (href: string) => {
        if (href.startsWith('#')) return;
        router.push(href);
        if (closeSheet) closeSheet();
    };
    
    if (!currentUser) return null;
    
    const topLinks = adminNavLinks.filter(l => ['dashboard', 'users', 'add-game', 'manage-starline', 'manage-jackpot', 'banners'].includes(l.key));
    const managementLinks = adminNavLinks.filter(l => 
        !l.isSubItem && 
        !topLinks.some(top => top.key === l.key) && 
        !['payment-history-placeholder', 'bid-history', 'win-history', 'bonus-history', 'settings', 'panel-chart', 'contact-settings', 'update-open', 'update-close'].includes(l.key)
    );
    
    const resultLinks = adminNavLinks.filter(l => ['update-open', 'update-close'].includes(l.key));
    const historyLinks = adminNavLinks.filter(l => ['bid-history', 'win-history', 'bonus-history'].includes(l.key));
    const panelChartLink = adminNavLinks.find(l => l.key === 'panel-chart');
    const contactSettingsLink = adminNavLinks.find(l => l.key === 'contact-settings');
    const settingsLink = adminNavLinks.find(l => l.key === 'settings');

    const renderLink = (link: any) => {
      let badgeCount = link.badgeCount;
      if (link.key === 'withdrawal-requests') badgeCount = pendingWithdrawals;
      if (link.key === 'deposit-requests') badgeCount = pendingDeposits;

      const navLink = (
            <NavLink 
                href={link.href}
                icon={link.icon}
                badgeCount={badgeCount}
                className={link.className}
                onClick={(e) => {
                    e.preventDefault();
                    handleLinkClick(link.href)
                }}
            >
                {link.label}
            </NavLink>
        );
        
        if (isSheet) return <SheetClose asChild key={link.key}>{navLink}</SheetClose>;
        return <div key={link.key}>{navLink}</div>;
    }

    return (
        <div className="flex flex-col h-full bg-white relative">
            <div className="p-4 bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-white rounded-b-2xl shadow-lg sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 border-2 border-white bg-transparent overflow-hidden">
                        <svg 
                            viewBox="0 0 508 508" 
                            className="h-full w-full"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <g id="SVGRepo_iconCarrier">
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
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {topLinks.filter(l => ['dashboard', 'users'].includes(l.key)).map(renderLink)}

                <Collapsible>
                    <CollapsibleTrigger className="w-full text-left">
                        <div className={cn("flex items-center gap-4 rounded-lg px-3 py-3 text-gray-700 transition-all hover:bg-gray-100 w-full")}>
                            <Eye className="h-5 w-5 text-orange-500" />
                            <span className="flex-1 font-medium text-sm text-left">View All Load</span>
                            <ChevronDown className="h-4 w-4 text-gray-400 transition-transform [&[data-state=open]]:rotate-180" />
                        </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-8 pr-2 py-1 space-y-1">
                        <Link href="/admin/view-open-load" onClick={(e) => { e.preventDefault(); handleLinkClick('/admin/view-open-load')}} className={cn("flex items-center text-sm p-2 rounded-md text-green-600 font-bold hover:bg-gray-50")}>View Open Load</Link>
                        <Link href="/admin/view-close-load" onClick={(e) => { e.preventDefault(); handleLinkClick('/admin/view-close-load')}} className={cn("flex items-center text-sm p-2 rounded-md text-red-600 font-bold hover:bg-gray-50")}>View Close Load</Link>
                        <Link href="/admin/view-user-load" onClick={(e) => { e.preventDefault(); handleLinkClick('/admin/view-user-load')}} className={cn("flex items-center text-sm p-2 rounded-md text-[#154c79] font-bold hover:bg-gray-50")}>
                            <Search className="h-3 w-3 mr-2" />
                            View User-wise Load
                        </Link>
                        <Link href="/admin/view-starline-load" onClick={(e) => { e.preventDefault(); handleLinkClick('/admin/view-starline-load')}} className={cn("flex items-center text-sm p-2 rounded-md text-gray-600 hover:bg-gray-50")}>View Starline Load</Link>
                        <Link href="/admin/view-jackpot-load" onClick={(e) => { e.preventDefault(); handleLinkClick('/admin/view-jackpot-load')}} className={cn("flex items-center text-sm p-2 rounded-md text-gray-600 hover:bg-gray-50")}>View Jackpot Load</Link>
                        <Link href="#" onClick={(e) => { e.preventDefault(); handleLinkClick('#')}} className={cn("flex items-center text-sm p-2 rounded-md text-gray-600 hover:bg-gray-50")}>View Game-Type wise Load</Link>
                    </CollapsibleContent>
                </Collapsible>
                
                {topLinks.filter(l => ['add-game', 'manage-starline'].includes(l.key)).map(renderLink)}

                <Collapsible>
                    <CollapsibleTrigger className="w-full">
                        <div className={cn("flex items-center gap-4 rounded-lg px-3 py-3 text-gray-700 transition-all hover:bg-gray-100 w-full")}>
                            <MessageSquare className="h-5 w-5 text-orange-500" />
                            <span className="flex-1 font-medium text-sm text-left">Customer Requests</span>
                            {(pendingDeposits + pendingWithdrawals > 0) && <span className="ml-auto inline-block rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{pendingDeposits + pendingWithdrawals}</span>}
                            <ChevronDown className="h-4 w-4 text-gray-400 transition-transform [&[data-state=open]]:rotate-180" />
                        </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-8 pr-2 py-1 space-y-1">
                        {adminNavLinks.filter(l => l.key === 'deposit-requests').map(link => {
                             const isActive = pathname === link.href;
                             const navLink = <Link href={link.href} onClick={(e) => { e.preventDefault(); handleLinkClick(link.href)}} className={cn("flex items-center text-sm p-2 rounded-md", isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50")}>
                                 <span>{link.label}</span>
                                 {pendingDeposits > 0 && <span className="ml-auto inline-block rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{pendingDeposits}</span>}
                             </Link>
                            if (isSheet) return <SheetClose asChild key={link.key}>{navLink}</SheetClose>;
                            return <div key={link.key}>{navLink}</div>;
                        })}
                        {adminNavLinks.filter(l => l.key === 'withdrawal-requests').map(link => {
                             const isActive = pathname === link.href;
                             const navLink = <Link href={link.href} onClick={(e) => { e.preventDefault(); handleLinkClick(link.href)}} className={cn("flex items-center text-sm p-2 rounded-md", isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50")}>
                                 <span>{link.label}</span>
                                 {pendingWithdrawals > 0 && <span className="ml-auto inline-block rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{pendingWithdrawals}</span>}
                              </Link>
                             if (isSheet) return <SheetClose asChild key={link.key}>{navLink}</SheetClose>;
                             return <div key={link.key}>{navLink}</div>;
                        })}
                    </CollapsibleContent>
                </Collapsible>

                {topLinks.filter(l => ['manage-jackpot', 'banners'].includes(l.key)).map(renderLink)}
                
                {resultLinks.map(renderLink)}

                {managementLinks.map(renderLink)}
                {historyLinks.map(renderLink)}
                
                <Collapsible>
                    <CollapsibleTrigger className="w-full">
                        <div className={cn("flex items-center gap-4 rounded-lg px-3 py-3 text-gray-700 transition-all hover:bg-gray-100 w-full")}>
                            <FileSpreadsheet className="h-5 w-5 text-orange-500" />
                            <span className="flex-1 font-medium text-sm text-left">Payment History</span>
                            <ChevronDown className="h-4 w-4 text-gray-400 transition-transform [&[data-state=open]]:rotate-180" />
                        </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-8 pr-2 py-1 space-y-1">
                        {adminNavLinks.filter(l => l.key === 'deposit-history').map(link => {
                             const isActive = pathname === link.href;
                             const navLink = <Link href={link.href} onClick={(e) => { e.preventDefault(); handleLinkClick(link.href)}} className={cn("flex items-center text-sm p-2 rounded-md", isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50")}>
                                 <ArrowUp className="mr-2 h-4 w-4 text-green-500" />
                                 <span>{link.label}</span>
                             </Link>
                            if (isSheet) return <SheetClose asChild key={link.key}>{navLink}</SheetClose>;
                            return <div key={link.key}>{navLink}</div>;
                        })}
                        {adminNavLinks.filter(l => l.key === 'withdrawal-history').map(link => {
                             const isActive = pathname === link.href;
                             const navLink = <Link href={link.href} onClick={(e) => { e.preventDefault(); handleLinkClick(link.href)}} className={cn("flex items-center text-sm p-2 rounded-md", isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50")}>
                                 <ArrowDown className="mr-2 h-4 w-4 text-red-500" />
                                 <span>{link.label}</span>
                              </Link>
                             if (isSheet) return <SheetClose asChild key={link.key}>{navLink}</SheetClose>;
                             return <div key={link.key}>{navLink}</div>;
                        })}
                    </CollapsibleContent>
                </Collapsible>

                {panelChartLink && renderLink(panelChartLink)}
                {contactSettingsLink && renderLink(contactSettingsLink)}
                {settingsLink && renderLink(settingsLink)}
            </nav>

             <div className="p-4 border-t border-gray-200 space-y-2 sticky bottom-0 bg-white z-20">
                <Button className="w-full justify-center text-white bg-primary hover:bg-primary/90 h-12" onClick={handleLogout}>
                    <LogOut className="mr-3 h-5 w-5" /> 
                    <span className="font-medium">Logout</span>
                </Button>
             </div>
        </div>
    );
};

const Sidebar = () => (
    <div className="hidden lg:flex lg:flex-col lg:w-64 border-r border-gray-200 h-screen sticky top-0">
        <SidebarContent />
    </div>
);


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const [isSheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (currentUser && !currentUser.isAdmin) {
      router.push('/home');
    }
  }, [currentUser, router]);

  if (!currentUser?.isAdmin) {
    return null;
  }
  
  return (
     <div className="flex min-h-screen bg-white text-gray-800">
        <Sidebar />
        <div className="flex flex-1 flex-col">
            <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
                <div className="flex items-center gap-4">
                     <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
                        <SheetTrigger asChild className="lg:hidden">
                            <Button variant="ghost" size="icon">
                                <Menu className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-4/5">
                           <SheetHeader className="p-4">
                              <SheetTitle className="sr-only">Admin Menu</SheetTitle>
                              <SheetDescription className="sr-only">Manage your administrative settings and view reports.</SheetDescription>
                           </SheetHeader>
                            <SidebarContent closeSheet={() => setSheetOpen(false)} />
                        </SheetContent>
                    </Sheet>
                    <h1 className="text-xl font-semibold">Admin Panel</h1>
                </div>
                <div className="flex items-center gap-4">
                    <Button asChild className="bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-white hover:opacity-90">
                       <Link href="/home">Go to User Panel</Link>
                    </Button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
                {children}
            </main>
        </div>
    </div>
  );
}
