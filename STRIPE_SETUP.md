# Stripe Payment System Setup Guide

## Overview
Fizz uses Stripe for subscription payments. The payment system is fully implemented and functional, but requires Stripe configuration to work properly.

## Setup Requirements

### 1. Stripe Account
- Create a Stripe account at https://stripe.com
- You'll need both **Test mode** (for development) and **Live mode** (for production) configurations

### 2. Environment Variables

Add these secrets to your Replit environment:

#### Development/Test Mode
```
STRIPE_SECRET_KEY=sk_test_...              (Test Secret Key)
VITE_STRIPE_PUBLIC_KEY=pk_test_...         (Test Publishable Key)
TESTING_STRIPE_SECRET_KEY=sk_test_...      (Same as above, for test runs)
TESTING_VITE_STRIPE_PUBLIC_KEY=pk_test_... (Same as above, for test runs)
```

#### Production Mode
```
STRIPE_SECRET_KEY=sk_live_...              (Live Secret Key)
VITE_STRIPE_PUBLIC_KEY=pk_live_...         (Live Publishable Key)
```

**Note:** The system auto-detects and corrects if secret/publishable keys are swapped.

### 3. Create Products and Prices in Stripe

#### Step 1: Create Products
Go to https://dashboard.stripe.com/products and create:

1. **Fizz Plus**
   - Name: "Fizz Plus"
   - Description: "Access to all 8 AI personas, custom personas, and advanced features"
   - Pricing: $4.99/month (recurring)

2. **Fizz Pro**
   - Name: "Fizz Pro"
   - Description: "Everything in Plus, plus extended context, API access, and priority support"
   - Pricing: $14.99/month (recurring)

#### Step 2: Copy Price IDs
After creating products, copy the **Price IDs** (they start with `price_`):
- Plus Price ID: `price_xxxxxxxxxxxxxxxxxxxxx`
- Pro Price ID: `price_xxxxxxxxxxxxxxxxxxxxx`

#### Step 3: Update Code
Update the price IDs in `server/routes.ts` (around line 1394):

```typescript
const priceId = plan === 'Plus' 
  ? 'price_1SVOap4ZvMd9Y1Q0QvuL48Fe'   // Fizz Plus - $4.99/month
  : 'price_1SVOaz4ZvMd9Y1Q07ONU4ytg';  // Fizz Pro - $14.99/month
```

**Current Configuration (Test Mode):**
- Fizz Plus: `price_1SVOap4ZvMd9Y1Q0QvuL48Fe` ($4.99/month)
- Fizz Pro: `price_1SVOaz4ZvMd9Y1Q07ONU4ytg` ($14.99/month)
- Account: Fizz AI (Test Mode)

### 4. Configure Webhooks (Production)

For production deployments, configure Stripe webhooks:

1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://your-domain.replit.app/api/stripe/webhook`
3. Select events to listen to:
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret
5. Add to environment: `STRIPE_WEBHOOK_SECRET=whsec_...`

## Payment Flow

1. User clicks "Start Plus" or "Go Pro" on pricing page
2. Redirects to `/subscribe?plan={Plus|Pro}`
3. Creates Stripe checkout session with correct price ID
4. User completes payment on Stripe Checkout
5. Stripe redirects back to success URL
6. Webhook updates user plan in database
7. User gains access to premium features

## Features Implemented

✅ Stripe Checkout integration
✅ Subscription management via Customer Portal
✅ Webhook handling for subscription updates
✅ Auto-detection and correction of swapped API keys
✅ Support for both test and live modes
✅ Secure session management
✅ Error handling and user feedback

## Testing

