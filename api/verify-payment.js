import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const getBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = req.body && req.body.sessionId ? req.body : await getBody(req);
    const { sessionId } = body;

    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: `Payment status: ${session.payment_status}` });
    }

    const userId = session.client_reference_id;
    if (!userId) return res.status(400).json({ error: 'No user ID on session - checkout.js may not be passing userId' });

    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const periodEnd =
      subscription.items?.data?.[0]?.current_period_end ??
      subscription.current_period_end;

    const { error } = await supabase.from('subscriptions').upsert({
      user_id: userId,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    }, { onConflict: 'user_id' });

    if (error) return res.status(500).json({ error: `Supabase: ${error.message}` });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
