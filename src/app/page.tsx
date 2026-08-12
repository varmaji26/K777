
'use client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function RootPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#325E6A] p-4 text-white overflow-hidden relative">
      {/* Decorative background blur */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-orange-500/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-blue-400/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>

      <div className="flex items-center justify-center w-full z-10">
        <h1 className="flex flex-col items-center text-center font-luxury animate-text-float-glow">
          <span className="text-5xl sm:text-6xl font-bold text-white tracking-[0.2em] mb-1">KALYAN</span>
          <span className="text-7xl sm:text-9xl font-black text-orange-500 leading-none drop-shadow-2xl">777</span>
        </h1>
      </div>

       <div className="w-full max-w-xs space-y-4 mt-12 z-10">
            <p className="text-blue-100/60 text-center text-sm font-medium uppercase tracking-widest mb-2">Your Ultimate Gaming Hub</p>
            <Button asChild className="w-full h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-lg shadow-xl shadow-black/20 transition-all active:scale-95 border-none" size="lg">
                <Link href="/login">LOGIN</Link>
            </Button>
            <Button asChild className="w-full h-14 rounded-2xl bg-white text-[#325E6A] hover:bg-gray-100 text-lg shadow-xl transition-all active:scale-95 border-none" size="lg">
                <Link href="/signup">CREATE ACCOUNT</Link>
            </Button>
       </div>

       <div className="absolute bottom-10 text-white/30 text-[10px] font-bold tracking-[0.3em] uppercase">
          Version 2.0 • Secured
       </div>
    </div>
  );
}
