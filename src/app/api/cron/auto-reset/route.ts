import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

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

export async function GET(request: Request) {
    try {
        const db = admin.firestore();
        const appSettingsDocRef = db.collection('settings').doc('app-settings');
        const appSettingsDocSnap = await appSettingsDocRef.get();

        if (!appSettingsDocSnap.exists) return NextResponse.json({ message: "Settings not found." });

        const settings = appSettingsDocSnap.data() || {};
        if (!settings.autoResetEnabled || !settings.autoResetTime) return NextResponse.json({ message: "Auto-reset not enabled." });

        const resetTime = parseTime(settings.autoResetTime);
        if (!resetTime) return NextResponse.json({ error: "Invalid time format" }, { status: 400 });
        
        const nowIST = getISTDate();
        const lastResetTimestamp = settings.lastAutoResetDate as admin.firestore.Timestamp | undefined;
        const lastResetDay = lastResetTimestamp ? getISTDate().toISOString().split('T')[0] : '';
        const currentDay = nowIST.toISOString().split('T')[0];

        const resetTimeTodayMins = resetTime.hours * 60 + resetTime.minutes;
        const nowMins = nowIST.getHours() * 60 + nowIST.getMinutes();

        if (nowMins >= resetTimeTodayMins && lastResetDay !== currentDay) {
            console.log("Executing Global Daily Reset...");

            const batch = db.batch();

            // 1. Reset Main Markets
            const gamesSnapshot = await db.collection('games').get();
            gamesSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { result: '***-**-***', openResult: '***', closeResult: '**' });
            });

            // 2. Reset Starline Slots
            const starlineSnapshot = await db.collection('starlineGames').get();
            starlineSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { panna: '***', digit: '*', status: 'running' });
            });

            // 3. Reset Jackpot Slots
            const jackpotSnapshot = await db.collection('jackpotGames').get();
            jackpotSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { result: '**', status: 'running' });
            });
            
            // Update last reset date
            batch.update(appSettingsDocRef, { lastAutoResetDate: admin.firestore.Timestamp.fromDate(new Date()) });

            await batch.commit();
            return NextResponse.json({ message: "Reset executed for all games." });
        }

        return NextResponse.json({ message: "Not time to reset yet." });

    } catch (error: any) {
        console.error("Error in reset cron job:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
