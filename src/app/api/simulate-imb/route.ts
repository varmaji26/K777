// import { NextResponse } from 'next/server';

// export async function POST(req: Request) {
//     try {
//         const body = await req.json();
//         const { order_id, amount, redirect_url } = body;

//         console.log("SIMULATE: Received payment request for order", order_id);

//         // We simulate a successful payment locally by calling our own webhook
//         const webhookUrl = new URL('/api/imb-webhook', req.url).toString();

//         // Don't await this, let it run in the background to simulate async gateway action
//         setTimeout(async () => {
//             console.log("SIMULATE: Firing success webhook to", webhookUrl);
//             try {
//                 await fetch(webhookUrl, {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({
//                         status: "SUCCESS",
//                         order_id: order_id,
//                         message: "Transaction Successfully",
//                         result: {
//                             txnStatus: "COMPLETED",
//                             amount: amount,
//                             date: new Date().toISOString()
//                         }
//                     })
//                 });
//                 console.log("SIMULATE: Webhook fired successfully");
//             } catch (err) {
//                 console.error("SIMULATE: Failed to fire webhook", err);
//             }
//         }, 3000); // simulate 3 seconds of user paying

//         return NextResponse.json({
//             success: true,
//             payment_url: redirect_url || '/',
//             message: "Simulated payment intent created"
//         });

//     } catch (e) {
//         return NextResponse.json({ error: 'Simulation error' }, { status: 500 });
//     }
// }

// src/app/api/simulate-imb/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.text();
        console.log('Simulate IMB received:', body);

        const params = new URLSearchParams(body);
        const orderId = params.get('order_id');
        const amount = params.get('amount');
        const mobile = params.get('customer_mobile');
        const redirectUrl = params.get('redirect_url');

        if (!orderId || !amount || !mobile) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // ✅ Fire webhook in background (simulates real gateway calling your webhook)
        const webhookUrl = new URL('/api/imb-webhook', req.url).toString();
        
        setTimeout(async () => {
            console.log('SIMULATE: Firing webhook to', webhookUrl);
            try {
                const res = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'SUCCESS',
                        order_id: orderId,
                        amount: amount,
                        message: 'Transaction Successfully',
                    }),
                });
                console.log('SIMULATE: Webhook response:', res.status);
            } catch (err) {
                console.error('SIMULATE: Webhook failed', err);
            }
        }, 2000); // 2s delay = simulates user completing payment

        // ✅ Use the redirect_url from the request, fallback to payment-success
        const paymentUrl = `http://localhost:3001/imb-gateway?order_id=${orderId}&amount=${amount}`;

        return NextResponse.json({
            status: true,
            result: { payment_url: paymentUrl, order_id: orderId },
            message: 'Payment order created successfully'
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Simulation error' }, { status: 500 });
    }
}