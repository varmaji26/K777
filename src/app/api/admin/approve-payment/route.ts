// src/app/api/admin/approve-payment/route.ts
// Manual payment approval endpoint for admin use when IMB webhook fails
// IMPORTANT: Add proper authentication before using in production!

import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';

const ADMIN_KEY = process.env.ADMIN_APPROVAL_KEY || 'admin-secret-key-change-in-production';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { orderId, adminKey } = body;

        // Admin key validation - use environment variable
        if (adminKey !== ADMIN_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!orderId) {
            return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
        }

        const db = admin.firestore();
        const depositRef = db.collection('deposits').doc(orderId);

        await db.runTransaction(async (transaction) => {
            const depositDoc = await transaction.get(depositRef);

            if (!depositDoc.exists) {
                throw new Error(`Deposit ${orderId} not found`);
            }

            const deposit = depositDoc.data()!;

            if (deposit.status === 'approved') {
                throw new Error('Already approved');
            }

            const userId = deposit.userId;
            const amount = deposit.amount;

            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error(`User ${userId} not found`);
            }

            const currentBalance = userDoc.data()?.balance || 0;
            const newBalance = currentBalance + amount;

            // Update user balance
            transaction.update(userRef, { balance: newBalance });

            // Mark deposit as approved
            transaction.update(depositRef, {
                status: 'approved',
                approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                approvedVia: 'manual_admin',
            });

            // Update transaction log
            const txQuery = await db.collection('transactions')
                .where('relatedId', '==', orderId)
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

            console.log(`✅ Manual approval: ${userId} → ₹${newBalance}`);
        });

        return NextResponse.json({ success: true, message: 'Payment approved manually' });

    } catch (error: any) {
        console.error('Manual approval error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
