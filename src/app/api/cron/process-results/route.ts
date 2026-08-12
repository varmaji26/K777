import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// Helper to get current time in IST
const getISTDate = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istOffset = 5.5 * 60 * 60000;
    return new Date(utc + istOffset);
};

const parseTime = (timeString: string) => {
    if (!timeString) return null;
    const match = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;

    let [_, hoursStr, minutesStr, modifier] = match;
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    
    return { hours, minutes };
};

// --- Panna Maps ---
const allSinglePanas: Record<string, string[]> = {
    '1': ['128', '137', '146', '236', '245', '290', '380', '470', '489', '560', '678', '579'],
    '2': ['129', '138', '147', '156', '237', '246', '345', '390', '480', '570', '589', '679'],
    '3': ['120', '139', '148', '157', '238', '247', '256', '346', '490', '580', '670', '689'],
    '4': ['130', '149', '158', '167', '239', '248', '257', '347', '356', '590', '680', '789'],
    '5': ['140', '159', '168', '230', '249', '258', '267', '348', '357', '456', '690', '780'],
    '6': ['123', '150', '169', '178', '240', '259', '268', '349', '358', '367', '457', '790'],
    '7': ['124', '160', '179', '250', '269', '278', '340', '359', '368', '458', '467', '890'],
    '8': ['125', '134', '170', '189', '260', '279', '350', '369', '378', '459', '468', '567'],
    '9': ['126', '135', '180', '234', '270', '289', '360', '379', '450', '469', '478', '568'],
    '0': ['127', '136', '145', '190', '235', '280', '370', '389', '460', '479', '569', '578'],
};

const allDoublePanas: Record<string, string[]> = {
    '1': ['100', '119', '155', '227', '335', '344', '399', '588', '669'],
    '2': ['110', '200', '228', '255', '336', '499', '660', '688', '778'],
    '3': ['166', '229', '300', '337', '355', '445', '599', '779', '788'],
    '4': ['112', '220', '266', '338', '400', '446', '455', '699', '770'],
    '5': ['113', '122', '177', '339', '366', '447', '500', '799', '889'],
    '6': ['114', '277', '330', '448', '466', '556', '600', '880', '899'],
    '7': ['115', '133', '188', '223', '377', '449', '557', '566', '700'],
    '8': ['116', '224', '233', '288', '440', '477', '558', '800', '990'],
    '9': ['117', '144', '199', '225', '388', '559', '577', '667', '900'],
    '0': ['118', '226', '244', '299', '334', '488', '550', '668', '677'],
};

const allTriplePanas: Record<string, string[]> = {
    '0': ['000'], '1': ['777'], '2': ['444'], '3': ['111'], '4': ['888'],
    '5': ['555'], '6': ['222'], '7': ['999'], '8': ['666'], '9': ['333'],
};

