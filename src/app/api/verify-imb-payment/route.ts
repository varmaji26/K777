// src/app/api/verify-imb-payment/route.ts
// Polls IMB's check_link to verify payment status (fallback if webhook doesn't fire)

import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('order_id');

    if (!orderId) {
        return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    try {
        const db = admin.firestore();
        const depositRef = db.collection('deposits').doc(orderId);
        const depositDoc = await depositRef.get();

        if (!depositDoc.exists) {
            return NextResponse.json({ status: 'not_found' }, { status: 404 });
        }

        const deposit = depositDoc.data()!;

        // If already approved, return immediately
        if (deposit.status === 'approved') {
            return NextResponse.json({ status: 'approved' });
        }

        // If we have a check_link, poll IMB directly to enable "Instant" claim
        if (deposit.checkLink) {
            try {
                console.log('Polling IMB check_link for instant verification:', deposit.checkLink);
                
                const imbResponse = await fetch(deposit.checkLink, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { 'Accept': 'application/json' }
                });

                const imbData = await imbResponse.text();
                console.log('IMB check_link response raw:', imbData);

                // Check for various success patterns in IMB's response
                const isPaid = 
                    imbData.toUpperCase().includes('SUCCESS') || 
                    imbData.toUpperCase().includes('COMPLETED') || 
                    imbData.toUpperCase().includes('PAID') ||
                    (imbData.includes('"status":true') || imbData.includes('"status": "true"'));

                if (isPaid) {
                    console.log('IMB Confirms PAID! Proceeding with auto-approval for:', orderId);

                    // --- AUTOMATIC APPROVAL LOGIC ---
                    await db.runTransaction(async (transaction) => {
                        const freshDeposit = await transaction.get(depositRef);
                        
                        // Idempotency check
                        if (freshDeposit.data()?.status === 'approved') {
                            return;
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

                        // 1. Update user balance instantly
                        transaction.update(userRef, { balance: newBalance });

                        // 2. Mark deposit as approved
                        transaction.update(depositRef, {
                            status: 'approved',
                            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                            approvedVia: 'polling_verification',
                        });

                        // 3. Log the successful transaction
                        const txQuery = await db.collection('transactions')
                            .where('relatedId', '==', orderId)
                            .limit(1)
                            .get();

                        if (!txQuery.empty) {
                            transaction.update(txQuery.docs[0].ref, {
                                status: 'approved',
                                description: `Deposit of ₹${amount} approved automatically.`,
                                balanceBefore: currentBalance,
                                balanceAfter: newBalance,
                                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                        }
                    });

                    return NextResponse.json({ status: 'approved' });
                }
            } catch (pollError) {
                console.error('Error during auto-verification poll:', pollError);
            }
        }

        // Return current status if not yet approved
        return NextResponse.json({ status: deposit.status });

    } catch (error: any) {
        console.error('Verify API internal error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
