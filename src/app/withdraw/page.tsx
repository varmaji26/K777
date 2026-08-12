'use client';

import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore, useSettingsStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { Footer } from '@/components/layout/footer';
import { useToast } from '@/hooks/use-toast';
import { addDoc, collection, serverTimestamp, runTransaction, doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logTransaction } from '@/lib/transactions';

const maleRegionalNames = [
    {
        first: ["Rahul", "Santosh", "Amol", "Vijay", "Sanjay", "Pradeep", "Vishal", "Sachin", "Nilesh", "Gajanan", "Aniket", "Milind", "Swapnil", "Rohan", "Vitthal", "Dinesh", "Manoj", "Ajit", "Sunil", "Abhijit"],
        last: ["Patil", "Deshmukh", "Kulkarni", "Shinde", "Gaikwad", "Pawar", "More", "Chavan", "Jadhav", "Joshi", "Kadam", "Kalse", "Bhoir", "Mhatre", "Suryavanshi", "Sawant", "Thorat", "Salunkhe", "Wagh", "Nikam"]
    }, // Maharashtra
    {
        first: ["Vikram", "Mahendra", "Gajendra", "Pratap", "Dilip", "Hemant", "Bhanwar", "Sumer", "Ratan", "Bhagwat", "Keshav", "Madan", "Lalit", "Shravan", "Omkar", "Narayan", "Ram", "Gopal", "Shyam", "Krishna"],
        last: ["Singh", "Rathore", "Shekhawat", "Chouhan", "Bhati", "Solanki", "Gehlot", "Agarwal", "Maheshwari", "Khandelwal", "Purohit", "Bohra", "Joshi", "Sharma", "Meena", "Gurjar", "Lodha", "Oswal", "Singhal", "Goel"]
    }, // Rajasthan
    {
        first: ["Chirag", "Bhavesh", "Tushar", "Hardik", "Parth", "Ketan", "Jignesh", "Mehul", "Hitesh", "Alpesh", "Pankaj", "Dharmesh", "Nirav", "Paresh", "Gautam", "Vimal", "Harshad", "Jayesh", "Bharat", "Ashwin"],
        last: ["Patel", "Shah", "Mehta", "Trivedi", "Vyas", "Vaghela", "Gadhvi", "Parmar", "Solanki", "Zaveri", "Desai", "Modi", "Prajapati", "Gajjar", "Mistri", "Thakkar", "Jadeja", "Jhala", "Makwana", "Sarvaiya"]
    }, // Gujarat
    {
        first: ["Gurpreet", "Harpreet", "Manpreet", "Daljit", "Balwinder", "Jagjit", "Amrik", "Sukhwinder", "Jasbir", "Kuldeep", "Satnam", "Ranjit", "Navjot", "Inderjeet", "Bikram", "Avtar", "Baljit", "Gurnam", "Paramjeet", "Sarwan"],
        last: ["Singh", "Gill", "Dhillon", "Sandhu", "Grewal", "Sidhu", "Bajwa", "Mann", "Brar", "Ahluwalia", "Chawla", "Khurana", "Sethi", "Bhasin", "Oberoi", "Kohli", "Talwar", "Sahni", "Malhotra", "Kapoor"]
    }, // Punjab
    {
        first: ["Abhishek", "Manish", "Ravindra", "Surendra", "Satyendra", "Amit", "Sumit", "Neeraj", "Ashish", "Vinay", "Alok", "Deepak", "Sandeep", "Rajeev", "Vikas", "Piyush", "Rajat", "Shubham", "Mayank", "Ankit"],
        last: ["Sharma", "Yadav", "Tiwari", "Pandey", "Mishra", "Gupta", "Jha", "Singh", "Kumar", "Dubey", "Shukla", "Tyagi", "Verma", "Srivastava", "Rai", "Tripathi", "Chaudhary", "Chauhan", "Bhardwaj"]
    }, // North India
    {
        first: ["Karthik", "Vignesh", "Ramesh", "Suresh", "Murali", "Venkat", "Sridhar", "Balaji", "Raghavan", "Ganesan", "Hari", "Arvind", "Prabhu", "Santhosh", "Naveen", "Kumar", "Madhavan", "Siddharth", "Vishnu", "Shiva"],
        last: ["Iyer", "Iyengar", "Reddy", "Naidu", "Rao", "Hegde", "Menon", "Nair", "Pillai", "Shetty", "Bhat", "Gounder", "Thevar", "Chettiar", "Varma", "Raju", "Acharya", "Krishna", "Murthy", "Swamy"]
    }, // South India
    {
        first: ["Subhash", "Debashish", "Joydeep", "Pratik", "Anirban", "Sourav", "Tapas", "Abhijit", "Biswajit", "Protap", "Sukumar", "Ashoke", "Dilip", "Gautam", "Indranil", "Kamal", "Mihir", "Nirmal", "Partha", "Ranjan"],
        last: ["Chatterjee", "Mukherjee", "Banerjee", "Ganguly", "Das", "Ghosh", "Bose", "Sen", "Roy", "Dutta", "Sarkar", "Chakraborty", "Bhattacharya", "Basu", "Majumdar", "Guha", "Pal", "Sanyal", "Maitra", "Bagchi"]
    } // Bengal
];

