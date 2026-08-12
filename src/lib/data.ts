import type { Game, WinHistory, BidHistory, ChartData } from './types';

export const games: Game[] = [
  {
    id: 'milan-night',
    name: '𝐌𝐢𝐥𝐚𝐧 𝐍𝐢𝐠𝐡𝐭',
    openTime: '12:00 AM',
    closeTime: '11:59 PM',
  },
  {
    id: 'milan-day',
    name: '𝐌𝐢𝐥𝐚𝐧 𝐃𝐚𝐲',
    openTime: '2:00 PM',
    closeTime: '4:00 PM',
  },
  {
    id: 'time-bazar-day',
    name: '𝐓𝐢𝐦𝐞 𝐁𝐚𝐳𝐚𝐫 𝐃𝐚𝐲',
    openTime: '1:00 PM',
    closeTime: '2:00 PM',
  },
  {
    id: 'kalyan-main-bazar',
    name: '𝐊𝐚𝐥𝐲𝐚𝐧 𝐌𝐚𝐢𝐧 𝐁𝐚𝐳𝐚𝐫',
    openTime: '9:35 PM',
    closeTime: '11:55 PM',
  },
  {
    id: 'main-bazar-day',
    name: '𝐌𝐚𝐢𝐧 𝐁𝐚𝐳𝐚𝐫 𝐃𝐚𝐲',
    openTime: '9:40 PM',
    closeTime: '12:05 AM',
  },
  {
    id: 'sridevi-night',
    name: '𝐒𝐫𝐢𝐝𝐞𝐯𝐢 𝐍𝐢𝐠𝐡𝐭',
    openTime: '7:00 PM',
    closeTime: '8:00 PM',
  },
  {
    id: 'rajdhani-night',
    name: '𝐑𝐚𝐣𝐝𝐡𝐚𝐧𝐢 𝐍𝐢𝐠𝐡𝐭',
    openTime: '9:30 PM',
    closeTime: '11:45 PM',
  },
   {
    id: 'rose-bazar',
    name: '𝐑𝐨𝐬𝐞 𝐁𝐚𝐳𝐚𝐫',
    openTime: '10:00 AM',
    closeTime: '12:00 PM',
  },
  {
    id: 'super-bazar-night',
    name: '𝐒𝐮𝐩𝐞𝐫 𝐁𝐚𝐳𝐚𝐫 𝐍𝐢𝐠𝐡𝐭',
    openTime: '8:45 PM',
    closeTime: '10:45 PM',
  },
  {
    id: 'star-kalyan-night',
    name: '𝐒𝐭𝐚𝐫 𝐊𝐚𝐥𝐲𝐚𝐧 𝐍𝐢𝐠𝐡𝐭',
    openTime: '9:15 PM',
    closeTime: '11:15 PM',
  },
  {
    id: 'time-bazar',
    name: '𝐓𝐢𝐦𝐞 𝐁𝐚𝐳𝐚𝐫',
    openTime: '12:40 PM',
    closeTime: '2:55 PM',
  },
];

export const winHistory: WinHistory[] = [
  { id: '1', gameName: '𝐌𝐢𝐥𝐚𝐧 𝐍𝐢𝐠𝐡𝐭', date: '2024-07-28', winningNumbers: '123-69-450' },
  { id: '2', gameName: '𝐊𝐚𝐥𝐲𝐚𝐧 𝐌𝐚𝐢𝐧 𝐁𝐚𝐳𝐚𝐫', date: '2024-07-28', winningNumbers: '445-31-155' },
  { id: '3', gameName: '𝐌𝐢𝐥𝐚𝐧 𝐃𝐚𝐲', date: '2024-07-28', winningNumbers: '248-46-790' },
  { id: '4', gameName: '𝐑𝐚𝐣𝐝𝐡𝐚𝐧𝐢 𝐍𝐢𝐠𝐡𝐭', date: '2024-07-27', winningNumbers: '579-13-670' },
  { id: '5', gameName: '𝐓𝐢𝐦𝐞 𝐁𝐚𝐳𝐚𝐫 𝐃𝐚𝐲', date: '2024-07-27', winningNumbers: '360-99-450' },
];