export async function GET() {
    try {
        const db = admin.firestore();
        const settingsSnap = await db.collection('settings').doc('app-settings').get();
        const settings = settingsSnap.data() || {};

        if (!settings.autoResultEnabled) {
            return NextResponse.json({ message: "Auto Result not enabled in settings" });
        }

        const nowIST = getISTDate();
        const nowTotalMins = nowIST.getHours() * 60 + nowIST.getMinutes();
        
        console.log(`Cron triggered at ${nowIST.toLocaleTimeString()} IST`);

        // --- 1. Process Starline Games ---
        const starlineSnap = await db.collection('starlineGames').where('status', '==', 'running').get();
        
        for (const gameDoc of starlineSnap.docs) {
            const game = gameDoc.data();
            const slotTime = parseTime(game.time);
            if (!slotTime) continue;

            const slotTotalMins = slotTime.hours * 60 + slotTime.minutes;
            
            if (nowTotalMins >= slotTotalMins + 5) {
                console.log(`Processing Starline Result for ${game.time}`);
                
                const bidsSnap = await db.collection('bids')
                    .where('gameId', '==', gameDoc.id)
                    .where('status', '==', 'running')
                    .get();

                const digitLoad: Record<string, number> = {};
                const pannaLoad: Record<string, number> = {};
                for (let i = 0; i <= 9; i++) digitLoad[i.toString()] = 0;

                bidsSnap.forEach(bDoc => {
                    const bid = bDoc.data();
                    const amountPerNum = bid.totalAmount / (bid.numbers?.length || 1);
                    bid.numbers?.forEach((n: string) => {
                        pannaLoad[n] = (pannaLoad[n] || 0) + amountPerNum;
                        const digit = bid.betType === 'singleDigit' ? n : ((n || '').split('').reduce((a: number, b: string) => a + parseInt(b || '0'), 0) % 10).toString();
                        if (digitLoad[digit] !== undefined) digitLoad[digit] += amountPerNum;
                    });
                });

                // Pick digit with least load
                const minDigitLoad = Math.min(...Object.values(digitLoad));
                const digitCandidates = Object.keys(digitLoad).filter(d => digitLoad[d] === minDigitLoad);
                const winningDigit = digitCandidates[Math.floor(Math.random() * digitCandidates.length)];

                // Pick panna for that digit with least load
                const possiblePanas = [
                    ...(allSinglePanas[winningDigit] || []),
                    ...(allDoublePanas[winningDigit] || []),
                    ...(allTriplePanas[winningDigit] || [])
                ];
                
                let winningPanna = possiblePanas[0];
                let minPannaLoad = Infinity;

                possiblePanas.forEach(p => {
                    const load = pannaLoad[p] || 0;
                    if (load < minPannaLoad) {
                        minPannaLoad = load;
                        winningPanna = p;
                    }
                });

                await db.runTransaction(async (transaction) => {
                    transaction.update(gameDoc.ref, { panna: winningPanna, digit: winningDigit, status: 'closed' });

                    for (const bDoc of bidsSnap.docs) {
                        const bid = bDoc.data();
                        let won = false;
                        let multiplier = 0;

                        if (bid.betType === 'singleDigit' && bid.numbers.includes(winningDigit)) {
                            won = true;
                            multiplier = (settings.starlineRateSingleDigit || 100) / 10;
                        } else if (bid.numbers.includes(winningPanna)) {
                            won = true;
                            const rate = bid.betType === 'singlePana' ? (settings.starlineRateSinglePana || 1500) :
                                         bid.betType === 'doublePana' ? (settings.starlineRateDoublePana || 3000) :
                                         bid.betType === 'triplePana' ? (settings.starlineRateTriplePana || 7000) : 0;
                            multiplier = rate / 10;
                        }

                        if (won && multiplier > 0) {
                            const winAmount = (bid.totalAmount / (bid.numbers?.length || 1)) * multiplier;
                            const userRef = db.collection('users').doc(bid.userId);
                            transaction.update(userRef, { balance: admin.firestore.FieldValue.increment(winAmount) });
                            transaction.update(bDoc.ref, { status: 'won', winningAmount: winAmount });
                        } else {
                            transaction.update(bDoc.ref, { status: 'lost' });
                        }
                    }
                });
            }
        }

        // --- 2. Process Jackpot Games ---
        const jackpotSnap = await db.collection('jackpotGames').where('status', '==', 'running').get();
        
        for (const gameDoc of jackpotSnap.docs) {
            const game = gameDoc.data();
            const slotTime = parseTime(game.time);
            if (!slotTime) continue;

            const slotTotalMins = slotTime.hours * 60 + slotTime.minutes;

            if (nowTotalMins >= slotTotalMins + 5) {
                console.log(`Processing Jackpot Result for ${game.time}`);

                const bidsSnap = await db.collection('bids')
                    .where('gameId', '==', gameDoc.id)
                    .where('status', '==', 'running')
                    .get();

                const jodiLoad: Record<string, number> = {};
                for (let i = 0; i <= 99; i++) jodiLoad[i.toString().padStart(2, '0')] = 0;

                bidsSnap.forEach(bDoc => {
                    const bid = bDoc.data();
                    const amountPerNum = bid.totalAmount / (bid.numbers?.length || 1);
                    bid.numbers?.forEach((n: string) => {
                        if (jodiLoad[n] !== undefined) jodiLoad[n] += amountPerNum;
                    });
                });

                const minJodiLoad = Math.min(...Object.values(jodiLoad));
                const candidates = Object.keys(jodiLoad).filter(j => jodiLoad[j] === minJodiLoad);
                const winningJodi = candidates[Math.floor(Math.random() * candidates.length)];

                await db.runTransaction(async (transaction) => {
                    transaction.update(gameDoc.ref, { result: winningJodi, status: 'closed' });

                    for (const bDoc of bidsSnap.docs) {
                        const bid = bDoc.data();
                        if (bid.numbers?.includes(winningJodi)) {
                            const rate = settings.jackpotRateJodi || 1000;
                            const winAmount = (bid.totalAmount / (bid.numbers?.length || 1)) * (rate / 10);
                            const userRef = db.collection('users').doc(bid.userId);
                            transaction.update(userRef, { balance: admin.firestore.FieldValue.increment(winAmount) });
                            transaction.update(bDoc.ref, { status: 'won', winningAmount: winAmount });
                        } else {
                            transaction.update(bDoc.ref, { status: 'lost' });
                        }
                    }
                });
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Auto Result Cron Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