function LiveWithdrawalNotification() {
    const [displayName, setDisplayName] = useState("");
    const [amount, setAmount] = useState(25000);
    const [visible, setVisible] = useState(true);

    const generateRandomName = () => {
        const region = maleRegionalNames[Math.floor(Math.random() * maleRegionalNames.length)];
        const first = region.first[Math.floor(Math.random() * region.first.length)];
        const last = region.last[Math.floor(Math.random() * region.last.length)];
        return `${first} ${last}`;
    };

    useEffect(() => {
        // Initial name set
        setDisplayName(generateRandomName());

        const interval = setInterval(() => {
            setVisible(false);
            setTimeout(() => {
                setDisplayName(generateRandomName());
                // Generate amount between 500 and 35000
                setAmount(Math.floor(Math.random() * (35000 - 500 + 1)) + 500);
                setVisible(true);
            }, 400); // wait for fade out
        }, 3000); // 3 second cycle

        return () => clearInterval(interval);
    }, []);

    return (
        <div className={cn(
            "w-full transition-all duration-400 transform",
            visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
        )}>
            <div className="bg-gradient-to-b from-green-500 to-green-700 rounded-xl shadow-md border border-white/10 flex items-center justify-center px-4 h-12 overflow-hidden">
                <p className="text-[13px] font-bold text-white whitespace-nowrap">
                    {displayName} ₹ {amount} Withdrawal Successful
                </p>
            </div>
        </div>
    );
}

function WithdrawOption({ icon, label, selected, onClick }: { icon: React.ReactNode, label: string, selected: boolean, onClick: () => void }) {
    return (
        <div 
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center p-2 rounded-xl cursor-pointer transition-all duration-200",
                "bg-white shadow-md border",
                selected ? "border-blue-500 ring-2 ring-blue-500" : "border-gray-200 hover:shadow-lg"
            )}
        >
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-1">
                {icon}
            </div>
            <p className="text-[10px] font-bold text-gray-700 text-center uppercase">{label}</p>
        </div>
    );
}

