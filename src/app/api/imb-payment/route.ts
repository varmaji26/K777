import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { amount, userId, mobile, displayName, origin } = body;

        if (!amount || !userId || !mobile) {
            return NextResponse.json(
                { error: 'Missing required fields: amount, userId, mobile' },
                { status: 400 }
            );
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return NextResponse.json(
                { error: 'Amount must be a positive number' },
                { status: 400 }
            );
        }

        const orderId = `DEP_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        console.log('Processing deposit request:', { orderId, userId, amount: parsedAmount, mobile });

        // --- Fetch Admin Settings ---
        const db = admin.firestore();
        const settingsDoc = await db.collection('settings').doc('app-settings').get();
        const settings = settingsDoc.data() || {};

        const IMB_API_TOKEN = settings.imbToken || '8de24b146a5d4992b3ddc3f8b24432cf';
        let IMB_BASE_URL = settings.imbUrl || 'https://secure-stage.imb.org.in/api/create-order';

        // Ensure URL is complete
        if (!IMB_BASE_URL.includes('/api/create-order')) {
            IMB_BASE_URL = IMB_BASE_URL.replace(/\/$/, '') + '/api/create-order';
        }

        // --- Create records in Firestore ---
        const depositRef = db.collection('deposits').doc(orderId);
        await depositRef.set({
            userId,
            displayName: displayName || 'User',
            mobile,
            amount: parsedAmount,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentMethod: 'IMB Gateway',
            transactionId: orderId,
        });

        await db.collection('transactions').add({
            userId,
            userName: displayName || 'User',
            amount: parsedAmount,
            type: 'deposit',
            status: 'pending',
            description: 'Deposit initiated via IMB Gateway',
            balanceBefore: 0,
            balanceAfter: 0,
            relatedId: orderId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // --- BASE URL DETECTION ---
        const host = req.headers.get('host') || 'localhost:3000';
        const protocol = req.headers.get('x-forwarded-proto') || 'http';
        const baseUrl = origin || `${protocol}://${host}`;
        
        const successRedirect = `${baseUrl}/payment-success?order_id=${orderId}`;
        const webhookUrl = `${baseUrl}/api/imb-webhook`;

        console.log('Calling IMB Gateway:', IMB_BASE_URL);

        // --- Use Form Data (x-www-form-urlencoded) for better compatibility ---
        const params = new URLSearchParams();
        params.append('user_token', IMB_API_TOKEN);
        params.append('amount', parsedAmount.toString());
        params.append('order_id', orderId);
        params.append('customer_name', displayName || 'Customer');
        params.append('customer_mobile', mobile.toString());
        params.append('redirect_url', successRedirect);
        params.append('callback_url', webhookUrl);

        const response = await fetch(IMB_BASE_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
            cache: 'no-store',
        });

        const data = await response.json();
        console.log('IMB Gateway Response:', data);

        if (data.status === true || data.status === 'true' || data.success === true) {
            const paymentUrl = data.result?.payment_url || data.payment_url;
            const checkLink = data.result?.check_link || data.check_link;

            if (checkLink) {
                await depositRef.update({ checkLink });
            }

            return NextResponse.json({
                success: true,
                payment_url: paymentUrl,
                orderId
            });
        } else {
            console.error('IMB Gateway Error:', data);
            return NextResponse.json(
                { error: data.message || 'Failed to create payment order' },
                { status: 400 }
            );
        }
    } catch (error: any) {
        console.error('Error initiating IMB payment:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
