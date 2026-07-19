import Stripe from 'stripe';
import { verifyCaller } from './_supabase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId } = req.body;
  if (!(await verifyCaller(req, userId))) {
    return res.status(401).json({ error: 'Not authenticated as this user' });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: 'price_1TIc6W2eafY6s4vclC8SYyDX', quantity: 1 }],
    mode: 'subscription',
    client_reference_id: userId,
    success_url: `${process.env.NEXT_PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/cancel`,
  });

  res.json({ url: session.url });
}
