'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/layout/footer';

interface CardLinkProps {
  href: string;
  iconSrc: string;
  title: string;
  iconWidth?: number;
  iconHeight?: number;
}

const CardLink: React.FC<CardLinkProps> = ({ href, iconSrc, title, iconWidth = 64, iconHeight = 64 }) => (
  <Link href={href}>
    <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl shadow-neumorphic aspect-w-1 aspect-h-1 transition-all duration-200 active:shadow-neumorphic-inset">
      <div className="flex items-center justify-center h-24 w-24 rounded-full bg-gray-50 shadow-neumorphic-icon mb-4">
        <Image src={iconSrc} alt={title} width={iconWidth} height={iconHeight} />
      </div>
      <div className="h-10 flex items-center">
        <h3 className="text-sm font-semibold text-gray-700 text-center">{title}</h3>
      </div>
    </div>
  </Link>
);

export default function FundsPage() {
  const router = useRouter();

  // Custom Wallet Icon Data URI
  const customWalletIconDataUri = `data:image/svg+xml;utf8,<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="%23A35425" d="M480,143.996h-96v368h96c17.672,0,32-14.328,32-32v-304C512,158.324,497.672,143.996,480,143.996z"/><circle fill="%23F19920" cx="176" cy="144.004" r="64"/><path fill="%23F19920" d="M209.92,177.916c18.752-18.736,18.776-49.128,0.04-67.88c-0.016-0.016-0.024-0.024-0.04-0.04 L142,177.916c18.736,18.752,49.128,18.776,67.88,0.04C209.896,177.94,209.904,177.924,209.92,177.916z"/><path fill="%23F6B545" d="M142.08,110.076c-18.752,18.736-18.776,49.128-0.04,67.88c0.016,0.016,0.024,0.024,0.04,0.04 l67.92-67.92c-18.736-18.752-49.128-18.776-67.88-0.04C142.104,110.052,142.096,110.06,142.08,110.076z"/><circle fill="%23F19920" cx="320" cy="64.004" r="64"/><path fill="%2389C763" d="M472,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C496,170.74,485.256,159.996,472,159.996z"/><path fill="%233CB54A" d="M456,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C480,170.74,469.256,159.996,456,159.996z"/><path fill="%2389C763" d="M440,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C464,170.74,453.256,159.996,440,159.996z"/><path fill="%233CB54A" d="M424,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C448,170.74,437.256,159.996,424,159.996z"/><path fill="%23C97629" d="M32,143.996h352c17.672,0,32,14.328,32,32v304c0,17.672-14.328,32-32,32H32 c-17.672,0-32-14.328-32-32v-304C0,158.324,14.328,143.996,32,143.996z"/><path fill="%2389C763" d="M411.76,159.996c2.816,4.864,4.28,10.384,4.24,16v304c0.04,5.616-1.424,11.136-4.24,16 c11.768-1.864,20.384-12.088,20.24-24v-288C432.144,172.076,423.528,161.86,411.76,159.996z"/><rect x="416" y="271.996" fill="%23D5E3EF" width="96" height="112"/><path fill="%23ECF0F9" d="M320,271.996c-30.928,0-56,25.072-56,56s25.072,56,56,56h96v-112H320z"/><circle fill="%237F4122" cx="320" cy="327.996" r="24"/><rect x="496" y="383.996" fill="%237F4122" width="16" height="16"/><rect x="480" y="383.996" fill="%233CB54A" width="16" height="16"/><rect x="448" y="383.996" fill="%233CB54A" width="16" height="16"/><rect x="416" y="383.996" fill="%233CB54A" width="16" height="16"/><rect x="464" y="383.996" fill="%230E9347" width="16" height="16"/><rect x="432" y="383.996" fill="%230E9347" width="16" height="16"/><path fill="%23B06328" d="M320,383.996c-27.816-0.032-51.384-20.472-55.36-48c-4.416,30.608,16.816,59.008,47.424,63.424 c2.624,0.376,5.28,0.568,7.936,0.576h80v80c0,8.84-7.16,16-16,16H48c-8.84,0-16,7.16-16,16h352c17.672,0,32-14.328,32-32v-96H320z"/><path fill="%23D5E3EF" d="M336,367.996h80l0,0v16l0,0h-96l0,0l0,0C320,375.156,327.16,367.996,336,367.996z"/><path fill="%23B0C4D9" d="M496,287.996v80h-80v16h96v-112l0,0C503.16,271.996,496,279.156,496,287.996z"/><path fill="%23F19920" d="M353.92,97.916c18.752-18.736,18.776-49.128,0.04-67.88c-0.016-0.016-0.024-0.024-0.04-0.04 L286,97.916c18.736,18.752,49.128,18.776,67.88,0.04C353.896,97.94,353.904,97.924,353.92,97.916z"/><path fill="%23F6B545" d="M286.08,30.076c-18.752,18.736-18.776,49.128-0.04,67.88c0.016,0.016,0.024,0.024,0.04,0.04 L354,30.076c-18.736-18.752-49.128-18.776-67.88-0.04C286.104,30.052,286.096,30.06,286.08,30.076z"/></svg>`;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 w-full border-b bg-header text-white">
        <div className="container flex h-16 items-center justify-center">
          <h1 className="font-bold text-lg">Funds</h1>
        </div>
      </header>
      <main className="flex-1 bg-background pb-24">
        <div className="container mx-auto px-4 py-4">
            <div className="grid grid-cols-2 gap-6">
              <CardLink
                href="/add-funds"
                iconSrc={customWalletIconDataUri}
                title="Add Funds"
                iconWidth={40}
                iconHeight={40}
              />
              <CardLink
                href="/withdraw"
                iconSrc='data:image/svg+xml;utf8,<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">   <rect x="150" y="480" width="500" height="30" rx="5" fill="%238E6BBF"/>      <rect x="200" y="240" width="400" height="240" fill="%23B197DB"/>      <rect x="190" y="240" width="60" height="240" rx="10" fill="white"/>   <ellipse cx="220" cy="480" rx="35" ry="15" fill="%23E0E0E0"/>   <ellipse cx="220" cy="240" rx="35" ry="10" fill="%23E0E0E0"/>      <rect x="370" y="220" width="60" height="260" rx="10" fill="white"/>   <ellipse cx="400" cy="480" rx="35" ry="15" fill="%23E0E0E0"/>   <ellipse cx="400" cy="220" rx="35" ry="10" fill="%23E0E0E0"/>      <rect x="550" y="240" width="60" height="240" rx="10" fill="white"/>   <ellipse cx="580" cy="480" rx="35" ry="15" fill="%23E0E0E0"/>   <ellipse cx="580" cy="240" rx="35" ry="10" fill="%23E0E0E0"/>    <path d="M120 250 L400 120 L680 250 Z" fill="%23B197DB" stroke="%239B7CCF" stroke-width="2"/>   <path d="M120 230 L400 100 L680 230 Z" fill="%23C5ADEB"/>   <rect x="120" y="230" width="560" height="20" fill="%239B7CCF"/>    <path d="M350 480 V360 Q400 310 450 360 V480 Z" fill="white" opacity="0.8"/>   <path d="M365 480 V375 Q400 335 435 375 V480 Z" fill="%235E3A96"/>    <circle cx="400" cy="180" r="35" fill="white"/>   <text x="400" y="195" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="45" fill="%23B8860B">$</text>    <circle cx="680" cy="350" r="15" fill="%23D1B9F5"/> <rect x="670" y="365" width="20" height="50" rx="10" fill="%234B0082"/> <path d="M675 415 L665 470 M685 415 L695 470" stroke="%239370DB" stroke-width="8" stroke-linecap="round"/> <path d="M630 430 Q630 400 660 420 Q660 460 630 460 Q600 460 630 430" fill="%23F0C05A"/>   <text x="630" y="445" text-anchor="middle" font-family="Arial" font-size="12" fill="%23B8860B">$</text> </svg>'
                title="Withdraw Funds"
              />
              <CardLink
                href="#"
                iconSrc='data:image/svg+xml;utf8,<svg width="400" height="400" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">   <path d="M150 120 Q150 100 170 100 Q180 85 200 90 Q220 90 225 110 Q245 110 245 130 H150 Z" fill="%235DADE2" stroke="black" stroke-width="4"/>   <path d="M350 120 Q350 100 370 100 Q380 85 400 90 Q420 90 425 110 Q445 110 445 130 H350 Z" fill="%235DADE2" stroke="black" stroke-width="4"/>    <path d="M250 130 L70 210 H430 L250 130 Z" fill="%23ABB2B9" stroke="black" stroke-width="5" stroke-linejoin="round"/>   <text x="238" y="195" font-family="Arial" font-size="35" font-weight="bold" fill="black">$</text>      <rect x="90" y="210" width="320" height="25" fill="%23D5DBDB" stroke="black" stroke-width="4"/>      <rect x="110" y="235" width="25" height="120" fill="%23D5DBDB" stroke="black" stroke-width="4"/>   <rect x="170" y="235" width="25" height="120" fill="%23D5DBDB" stroke="black" stroke-width="4"/>   <rect x="305" y="235" width="25" height="120" fill="%23D5DBDB" stroke="black" stroke-width="4"/>   <rect x="365" y="235" width="25" height="120" fill="%23D5DBDB" stroke="black" stroke-width="4"/>    <rect x="225" y="235" width="50" height="120" fill="%237F8C8D" stroke="black" stroke-width="4"/>   <circle cx="260" cy="330" r="45" fill="%23F4D03F" stroke="black" stroke-width="4"/>   <text x="248" y="348" font-family="Arial" font-size="45" font-weight="bold" fill="black">$</text>    <rect x="80" y="355" width="340" height="20" fill="%23D5DBDB" stroke="black" stroke-width="4"/>   <rect x="70" y="375" width="360" height="25" fill="%23ABB2B9" stroke="black" stroke-width="4"/> </svg>'
                title="Manual Deposit"
              />
              <CardLink
                href="/passbook"
                iconSrc='data:image/svg+xml;utf8,<svg width="400" height="400" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="100" y="150" width="300" height="220" rx="10" fill="%23E67E22" stroke="black" stroke-width="4"/><rect x="115" y="140" width="270" height="210" rx="5" fill="%23EBF5FB" stroke="black" stroke-width="4"/><line x1="250" y1="140" x2="250" y2="350" stroke="black" stroke-width="2"/><rect x="130" y="230" width="100" height="100" fill="%231ABC9C" stroke="black" stroke-width="2"/><rect x="270" y="230" width="100" height="100" fill="%231ABC9C" stroke="black" stroke-width="2"/><text x="170" y="210" font-family="Arial" font-size="40" font-weight="bold" fill="black">%2b</text><text x="310" y="210" font-family="Arial" font-size="40" font-weight="bold" fill="black">−</text><circle cx="250" cy="140" r="45" fill="%237D944F" stroke="black" stroke-width="4"/><text x="235" y="158" font-family="Arial" font-size="50" font-weight="bold" fill="black">$</text></svg>'
                title="Account Statements"
              />
            </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
