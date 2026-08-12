import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('order_id');

    if (!orderId) {
        return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    const db = admin.firestore();
    const depositDoc = await db.collection('deposits').doc(orderId).get();

    if (!depositDoc.exists) {
        return NextResponse.json({ status: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ status: depositDoc.data()?.status });
}