To test payments in development:
1. Use Stripe test mode keys
2. Create test products/prices in Stripe Dashboard (test mode)
3. Use Stripe test cards: https://stripe.com/docs/testing
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`

## Troubleshooting

### "No such price" error
**Symptoms:** Debug endpoint shows "No such price" or 0 products/prices synced

**Causes:**
1. API keys are from a different Stripe account than where products were created
2. Price IDs in code don't match Stripe dashboard

**Solution:**
1. Go to https://dashboard.stripe.com/test/products - verify products exist
2. **Without closing that tab**, open https://dashboard.stripe.com/test/apikeys in a new tab
3. Verify BOTH tabs show the same account name in top-left corner
4. Copy API keys from the second tab:
   - Publishable key (pk_test_...) → VITE_STRIPE_PUBLIC_KEY + TESTING_VITE_STRIPE_PUBLIC_KEY
   - Secret key (sk_test_...) → STRIPE_SECRET_KEY + TESTING_STRIPE_SECRET_KEY
5. Restart application and verify with `/api/debug/stripe-products` endpoint

### "secret_key_required" error
**Symptoms:** "This API call cannot be made with a publishable API key"

**Cause:** Publishable key (pk_test_) was entered in STRIPE_SECRET_KEY instead of secret key (sk_test_)

**Solution:** 
- Verify STRIPE_SECRET_KEY contains a key starting with `sk_test_` (not `pk_test_`)
- Verify VITE_STRIPE_PUBLIC_KEY contains a key starting with `pk_test_`

### Keys are swapped
**Symptoms:** Log shows "Stripe keys are swapped in environment - auto-correcting"

**Info:** System auto-detects and corrects swapped keys. No action needed unless errors persist.

### Webhook not receiving events
- Webhook secret not configured
- Solution: Add `STRIPE_WEBHOOK_SECRET` to environment variables

## Production Deployment

### Live Mode Configuration (Ready to Deploy)

**Live Price IDs:**
- Fizz Plus ($4.99/month): `price_1SVOt04ZvMd9Y1Q0O3BtIgtG`
- Fizz Pro ($14.99/month): `price_1SVOsz4ZvMd9Y1Q0TGT9Vcaa`

**Live API Keys:**
- Publishable Key: `pk_live_51SVHLx4ZvMd9Y1Q0CZ4qg3sVW7MRMcPOdVA0pWOST8V8sMKe0o5eOuVGMo1ql3wbELLRZHe0EQjTEUmh`
- Secret Key: **Required** - Add `sk_live_...` to Replit Secrets as `STRIPE_SECRET_KEY`

### Deployment Steps

1. **Add Live Secret Key to Replit Secrets:**
   ```
   STRIPE_SECRET_KEY=sk_live_...  (Get from https://dashboard.stripe.com/apikeys)
   VITE_STRIPE_PUBLIC_KEY=pk_live_51SVHLx4ZvMd9Y1Q0CZ4qg3sVW7MRMcPOdVA0pWOST8V8sMKe0o5eOuVGMo1ql3wbELLRZHe0EQjTEUmh
   ```

2. **Update Price IDs in Code:**
   The live price IDs are ready to be deployed to `server/routes.ts`

3. **Configure Webhook (After Deployment):**
   - Add endpoint: `https://fizzai.net/api/stripe/webhook`
   - Select events: `customer.subscription.updated`, `customer.subscription.deleted`
   - Add webhook secret to: `STRIPE_WEBHOOK_SECRET=whsec_...`

4. **Verify Deployment:**
   - Visit `/api/debug/stripe-products` to confirm 2 products and 2 prices sync
   - Test checkout flow with live card
   - Verify subscription appears in Stripe dashboard

## Production Checklist

Before deploying to production:
- [x] Create live mode products and prices
- [x] Collect live price IDs
- [x] Collect live publishable key
- [ ] Add live secret key to Replit Secrets
- [ ] Update price IDs in code
- [ ] Deploy and verify with debug endpoint
- [ ] Configure webhook endpoint with live mode secret
- [ ] Test complete payment flow
- [ ] Verify subscription updates work via webhook
- [ ] Test customer portal access

## Support

For Stripe-specific questions, refer to:
- Stripe Documentation: https://stripe.com/docs
- Stripe API Reference: https://stripe.com/docs/api
- Stripe Testing Guide: https://stripe.com/docs/testing
