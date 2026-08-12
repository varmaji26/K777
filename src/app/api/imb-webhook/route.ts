// src/app/api/imb-webhook/route.ts
// IMB calls this URL after user completes (or fails) a payment.
// Configure this URL in IMB Dashboard → Webhook tab.

import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        // IMB may send JSON or form-urlencoded — handle both
        const contentType = req.headers.get('content-type') || '';
        let status: string = '';
        let order_id: string = '';

        if (contentType.includes('application/json')) {
            const body = await req.json();
            console.log('Webhook received (JSON):', body);
            status = body.status;
            order_id = body.order_id;
        } else {
            const text = await req.text();
            console.log('Webhook received (form-urlencoded):', text);
            const params = new URLSearchParams(text);
            status = params.get('status') || '';
            order_id = params.get('order_id') || '';
        }

        console.log('Webhook parsed:', { status, order_id });

        if (!order_id) {
            return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
        }

        const db = admin.firestore();
        const depositRef = db.collection('deposits').doc(order_id);

        if (status === 'SUCCESS' || status === 'COMPLETED') {
            // --- Process successful payment atomically ---
            await db.runTransaction(async (transaction) => {
                const depositDoc = await transaction.get(depositRef);

                if (!depositDoc.exists) {
                    throw new Error(`Deposit ${order_id} not found`);
                }

                const deposit = depositDoc.data()!;

                // Idempotency — don't process the same payment twice
                if (deposit.status === 'approved') {
                    console.log('Already processed:', order_id);
                    return;
                }

                const userId = deposit.userId;
                const amount = deposit.amount; // Trust OUR Firestore record, not webhook payload

                const userRef = db.collection('users').doc(userId);
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists) {
                    throw new Error(`User ${userId} not found`);
                }

                const currentBalance = userDoc.data()?.balance || 0;
                const newBalance = currentBalance + amount;

                // 1. Update user balance
                transaction.update(userRef, { balance: newBalance });

                // 2. Mark deposit as approved
                transaction.update(depositRef, {
                    status: 'approved',
                    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                // 3. Update the pending transaction log
                const txQuery = await db.collection('transactions')
                    .where('relatedId', '==', order_id)
                    .limit(1)
                    .get();

                if (!txQuery.empty) {
                    transaction.update(txQuery.docs[0].ref, {
                        status: 'success',
                        balanceBefore: currentBalance,
                        balanceAfter: newBalance,
                        completedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }

                console.log(`✅ Balance updated: ${userId} → ₹${newBalance}`);
            });

            return NextResponse.json({ success: true, message: 'Payment processed' });

        } else if (status === 'FAILED' || status === 'ERROR') {
            // --- Mark deposit as failed ---
            await depositRef.update({
                status: 'failed',
                failedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`❌ Payment failed for order: ${order_id}`);
            return NextResponse.json({ success: true, message: 'Marked as failed' });

        } else {
            // Unknown status — acknowledge but don't act
            console.log(`⚠️ Unknown webhook status: ${status} for order: ${order_id}`);
            return NextResponse.json({ success: true, message: 'Status acknowledged' });
        }

    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}