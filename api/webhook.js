import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const getPeriodEnd = (subscription) => {
  const fromItem = subscription.items?.data?.[0]?.current_period_end;
  const fromTop = subscription.current_period_end;
  const timestamp = fromItem ?? fromTop;
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const subscription = await stripe.subscriptions.retrieve(session.subscription);

    await supabase.from('subscriptions').upsert({
      user_id: session.client_reference_id,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      current_period_end: getPeriodEnd(subscription),
    }, { onConflict: 'user_id' });
  }

  if (
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data.object;

    // Use UPDATE not upsert — only touch rows that already exist
    await supabase.from('subscriptions')
      .update({
        status: subscription.status,
        current_period_end: getPeriodEnd(subscription),
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  res.json({ received: true });
}