export const bidHistory: BidHistory[] = [
  { id: '1', gameName: '𝐌𝐢𝐥𝐚𝐧 𝐍𝐢𝐠𝐡𝐭', date: '2024-07-28', bidType: 'Single Pana', numbers: '123', points: 20, status: 'Win' },
  { id: '2', gameName: '𝐌𝐢𝐥𝐚𝐧 𝐍𝐢𝐠𝐡𝐭', date: '2024-07-28', bidType: 'Jodi Digit', numbers: '68', points: 10, status: 'Loss' },
  { id: '3', gameName: '𝐊𝐚𝐥𝐲𝐚𝐧 𝐌𝐚𝐢𝐧 𝐁𝐚𝐳𝐚𝐫', date: '2024-07-28', bidType: 'Single Digit', numbers: '5', points: 50, status: 'Loss' },
  { id: '4', gameName: '𝐌𝐢𝐥𝐚𝐧 𝐃𝐚𝐲', date: '2024-07-27', bidType: 'Double Pana', numbers: '790', points: 15, status: 'Win' },
  { id: '5', gameName: '𝐑𝐚𝐣𝐝𝐡𝐚𝐧𝐢 𝐍𝐢𝐠𝐡𝐭', date: '2024-07-27', bidType: 'Jodi Digit', numbers: '13', points: 10, status: 'Win' },
];

export const chartData: ChartData[] = [
  {
    name: '𝐊𝐚𝐥𝐲𝐚𝐧 𝐌𝐨𝐫𝐧𝐢𝐧𝐠 𝐂𝐡𝐚𝐫𝐭',
    data: [
      { date: 'Jul 22', value: 25 },
      { date: 'Jul 23', value: 48 },
      { date: 'Jul 24', value: 12 },
      { date: 'Jul 25', value: 78 },
      { date: 'Jul 26', value: 56 },
      { date: 'Jul 27', value: 34 },
      { date: 'Jul 28', value: 90 },
    ],
  },
  {
    name: '𝐌𝐢𝐥𝐚𝐧 𝐃𝐚𝐲 𝐂𝐡𝐚𝐫𝐭',
    data: [
      { date: 'Jul 22', value: 88 },
      { date: 'Jul 23', value: 15 },
      { date: 'Jul 24', value: 62 },
      { date: 'Jul 25', value: 33 },
      { date: 'Jul 26', value: 71 },
      { date: 'Jul 27', value: 45 },
      { date: 'Jul 28', value: 19 },
    ],
  },
  {
    name: '𝐑𝐚𝐣𝐝𝐡𝐚𝐧𝐢 𝐍𝐢𝐠𝐡𝐭 𝐂𝐡𝐚𝐫𝐭',
    data: [
      { date: 'Jul 22', value: 42 },
      { date: 'Jul 23', value: 5 },
      { date: 'Jul 24', value: 99 },
      { date: 'Jul 25', value: 27 },
      { date: 'Jul 26', value: 81 },
      { date: 'Jul 27', value: 60 },
      { date: 'Jul 28', value: 53 },
    ],
  },
  {
    name: '𝐌𝐚𝐢𝐧 𝐁𝐚𝐳𝐚𝐫 𝐃𝐚𝐲 𝐂𝐡𝐚𝐫𝐭',
    data: [
      { date: 'Jul 22', value: 11 },
      { date: 'Jul 23', value: 30 },
      { date: 'Jul 24', value: 58 },
      { date: 'Jul 25', value: 22 },
      { date: 'Jul 26', value: 67 },
      { date: 'Jul 27', value: 84 },
      { date: 'Jul 28', value: 40 },
    ],
  },
];
