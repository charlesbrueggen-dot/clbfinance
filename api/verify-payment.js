import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  res.setHeader('Content-Type', 'application/json');

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let sessionId = req.body?.sessionId;
    if (!sessionId) {
      const raw = await new Promise((resolve, reject) => {
        let d = '';
        req.on('data', c => (d += c));
        req.on('end', () => resolve(d));
        req.on('error', reject);
      });
      try { sessionId = JSON.parse(raw).sessionId; } catch {}
    }

    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: `Not paid: ${session.payment_status}` });
    }

    const userId = session.client_reference_id;
    if (!userId) return res.status(400).json({ error: 'No user ID on session' });

    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const periodEnd =
      subscription.items?.data?.[0]?.current_period_end ??
      subscription.current_period_end;

    const { error: dbError } = await supabase.from('subscriptions').upsert({
      user_id: userId,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    }, { onConflict: 'user_id' });

    if (dbError) return res.status(500).json({ error: `DB: ${dbError.message}` });

    return res.json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