export default function WithdrawPage() {
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState<'bank' | 'upi'>('upi');
  const [selectedValue, setSelectedValue] = useState('upi');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { appSettings } = useSettingsStore();

  const handleOptionClick = (option: 'bank' | 'upi', value: string) => {
    setSelectedOption(option);
    setSelectedValue(value);
  };
  
  const handleWithdrawalRequest = async () => {
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    
    const startTimeStr = appSettings.withdrawalStartTime || '10:00 AM';
    const endTimeStr = appSettings.withdrawalEndTime || '10:00 PM';
    
    const parseTimeToMinutes = (tStr: string) => {
        const parts = tStr.split(' ');
        if (parts.length < 2) return 0;
        const timeParts = parts[0].split(':');
        let hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1] || '0');
        const modifier = parts[1].toUpperCase();
        
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    const startMinutes = parseTimeToMinutes(startTimeStr);
    const endMinutes = parseTimeToMinutes(endTimeStr);

    let isWithinTime = false;
    if (startMinutes <= endMinutes) {
        isWithinTime = currentTotalMinutes >= startMinutes && currentTotalMinutes <= endMinutes;
    } else {
        isWithinTime = currentTotalMinutes >= startMinutes || currentTotalMinutes <= endMinutes;
    }
    
    if (!isWithinTime) {
        toast({
            title: '⚠️ विथड्रॉल बंद है',
            description: `विथड्रॉल का समय समाप्त हो गया है। विथड्रॉल केवल सुबह ${startTimeStr} से रात ${endTimeStr} तक चालू रहता है।`,
            className: 'bg-header text-white border-none shadow-lg'
        });
        return;
    }

    const numericAmount = parseFloat(amount);
    const minWithdrawal = appSettings.minWithdrawal || 0;

    if (!numericAmount || numericAmount <= 0) {
      toast({
        title: '⚠️ Invalid Withdrawal Amount',
        description: '💸 Kindly enter a valid amount to proceed.',
        className: 'bg-header text-white border-none shadow-lg'
      });
      return;
    }
    
    if (numericAmount < minWithdrawal) {
      toast({
        title: '⚠️ Amount Too Low',
        description: `Minimum withdrawal amount is ₹${minWithdrawal}.`,
        className: 'bg-header text-white border-none shadow-lg'
      });
      return;
    }
    
    if (!currentUser) {
      toast({ 
        title: '❌ Error', 
        description: 'You must be logged in to withdraw.', 
        className: 'bg-header text-white border-none shadow-lg'
      });
      return;
    }

    if (numericAmount > (currentUser.balance ?? 0)) {
        toast({
            title: '⚠️ Insufficient Balance',
            description: `You cannot withdraw more than your available real balance of ₹${currentUser.balance?.toFixed(0)}.`,
            className: 'bg-header text-white border-none shadow-lg'
        });
        return;
    }

    setIsSubmitting(true);
    
    try {
        await runTransaction(db, async (transaction) => {
            const userDocRef = doc(db, 'users', currentUser.id);
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error("User not found.");
            }
            
            const userData = userDoc.data();
            const balanceBefore = userData.balance || 0;

            if (balanceBefore < numericAmount) {
                throw new Error("Insufficient real balance.");
            }
            
            const bonusToReset = userData.bonusBalance || 0;
            const balanceAfter = balanceBefore - numericAmount;

            transaction.update(userDocRef, { 
                balance: balanceAfter,
                bonusBalance: 0 
            });

            const newWithdrawalRef = doc(collection(db, "withdrawals"));
            
            await logTransaction({
                userId: currentUser.id,
                userName: currentUser.name,
                amount: Math.abs(numericAmount),
                type: 'withdrawal',
                status: 'pending',
                description: `Withdrawal request for ₹${numericAmount}`,
                balanceBefore,
                balanceAfter,
                relatedId: newWithdrawalRef.id,
            }, transaction);

            if (bonusToReset > 0) {
                 await logTransaction({
                    userId: currentUser.id,
                    userName: currentUser.name,
                    amount: Math.abs(bonusToReset),
                    type: 'bonus',
                    status: 'Reset',
                    description: `Bonus of ₹${bonusToReset} was reset due to withdrawal.`,
                    balanceBefore: balanceAfter, 
                    balanceAfter: balanceAfter,
                }, transaction);
            }

            const withdrawalRequest = {
                userId: currentUser.id,
                displayName: currentUser.name,
                mobile: currentUser.mobile,
                amount: numericAmount,
                status: 'pending' as 'pending' | 'approved' | 'rejected',
                createdAt: serverTimestamp(),
                withdrawalMethod: selectedOption,
                withdrawalDetails: selectedValue,
                bonusResetAmount: bonusToReset, 
            };

            transaction.set(newWithdrawalRef, withdrawalRequest);
        });

        toast({
            title: '✅ Request Sent',
            description: `Your withdrawal request for ₹${numericAmount} has been submitted.`,
            className: 'bg-green-600 text-white',
        });
        setAmount('');

    } catch (error: any) {
        console.error('Error sending withdrawal request:', error);
        toast({
            title: '❌ Error',
            description: error.message || 'Could not send your withdrawal request. Please try again.',
            className: 'bg-header text-white border-none shadow-lg'
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const marqueeStyle: CSSProperties = {
    '--marquee-duration': `${appSettings.withdrawalMarqueeSpeed || 15}s`,
    fontSize: `${appSettings.withdrawalMarqueeSize || 14}px`,
    color: '#154c79',
    fontWeight: 'bold'
  } as CSSProperties;

  const defaultNotice = "PLZZ Fill Your Bank Account Details For First Withdrawa\nकृपया विथड्रावल लगाने के बाद कॉल और मैसेज न करे आपका पैसा आपके बैंक खाता में 10 -15min बजे तक आ जाएगा !";

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 w-full border-b bg-header text-white">
        <div className="px-4 flex h-14 items-center justify-between gap-2">
          <div className="w-8"></div>
          <h1 className="font-bold text-base whitespace-nowrap overflow-hidden text-ellipsis">Withdraw Methods</h1>
           <Button variant="outline" className="bg-background/10 border-white/20 text-white hover:bg-white/20 h-8 px-2 pointer-events-none shrink-0 gap-1.5 flex items-center">
            <svg width="18" height="18" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path style={{fill:'#A35425'}} d="M480,143.996h-96v368h96c17.672,0,32-14.328,32-32v-304C512,158.324,497.672,143.996,480,143.996z"></path>
                <circle style={{fill:'#F19920'}} cx="176" cy="144.004" r="64"></circle>
                <path style={{fill:'#F19920'}} d="M209.92,177.916c18.752-18.736,18.776-49.128,0.04-67.88c-0.016-0.016-0.024-0.024-0.04-0.04 L142,177.916c18.736,18.752,49.128,18.776,67.88,0.04C209.896,177.94,209.904,177.924,209.92,177.916z"></path>
                <path style={{fill:'#F6B545'}} d="M142.08,110.076c-18.752,18.736-18.776,49.128-0.04,67.88c0.016,0.016,0.024,0.024,0.04,0.04 l67.92-67.92c-18.736-18.752-49.128-18.776-67.88-0.04C142.104,110.052,142.096,110.06,142.08,110.076z"></path>
                <circle style={{fill:'#F19920'}} cx="320" cy="64.004" r="64"></circle>
                <path style={{fill:'#89C763'}} d="M472,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C496,170.74,485.256,159.996,472,159.996z"></path>
                <path style={{fill:'#3CB54A'}} d="M456,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C480,170.74,469.256,159.996,456,159.996z"></path>
                <path style={{fill:'#89C763'}} d="M440,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C464,170.74,453.256,159.996,440,159.996z"></path>
                <path style={{fill:'#3CB54A'}} d="M424,159.996h-16c13.256,0,24,10.744,24,24v288c0,13.256-10.744,24-24,24h16 c13.256,0,24-10.744,24-24v-288C448,170.74,437.256,159.996,424,159.996z"></path>
                <path style={{fill:'#C97629'}} d="M32,143.996h352c17.672,0,32,14.328,32,32v304c0,17.672-14.328,32-32,32H32 c-17.672,0-32-14.328-32-32v-304C0,158.324,14.328,143.996,32,143.996z"></path>
                <path style={{fill:'#89C763'}} d="M411.76,159.996c2.816,4.864,4.28,10.384,4.24,16v304c0.04,5.616-1.424,11.136-4.24,16 c11.768-1.864,20.384-12.088,20.24-24v-288C432.144,172.076,423.528,161.86,411.76,159.996z"></path>
                <rect x="416" y="271.996" style={{fill:'#D5E3EF'}} width="96" height="112"></rect>
                <path style={{fill:'#ECF0F9'}} d="M320,271.996c-30.928,0-56,25.072-56,56s25.072,56,56,56h96v-112H320z"></path>
                <circle style={{fill:'#7F4122'}} cx="320" cy="327.996" r="24"></circle>
                <rect x="496" y="383.996" style={{fill:'#7F4122'}} width="16" height="16"></rect>
                <rect x="480" y="383.996" style={{fill:'#3CB54A'}} width="16" height="16"></rect>
                <rect x="448" y="383.996" style={{fill:'#3CB54A'}} width="16" height="16"></rect>
                <rect x="416" y="383.996" style={{fill:'#3CB54A'}} width="16" height="16"></rect>
                <rect x="464" y="383.996" style={{fill:'#0E9347'}} width="16" height="16"></rect>
                <rect x="432" y="383.996" style={{fill:'#0E9347'}} width="16" height="16"></rect>
                <path style={{fill:'#B06328'}} d="M320,383.996c-27.816-0.032-51.384-20.472-55.36-48c-4.416,30.608,16.816,59.008,47.424,63.424 c2.624,0.376,5.28,0.568,7.936,0.576h80v80c0,8.84-7.16,16-16,16H48c-8.84,0-16,7.16-16,16h352c17.672,0,32-14.328,32-32v-96H320z"></path>
                <path style={{fill:'#D5E3EF'}} d="M336,367.996h80l0,0v16l0,0h-96l0,0l0,0C320,375.156,327.16,367.996,336,367.996z"></path>
                <path style={{fill:'#B0C4D9'}} d="M496,287.996v80h-80v16h96v-112l0,0C503.16,271.996,496,279.156,496,287.996z"></path>
                <path style={{fill:'#F19920'}} d="M353.92,97.916c18.752-18.736,18.776-49.128,0.04-67.88c-0.016-0.016-0.024-0.024-0.04-0.04 L286,97.916c18.736,18.752,49.128,18.776,67.88,0.04C353.896,97.94,353.904,97.924,353.92,97.916z"></path>
                <path style={{fill:'#F6B545'}} d="M286.08,30.076c-18.752,18.736-18.776,49.128-0.04,67.88c0.016,0.016,0.024,0.024,0.04,0.04 L354,30.076c-18.736-18.752-49.128-18.776-67.88-0.04C286.104,30.052,286.096,30.06,286.08,30.076z"></path>
                <g>
                    <circle cx="256" cy="125" r="35" fill="#F59E0B" />
                    <text x="256" y="142" fontFamily="Arial" fontSize="45" fontWeight="bold" fill="white" textAnchor="middle">$</text>
                </g>
            </svg>
            <span className="font-bold text-sm">{currentUser?.balance?.toFixed(0) ?? '0'}</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-5 bg-gradient-to-b from-blue-50 via-white to-white pb-24">
        
        <LiveWithdrawalNotification />

        {appSettings.withdrawalMarqueeText && (
          <div className="bg-white rounded-lg p-1.5 shadow overflow-hidden relative flex">
              <div className="marquee" style={marqueeStyle}>
                  <div className="flex shrink-0 items-center">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <p key={i} className="py-1 px-4 text-sm whitespace-nowrap" style={{ color: '#154c79', fontWeight: 'bold' }}>
                          {appSettings.withdrawalMarqueeText}
                        </p>
                      ))}
                  </div>
                  <div className="flex shrink-0 items-center">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <p key={i} className="py-1 px-4 text-sm whitespace-nowrap" style={{ color: '#154c79', fontWeight: 'bold' }}>
                          {appSettings.withdrawalMarqueeText}
                        </p>
                      ))}
                  </div>
              </div>
          </div>
        )}

        <div>
            <h2 className="text-sm font-bold text-teal-700 mb-2 uppercase tracking-wide">Withdraw Options</h2>
            <div className="grid grid-cols-2 gap-3">
                 <WithdrawOption 
                    icon={<Image src='data:image/svg+xml,%3csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 466" id="upi"%3e%3cpath fill="%233d3d3c" d="M98.1 340.7h6.3l-5.9 24.5c-.9 3.6-.7 6.4.5 8.2 1.2 1.8 3.4 2.7 6.7 2.7 3.2 0 5.9-.9 8-2.7 2.1-1.8 3.5-4.6 4.4-8.2l5.9-24.5h6.4l-6 25.1c-1.3 5.4-3.6 9.5-7 12.2-3.3 2.7-7.7 4.1-13.1 4.1-5.4 0-9.1-1.3-11.1-4s-2.4-6.8-1.1-12.2l6-25.2zm31.4 40.3 10-41.9 19 24.6c.5.7 1 1.4 1.5 2.2.5.8 1 1.7 1.6 2.7l6.7-27.9h5.9l-10 41.8-19.4-25.1-1.5-2.1c-.5-.8-.9-1.5-1.2-2.4l-6.7 28h-5.9zm44.2 0 9.6-40.3h6.4l-9.6 40.3h-6.4zm15.5 0 9.6-40.3h21.9l-1.3 5.6h-15.5l-2.4 10H217l-1.4 5.7h-15.5l-4.5 18.9h-6.4zm29 0 9.6-40.3h6.4l-9.6 40.3h-6.4zm15.5 0 9.6-40.3h21.9l-1.3 5.6h-15.5l-2.4 10.1h15.5l-1.4 5.7h-15.5l-3.1 13H257l-1.4 5.9h-21.9zm29.3 0 9.6-40.3h8.6c5.6 0 9.5.3 11.6.9 2.1.6 3.9 1.5 5.3 2.9 1.8 1.8 3 4.1 3.5 6.8.5 2.8.3 6-.5 9.5-.9 3.6-2.2 6.7-4 9.5-1.8 2.8-4.1 5-6.8 6.8-2 1.4-4.2 2.3-6.6 2.9-2.3.6-5.8.9-10.4.9H263zm7.8-6h5.4c2.9 0 5.2-.2 6.8-.6 1.6-.4 3-1.1 4.3-2 1.8-1.3 3.3-2.9 4.5-4.9 1.2-1.9 2.1-4.2 2.7-6.8.6-2.6.8-4.8.5-6.7-.3-1.9-1-3.6-2.2-4.9-.9-1-2-1.6-3.5-2-1.5-.4-3.8-.6-7.1-.6h-4.6l-6.8 28.5zm59.7-12.1-4.3 18.1h-6l9.6-40.3h9.7c2.9 0 4.9.2 6.2.5 1.3.3 2.3.8 3.1 1.6 1 .9 1.7 2.2 2 3.8.3 1.6.2 3.3-.2 5.2-.5 1.9-1.2 3.7-2.3 5.3-1.1 1.6-2.4 2.9-3.8 3.8-1.2.7-2.5 1.3-3.9 1.6-1.4.3-3.6.5-6.4.5h-3.7zm1.7-5.4h1.6c3.5 0 6-.4 7.4-1.2 1.4-.8 2.3-2.2 2.8-4.2.5-2.1.2-3.7-.8-4.5-1.1-.9-3.3-1.3-6.6-1.3H335l-2.8 11.2zm40.1 23.5-2-10.4h-15.6l-7 10.4H341l29-41.9 9 41.9h-6.7zm-13.8-15.9h10.9l-1.8-9.2c-.1-.6-.2-1.3-.2-2-.1-.8-.1-1.6-.1-2.5-.4.9-.8 1.7-1.3 2.5-.4.8-.8 1.5-1.2 2.1l-6.3 9.1zm29.7 15.9 4.4-18.4-8-21.8h6.7l5 13.7c.1.4.2.8.4 1.4.2.6.3 1.2.5 1.8l1.2-1.8c.4-.6.8-1.1 1.2-1.6l11.7-13.5h6.4L399 362.5l-4.4 18.4h-6.4zm60.9-19.9c0-.3.1-1.2.3-2.6.1-1.2.2-2.1.3-2.9-.4.9-.8 1.8-1.3 2.8-.5.9-1.1 1.9-1.8 2.8l-15.4 21.5-5-21.9c-.2-.9-.4-1.8-.5-2.6-.1-.8-.2-1.7-.2-2.5-.2.8-.5 1.7-.8 2.7-.3.9-.7 1.9-1.2 2.9l-9 19.8h-5.9l19.3-42 5.5 25.4c.1.4.2 1.1.3 2 .1.9.3 2.1.5 3.5.7-1.2 1.6-2.6 2.8-4.4.3-.5.6-.8.7-1.1l17.4-25.4-.6 42h-5.9l.5-20zm10.6 19.9 9.6-40.3h21.9l-1.3 5.6h-15.5l-2.4 10.1h15.5l-1.4 5.7H483l-1.4 5.9h-21.9zm29.2 0 10-41.9 19 24.6c.5.7 1 1.4 1.5 2.2.5.8 1 1.7 1.6 2.7l6.7-27.9h5.9l-10 41.8-19.4-25.1-1.5-2.1c-.5-.8-.9-1.5-1.2-2.4l-6.7 28h-5.9zm65.1-34.8-8.3 34.7h-6.4l8.3-34.7h-10.4l1.3-5.6h27.2l-1.3 5.6H554zm6.7 26.7 5.7-2.4c.1 1.8.6 3.2 1.7 4.1 1.1.9 2.6 1.4 4.6 1.4 1.9 0 3.5-.5 4.9-1.6 1.4-1.1 2.3-2.5 2.7-4.3.6-2.4-.8-4.5-4.2-6.3-.5-.3-.8-.5-1.1-.6-3.8-2.2-6.2-4.1-7.2-5.9-1-1.8-1.2-3.9-.6-6.4.8-3.3 2.5-5.9 5.2-8 2.7-2 5.7-3.1 9.3-3.1 2.9 0 5.2.6 6.9 1.7 1.7 1.1 2.6 2.8 2.9 4.9l-5.6 2.6c-.5-1.3-1.1-2.2-1.9-2.8-.8-.6-1.8-.9-3-.9-1.7 0-3.2.5-4.4 1.4-1.2.9-2 2.1-2.4 3.7-.6 2.4 1.1 4.7 5 6.8.3.2.5.3.7.4 3.4 1.8 5.7 3.6 6.7 5.4 1 1.8 1.2 3.9.6 6.6-.9 3.8-2.8 6.8-5.7 9.1-2.9 2.2-6.3 3.4-10.3 3.4-3.3 0-5.9-.8-7.7-2.4-2-1.6-2.9-3.9-2.8-6.8zm47.1 8.1 9.6-40.3h6.4l-9.6 40.3h-6.4zm15.6 0 10-41.9 19 24.6c.5.7 1 1.4 1.5 2.2.5.8 1 1.7 1.6 2.7l6.7-27.9h5.9l-10 41.8-19.4-25.1-1.5-2.1c-.5-.8-.9-1.5-1.2-2.4l-6.7 28h-5.9zm65.1-34.8-8.3 34.7h-6.4l8.3-34.7h-10.4l1.3-5.6h27.2l-1.3 5.6h-10.4zm6.9 34.8 9.6-40.3h22l-1.3 5.6h-15.5l-2.4 10.1h15.5l-1.4 5.7h-15.5l-3.1 13h15.5l-1.4 5.9h-22zm39.5-18.1-4.3 18h-6l9.6-40.3h8.9c2.6 0 4.6.2 5.9.5 1.4.3 2.5.9 3.3 1.7 1 1 1.6 2.2 1.9 3.8.3 1.5.2 3.2-.2 5.1-.8 3.2-2.1 5.8-4.1 7.6-2 1.8-4.5 2.9-7.5 3.3l9.1 18.3h-7.2l-8.7-18h-.7zm1.6-5.1h1.2c3.4 0 5.7-.4 7-1.2 1.3-.8 2.2-2.2 2.7-4.3.5-2.2.3-3.8-.7-4.7-1-.9-3.1-1.4-6.3-1.4h-1.2l-2.7 11.6zm18.9 23.2 9.6-40.3h21.9l-1.3 5.6h-15.5l-2.4 10h15.5l-1.4 5.7h-15.5l-4.5 18.9h-6.4zm52.8 0-2-10.4h-15.6l-7 10.4h-6.7l29-41.9 9 41.9h-6.7zm-13.9-15.9h10.9l-1.8-9.2c-.1-.6-.2-1.3-.2-2-.1-.8-.1-1.6-.1-2.5-.4.9-.8 1.7-1.3 2.5-.4.8-.8 1.5-1.2 2.1l-6.3 9.1zm62.2-14.6c-1.4-1.6-3.1-2.8-4.9-3.5-1.8-.8-3.8-1.2-6.1-1.2-4.3 0-8.1 1.4-11.5 4.2-3.4 2.8-5.6 6.5-6.7 11-1 4.3-.6 7.9 1.4 10.8 1.9 2.8 4.9 4.2 8.9 4.2 2.3 0 4.6-.4 6.9-1.3 2.3-.8 4.6-2.1 7-3.8l-1.8 7.4c-2 1.3-4.1 2.2-6.3 2.8-2.2.6-4.4.9-6.8.9-3 0-5.7-.5-8-1.5s-4.2-2.5-5.7-4.5c-1.5-1.9-2.4-4.2-2.8-6.8-.4-2.6-.3-5.4.5-8.4.7-3 1.9-5.7 3.5-8.3 1.6-2.6 3.7-4.9 6.1-6.8 2.4-2 5-3.5 7.8-4.5s5.6-1.5 8.5-1.5c2.3 0 4.4.3 6.4 1 1.9.7 3.7 1.7 5.3 3.1l-1.7 6.7zm.6 30.5 9.6-40.3h21.9l-1.3 5.6h-15.5l-2.4 10.1h15.5l-1.4 5.7H868l-3.1 13h15.5L879 381h-21.9z"/%3e %3cpath fill="%2370706e" d="M740.7 305.6h-43.9l61-220.3h43.9l-61 220.3zM717.9 92.2c-3-4.2-7.7-6.3-14.1-6.3H462.6l-11.9 43.2h219.4l-12.8 46.1H481.8v-.1h-43.9l-36.4 131.5h43.9l24.4-88.2h197.3c6.2 0 12-2.1 17.4-6.3 5.4-4.2 9-9.4 10.7-15.6l24.4-88.2c1.9-6.6 1.3-11.9-1.7-16.1zm-342 199.6c-2.4 8.7-10.4 14.8-19.4 14.8H130.2c-6.2 0-10.8-2.1-13.8-6.3-3-4.2-3.7-9.4-1.9-15.6l55.2-198.8h43.9l-49.3 177.6h175.6l49.3-177.6h43.9l-57.2 205.9z"/%3e %3cpath fill="%23098041" d="M877.5 85.7 933 196.1 816.3 306.5z"/%3e %3cpath fill="%23e97626" d="M838.5 85.7 894 196.1 777.2 306.5z"/%3e%3c/svg%3e' alt="UPI" width={32} height={32} />}
                    label="UPI"
                    selected={selectedOption === 'upi'}
                    onClick={() => handleOptionClick('upi', 'upi')}
                />
                 <WithdrawOption 
                    icon={<Image src={`data:image/svg+xml;utf8,${encodeURIComponent('<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">   <defs>     <linearGradient id="roofSide" x1="0%" y1="0%" x2="100%" y2="0%">       <stop offset="0%" style="stop-color:#3B82F6" />       <stop offset="100%" style="stop-color:#1D4ED8" />     </linearGradient>     <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">       <feDropShadow dx="0" dy="4" stdDeviation="5" flood-opacity="0.2"/>     </filter>   </defs>    <rect x="40" y="440" width="432" height="30" rx="8" fill="#1D4ED8" />   <rect x="60" y="410" width="392" height="35" rx="4" fill="#3B82F6" filter="url(#shadow)" />    <rect x="90" y="220" width="45" height="190" rx="6" fill="#F3F4F6" />   <rect x="185" y="220" width="45" height="190" rx="6" fill="#F3F4F6" />   <rect x="280" y="220" width="45" height="190" rx="6" fill="#F3F4F6" />   <rect x="375" y="220" width="45" height="190" rx="6" fill="#F3F4F6" />      <rect x="85" y="220" width="55" height="10" rx="2" fill="#E5E7EB" />   <rect x="180" y="220" width="55" height="10" rx="2" fill="#E5E7EB" />   <rect x="275" y="220" width="55" height="10" rx="2" fill="#E5E7EB" />   <rect x="370" y="220" width="55" height="10" rx="2" fill="#E5E7EB" />    <rect x="60" y="190" width="392" height="30" rx="4" fill="#3B82F6" />    <path d="M40 190 L256 40 L472 190 Z" fill="url(#roofSide)" stroke="#1E40AF" stroke-width="2" />      <path d="M80 175 L256 70 L432 175 Z" fill="#2563EB" opacity="0.5" />    <g filter="url(#shadow)">     <circle cx="256" cy="125" r="35" fill="#F59E0B" />     <text x="256" y="142" font-family="Arial" font-size="45" font-weight="bold" fill="white" textAnchor="middle">$</text>   </g> </svg>')}`} alt="Bank" width={32} height={32} />} 
                    label="Add Bank"
                    selected={selectedOption === 'bank'}
                    onClick={() => handleOptionClick('bank', 'bank1')}
                />
            </div>
        </div>

        <div className="rounded-xl overflow-hidden shadow-md border border-[#154c79]/20 bg-blue-50">
            <div className="bg-header p-1.5 text-center">
                <h3 className="text-white font-bold text-[10px] tracking-widest uppercase">Withdrawal Notice</h3>
            </div>
            <div className="p-2.5 space-y-2 text-center">
                <p className="text-[#154c79] font-bold text-[11px] whitespace-pre-wrap leading-tight">
                    {appSettings.withdrawalNoticeText || defaultNotice}
                </p>
                
                <div className="flex justify-around items-center pt-1.5 border-t border-[#154c79]/10">
                    <div className="text-center">
                        <p className="text-[8px] font-bold text-gray-500 uppercase">Min Withdraw</p>
                        <p className="text-sm font-black text-[#154c79]">₹{appSettings.minWithdrawal || 1000}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[8px] font-bold text-gray-500 uppercase">Max Withdraw</p>
                        <p className="text-sm font-black text-[#154c79]">₹{appSettings.maxWithdrawal || 50000}</p>
                    </div>
                </div>
            </div>
        </div>

        <div>
            <label htmlFor="bank" className="text-xs font-bold text-gray-600 mb-1 block ml-1 uppercase">Select Bank Account</label>
            <Select value={selectedValue} onValueChange={(value) => setSelectedValue(value)}>
              <SelectTrigger id="bank" className="w-full h-11 bg-white rounded-lg border-gray-200">
                <SelectValue placeholder="Select your saved bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank1">Bank Account 1</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
              </SelectContent>
            </Select>
        </div>

        <div>
            <label htmlFor="amount" className="text-xs font-bold text-gray-600 mb-1 block ml-1 uppercase">Enter Point (Min: ₹{appSettings.minWithdrawal || 0})</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-md font-bold text-primary">₹</span>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8 h-11 text-base bg-white rounded-lg border-gray-200"
                disabled={isSubmitting}
              />
            </div>
        </div>

        <div className="space-y-3">
             <Button size="lg" className="w-full h-12 text-base font-bold bg-gradient-to-b from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 shadow-md active:scale-95 transition-all" onClick={handleWithdrawalRequest} disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Process Withdrawal'}
             </Button>
             <Button variant="link" className="w-full text-blue-900/80 font-bold text-xs uppercase tracking-wider" asChild>
                <Link href="/passbook">Transaction History</Link>
            </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
