export interface Game {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  openResult?: string;
  closeResult?: string;
  result?: string;
  active?: boolean;
  activeDays?: string[];
  createdAt?: any; // Firestore Timestamp
  status?: string;
}

export interface StarlineGame {
  id: string;
  name: string; // e.g., "NX STARLINE"
  time: string; // e.g., "10:00 PM"
  panna: string; // e.g., "123" or "***"
  digit: string; // e.g., "6" or "*"
  status: 'running' | 'closed';
  active: boolean;
  createdAt?: any;
}

export interface JackpotGame {
  id: string;
  time: string; // e.g., "11:00 AM"
  result: string; // e.g., "25" or "**"
  status: 'running' | 'closed';
  active: boolean;
  createdAt?: any;
}

export type BetType = 'singleDigit' | 'jodiDigit' | 'singlePana' | 'doublePana' | 'triplePana' | 'halfSangam' | 'fullSangam' | 'singlePanaBulk' | 'singleDigitBulk' | 'doublePanaBulk' | 'spDpTp' | 'spMotor' | 'dpMotor';

export const betTypes: Record<BetType, string> = {
  singleDigit: 'Single Digit',
  singleDigitBulk: 'Single Digit Bulk',
  jodiDigit: 'Jodi Digit',
  singlePana: 'Single Pana',
  singlePanaBulk: 'Single Pana Bulk',
  doublePana: 'Double Pana',
  doublePanaBulk: 'Double Pana Bulk',
  triplePana: 'Triple Pana',
  halfSangam: 'Half Sangam',
  fullSangam: 'Full Sangam',
  spDpTp: 'SP DP TP',
  spMotor: 'SP Motor',
  dpMotor: 'DP Motor',
};

export type Session = 'Open' | 'Close';

export interface Bid {
  id?: string;
  userId: string;
  displayName: string;
  mobile?: string;
  gameId: string;
  gameName: string;
  betType: BetType;
  session: Session;
  numbers: string[];
  totalAmount: number;
  status: 'running' | 'won' | 'lost' | 'cancelled';
  createdAt: any; // Firestore Timestamp
  winningAmount?: number;
  betSource?: 'real' | 'bonus';
  isStarline?: boolean;
  isJackpot?: boolean;
}


export interface WinHistory {
  id: string;
  gameName: string;
  date: string;
  winningNumbers: string;
}

export interface BidHistory {
  id: string;
  gameName: string;
  date: string;
  bidType: string;
  numbers: string;
  points: number;
  status: 'Win' | 'Loss';
}

export interface ChartData {
  name: string;
  data: {
    date: string;
    value: number;
  }[];
}

export interface User {
    id: string;
    name: string;
    mobile: string;
    password?: string;
    isAdmin?: boolean;
    balance?: number;
    bonusBalance?: number;
    status: 'active' | 'blocked';
    joinedAt: string; 
    customRates?: Record<string, number>;
    depositBonusEnabled?: boolean;
    depositBonusPercentage?: number;
}

export interface UserProfile extends User {
  // Can add more profile-specific fields here later
}


export interface Transaction {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'bonus' | 'deposit_approved' | 'deposit_rejected' | 'withdrawal_approved' | 'withdrawal_rejected' | 'bid_placed' | 'result_reverted' | 'welcome_bonus' | 'bid_cancelled';
    status?: 'pending' | 'approved' | 'rejected' | 'won' | 'lost' | 'running' | 'cancelled' | 'reverted' | 'Given' | 'Reset';
    description: string;
    title?: string;
    balanceBefore: number;
    balanceAfter: number;
    bonusBalanceBefore?: number;
    bonusBalanceAfter?: number;
    createdAt: any; // Firestore Timestamp
    relatedId?: string; // e.g., bidId or requestId
}

export interface AppSettings {
    marqueeText?: string;
    headerMarqueeSpeed?: number;
    headerMarqueeSize?: number;
    withdrawalMarqueeText?: string;
    withdrawalMarqueeSpeed?: number;
    withdrawalMarqueeSize?: number;
    minDeposit?: number;
    minWithdrawal?: number;
    maxWithdrawal?: number;
    withdrawalNoticeText?: string;
    autoResetEnabled?: boolean;
    autoResetTime?: string;
    autoResultEnabled?: boolean;
    marketOpenTime?: string;
    withdrawalStartTime?: string;
    withdrawalEndTime?: string;
    appName?: string;
    upiId?: string;
    shareLink?: string;
    whatsappNumber?: string;
    supportNumber?: string;
    addFundNotice?: string;
    // How to Play Video Links
    videoClaimBonus?: string;
    videoChangeLanguage?: string;
    videoWithdrawal?: string;
    videoDeposit?: string;
    videoHowToPlay?: string;
    // Minimum Bid Settings
    minBidSingleDigit?: number;
    minBidJodiDigit?: number;
    minBidSinglePana?: number;
    minBidDoublePana?: number;
    minBidTriplePana?: number;
    minBidHalfSangam?: number;
    minBidFullSangam?: number;
    minBidSingleDigitBulk?: number;
    minBidSinglePanaBulk?: number;
    minBidDoublePanaBulk?: number;
    minBidSpDpTp?: number;
    minBidSpMotor?: number;
    minBidDpMotor?: number;
    // Starline Rates
    starlineRateSingleDigit?: number;
    starlineRateSinglePana?: number;
    starlineRateDoublePana?: number;
    starlineRateTriplePana?: number;
    // Jackpot Rates
    jackpotRateJodi?: number;
}
