import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Game } from './types';
import { useGameStore } from './store';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(timeString: string) {
  if (!timeString || !timeString.includes(':')) {
    return 'N/A';
  }
  
  const cleanTime = timeString.trim();

  // If it already has AM/PM, it's already formatted
  if (cleanTime.toUpperCase().includes('AM') || cleanTime.toUpperCase().includes('PM')) {
    return cleanTime;
  }

  const parts = cleanTime.split(':');
  if (parts.length < 2) return 'N/A';

  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes)) return 'N/A';

  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');

  return `${displayHours}:${displayMinutes} ${ampm}`;
}


export const parseTime = (timeString: string) => {
  if (!timeString) return { hours: 0, minutes: 0};
  
  const cleanTime = timeString.trim().toUpperCase();
  const is12Hour = cleanTime.includes('AM') || cleanTime.includes('PM');
  
  if (is12Hour) {
    const [time, modifier] = cleanTime.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  } else {
    const [hours, minutes] = cleanTime.split(':').map(Number);
    return { hours: hours || 0, minutes: minutes || 0 };
  }
};

export const getGameTimestamps = (game: Game) => {
  const now = new Date();
  
  const { hours: openHours, minutes: openMinutes } = parseTime(game.openTime);
  const { hours: closeHours, minutes: closeMinutes } = parseTime(game.closeTime);

  const openTime = new Date(now);
  openTime.setHours(openHours, openMinutes, 0, 0);

  const closeTime = new Date(now);
  closeTime.setHours(closeHours, closeMinutes, 0, 0);

  if (closeTime.getTime() <= openTime.getTime()) {
    if (now.getTime() < closeTime.getTime()) {
      openTime.setDate(openTime.getDate() - 1);
    } 
    else {
      closeTime.setDate(closeTime.getDate() + 1);
    }
  }

  return { openTime, closeTime };
};

export function getGameRunningStatus(game: Game, marketOpenTimeStr: string): true | string {
    const now = new Date();
    const dayName = now.toLocaleString('en-US', { weekday: 'long' });

    if (game.active === false) {
        return "This game is temporarily unavailable.";
    }
    if (game.activeDays && game.activeDays.length > 0 && !game.activeDays.includes(dayName)) {
        return "Today is a holiday for this market.";
    }
    
    const { hours: marketOpenHours, minutes: marketOpenMinutes } = parseTime(marketOpenTimeStr);
    const marketOpenTime = new Date(now);
    marketOpenTime.setHours(marketOpenHours, marketOpenMinutes, 0, 0);

    if (now < marketOpenTime) {
        return `The market opens at ${formatTime(marketOpenTimeStr)}.`;
    }

    const { openTime, closeTime } = getGameTimestamps(game);
    const isOpenSessionAvailable = now.getTime() < openTime.getTime();
    const isCloseSessionAvailable = now.getTime() >= openTime.getTime() && now.getTime() < closeTime.getTime();
    
    if (isOpenSessionAvailable || isCloseSessionAvailable) {
        return true;
    }

    return "Bidding is currently closed for this market.";
};


export const isGameRunning = (game: Game, marketOpenTimeStr: string): boolean => {
    return getGameRunningStatus(game, marketOpenTimeStr) === true;
}

export const getSessionStatus = (game: Game, marketOpenTimeStr: string, session: 'Open' | 'Close'): boolean => {
    const overallStatus = getGameRunningStatus(game, marketOpenTimeStr);
    if (overallStatus !== true) return false;

    const now = new Date();
    const { openTime, closeTime } = getGameTimestamps(game);

    if (session === 'Open') {
        return now.getTime() < openTime.getTime();
    } else {
        return now.getTime() >= openTime.getTime() && now.getTime() < closeTime.getTime();
    }
};
