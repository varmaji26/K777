'use client';

import Link from 'next/link';
import { Home, List, Book, MessageCircle, Wallet } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const navItems = [
  { href: '/bids-history', label: 'My Bids', icon: 'https://img.icons8.com/ios-filled/100/FD7E14/slot-machine.png' },
  { href: '/transactions-details', label: 'History', icon: 'https://img.icons8.com/ios-filled/100/FD7E14/literature--v1.png' },
  { href: '/home', label: 'Home', icon: Home },
  { href: '/funds', label: 'Funds', icon: 'https://img.icons8.com/external-glyph-design-circle/66/FD7E14/external-Funds-shopping-ande-commerce-solid-design-circle.png' },
  { href: '/support', label: 'Support', icon: 'https://img.icons8.com/ios-filled/100/FD7E14/hotline.png' },
];

export function BottomNavbar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();
        const isCurrentlyOnHome = pathname === '/home';
        const isNavigatingToHome = href === '/home';

        if (isNavigatingToHome) {
            // Always replace when going to home to clear history stack
            router.replace(href); 
        } else if (isCurrentlyOnHome) {
            // Push when leaving home to create a back entry
            router.push(href);
        } else {
            // Replace when moving between sub-pages
            router.replace(href);
        }
    };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-header text-primary-foreground shadow-t-lg">
      <div className="container mx-auto px-0">
        <div className="relative flex justify-around items-center h-16">
          {navItems.map((item, index) => {
            const isActive = pathname === item.href;
            if (item.label === 'Home') {
              return (
                <div key={item.href} className="relative -top-6">
                  <Link href={item.href} onClick={(e) => handleNav(e, item.href)} className="flex flex-col items-center justify-center h-16 w-16 bg-gradient-to-b from-orange-400 to-orange-600 rounded-full border-4 border-primary-foreground shadow-lg transition-transform active:scale-90">
                    <item.icon className="h-7 w-7 text-white" />
                    <span className="text-xs font-bold text-white">{item.label}</span>
                  </Link>
                </div>
              );
            }
            return (
              <Link key={item.href} href={item.href} onClick={(e) => handleNav(e, item.href)} className={cn(
                "flex flex-col items-center justify-center text-center gap-1 transition-all duration-200 active:scale-90",
                isActive ? 'text-orange-300' : 'text-primary-foreground/80 hover:text-white'
              )}>
                {typeof item.icon === 'string' ? (
                  <Image src={item.icon} alt={item.label} width={20} height={20} className="h-5 w-5" />
                ) : (
                  <item.icon className="h-5 w-5" />
                )}
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
