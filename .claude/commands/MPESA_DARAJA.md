# M-Pesa Daraja Integration Guide

> This file covers everything the agent needs to implement M-Pesa STK Push correctly.
> Daraja has specific quirks that the agent will get wrong without this context.

---

## Overview of the payment flow

```
Customer taps "Pay via M-Pesa"
        ↓
Frontend calls POST /api/payments/mpesa/stk
        ↓
Backend generates access token from Daraja OAuth
        ↓
Backend sends STK Push request to Daraja
        ↓
Daraja sends a prompt to the customer's phone
        ↓
Customer enters their M-Pesa PIN
        ↓
Daraja sends a callback to POST /api/payments/mpesa/callback/:token
        ↓
Backend verifies callback, updates payment + job status
        ↓
Backend triggers notification (SMS/WhatsApp) to customer
        ↓
Frontend polls GET /api/jobs/:id or receives WebSocket event
```

---

## Environment variables needed

```env
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379                          # sandbox shortcode
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919  # sandbox passkey
MPESA_CALLBACK_TOKEN=<64 hex chars>             # secret path segment, see Step 4
MPESA_CALLBACK_URL=https://your-url.ngrok.io/api/payments/mpesa/callback/<MPESA_CALLBACK_TOKEN>
MPESA_ENVIRONMENT=sandbox                        # sandbox | production
MPESA_CALLBACK_IPS=                              # optional override of Safaricom's callback IPs
```

`MPESA_CALLBACK_URL` must end with the same token as `MPESA_CALLBACK_TOKEN`, or every callback is refused with 403.

**Sandbox base URLs:**
- Auth: `https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`
- STK Push: `https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest`
- STK Query: `https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query`

**Production base URLs** (same paths, different host):
- `https://api.safaricom.co.ke/...`

Use ConfigService to switch between environments:
```typescript
const baseUrl = this.config.get('MPESA_ENVIRONMENT') === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';
```

The Daraja host comes **only** from `MPESA_ENVIRONMENT` (OWASP API7, SSRF). Never build any part of an outbound URL (host, path or query) from request input. Request data goes in the JSON body only.

---

## Step 1 — Get access token

The access token expires in 1 hour. Cache it; do not request a new one for every payment.

```typescript
async getAccessToken(): Promise<string> {
  const key    = this.config.get('MPESA_CONSUMER_KEY');
  const secret = this.config.get('MPESA_CONSUMER_SECRET');
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');

  const baseUrl = this.getMpesaBaseUrl();
  const response = await axios.get(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } },
  );

  return response.data.access_token;
}
```

---

## Step 2 — Generate the password

The password is a base64 string of: `Shortcode + Passkey + Timestamp`
The timestamp format is: `YYYYMMDDHHmmss` (14 digits, no separators)

```typescript
generatePassword(): { password: string; timestamp: string } {
  const shortcode = this.config.get('MPESA_SHORTCODE');
  const passkey   = this.config.get('MPESA_PASSKEY');
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(0, 14);                           // → '20260527114500'

  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`)
    .toString('base64');

  return { password, timestamp };
}
```

This is the most common mistake agents make — wrong timestamp format or wrong concatenation order.

---

## Step 3 — Send STK Push

```typescript
async initiateStk(jobId: string, phone: string, amount: number) {
  const token             = await this.getAccessToken();
  const { password, timestamp } = this.generatePassword();
  const shortcode         = this.config.get('MPESA_SHORTCODE');
  const callbackUrl       = this.config.get('MPESA_CALLBACK_URL');
  const baseUrl           = this.getMpesaBaseUrl();

  // Phone must be in format 2547XXXXXXXX (no + sign, no leading 0)
  const formattedPhone = phone.replace(/^0/, '254').replace(/^\+/, '');

  const payload = {
    BusinessShortCode: shortcode,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   'CustomerPayBillOnline',
    Amount:            Math.ceil(amount),          // must be integer, round UP
    PartyA:            formattedPhone,
    PartyB:            shortcode,
    PhoneNumber:       formattedPhone,
    CallBackURL:       callbackUrl,
    AccountReference:  `PrintEase-${jobId}`,       // max 12 chars
    TransactionDesc:   'Print job payment',         // max 13 chars
  };

  const response = await axios.post(
    `${baseUrl}/mpesa/stkpush/v1/processrequest`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  // Save CheckoutRequestID to payments table — needed to match the callback
  return response.data;
  // response.data.CheckoutRequestID is the key field to save
}
```

**Important field limits:**
- `AccountReference`: max 12 characters
- `TransactionDesc`: max 13 characters
- `Amount`: must be a whole number integer — use `Math.ceil()`
- `PhoneNumber`: must start with `254`, no `+`, no leading `0`

---

## Step 4 — Handle the Daraja callback

This endpoint receives the payment result from Safaricom. It has no JWT guard (Safaricom can't log in), so it is protected in layers instead. Never rely on any single one (OWASP API6, see `docs/SECURITY_PLAN.md`):

1. **Secret URL token.** The route is `POST /api/payments/mpesa/callback/:token`, checked in constant time against `MPESA_CALLBACK_TOKEN` by `MpesaCallbackGuard` (`payments/mpesa-callback.guard.ts`).
2. **IP allowlist.** The same guard only accepts Safaricom's published callback IPs (`SAFARICOM_CALLBACK_IPS`, overridable with `MPESA_CALLBACK_IPS`). It's skipped only when `MPESA_ENVIRONMENT=sandbox`. Behind a reverse proxy, `TRUST_PROXY` must be set or `req.ip` is the proxy and every callback is refused.
3. **Payload validation.** `PaymentsService.handleCallback` only acts on a pending payment whose `CheckoutRequestID` **and** `MerchantRequestID` match what we stored. On success it requires a receipt number and `Amount >= payment.amount`, otherwise the payment is set to failed for staff to reconcile and the job stays unpaid.
4. **Confirm with Daraja (required when the real integration lands).** Before marking a job paid, call the STK Push Query API (Step 5) for that `CheckoutRequestID` and only mark it paid if Daraja itself reports `ResultCode 0`. This is the one check that doesn't depend on the callback request at all. The same query also recovers payments whose callback was lost or refused (e.g. Safaricom started using a new IP).

The controller always answers `{ ResultCode: 0, ResultDesc: 'Accepted' }` once the guard passes, even if processing throws (the error is logged). The exception filter redacts the token from logged URLs, but reverse-proxy access logs will still contain it, so keep those private.

**Callback payload shape from Daraja:**

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_191220191020363925",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount",              "Value": 80 },
          { "Name": "MpesaReceiptNumber",  "Value": "QHX3K8P2" },
          { "Name": "TransactionDate",     "Value": 20260527114500 },
          { "Name": "PhoneNumber",         "Value": 254712345678 }
        ]
      }
    }
  }
}
```

**ResultCode meanings:**
- `0` = success (payment completed)
- `1032` = customer cancelled
- `1037` = timeout (customer didn't respond)
- `2001` = wrong PIN
- Any non-zero = failure

**Callback handler logic:** see `PaymentsService.handleCallback` in `kaban-backend/src/modules/payments/payments.service.ts`. It is the source of truth; don't copy an older version of it from here. Things it relies on:

- `CallbackMetadata.Item` is an array, not an object. Use `.find()` to extract values by `Name`, and check `Array.isArray` first.
- `ResultCode` may arrive as a number or a string; it's compared as `Number(ResultCode)`.
- A payment only leaves `pending` through a conditional update (`WHERE status = 'pending'`), so duplicate or concurrent callbacks are processed once.

---

## Step 5 — STK Push query (confirmation + polling fallback)

Required at go-live to confirm each success callback with Daraja before marking a job paid (Step 4, layer 4), and to recover payments whose callback never arrived. Also useful in dev with ngrok:

```typescript
async queryStk(checkoutRequestId: string) {
  const token = await this.getAccessToken();
  const { password, timestamp } = this.generatePassword();
  const baseUrl = this.getMpesaBaseUrl();

  const response = await axios.post(
    `${baseUrl}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: this.config.get('MPESA_SHORTCODE'),
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return response.data;
}
```

---

## Pay on pickup flow (no Daraja involved)

```typescript
async confirmPickupPayment(jobId: string, adminUserId: string): Promise<void> {
  const job = await this.jobRepo.findOne({ where: { id: jobId } });
  if (!job) throw new NotFoundException('Job not found');
  if (job.paymentStatus !== 'pay_on_pickup') {
    throw new BadRequestException('Job is not a pay-on-pickup job');
  }

  await this.jobRepo.update(jobId, { paymentStatus: 'paid' });

  // Log the cash payment
  await this.paymentRepo.save({
    jobId,
    userId: job.userId,
    method: 'cash',
    amount: job.cost + job.deliveryFee,
    status: 'completed',
    paidAt: new Date(),
  });

  await this.notificationsService.send(jobId, 'payment_confirmed');
}
```

---

## Development setup — exposing callback URL

Daraja cannot call `localhost`. Use one of these during development:

**Option 1 — ngrok (recommended):**
```bash
ngrok http 3000
# Copy the https URL → set as MPESA_CALLBACK_URL in .env
# e.g. https://abc123.ngrok.io/api/payments/mpesa/callback/<MPESA_CALLBACK_TOKEN>
```

**Option 2 — Cloudflare Tunnel:**
```bash
cloudflared tunnel --url http://localhost:3000
```

Restart the NestJS server after updating `.env`.

---

## Testing M-Pesa in sandbox

Sandbox test credentials:
- Shortcode: `174379`
- Test phone number: `254708374149` (Safaricom's sandbox test number)
- PIN: any 4-digit PIN works in sandbox

The sandbox STK Push will NOT actually prompt a real phone. You must manually call the STK Query endpoint or simulate the callback using Postman/curl to test the callback handler.

**Simulate callback with curl:**
```bash
# Needs MPESA_ENVIRONMENT=sandbox (no IP check), the real token, and both IDs from the STK push response
curl -X POST http://localhost:3001/api/payments/mpesa/callback/$MPESA_CALLBACK_TOKEN \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "YOUR_MERCHANT_REQ_ID_HERE",
        "CheckoutRequestID": "YOUR_CHECKOUT_REQ_ID_HERE",
        "ResultCode": 0,
        "ResultDesc": "The service request is processed successfully.",
        "CallbackMetadata": {
          "Item": [
            { "Name": "Amount", "Value": 80 },
            { "Name": "MpesaReceiptNumber", "Value": "QHX3K8P2" },
            { "Name": "TransactionDate", "Value": 20260527114500 },
            { "Name": "PhoneNumber", "Value": 254712345678 }
          ]
        }
      }
    }
  }'
```

---

## Common mistakes to avoid

1. **Wrong phone format** — always strip `+` and replace leading `0` with `254`
2. **Float amount** — Daraja rejects decimals, always use `Math.ceil(amount)`
3. **Wrong timestamp format** — must be `YYYYMMDDHHmmss`, 14 digits, no separators
4. **AccountReference too long** — max 12 characters, `PrintEase-1042` = 14 chars ❌, use `PE-1042` ✓
5. **Callback not public** — never put `JwtAuthGuard` on the callback endpoint (it's protected by `MpesaCallbackGuard` instead)
6. **CallbackMetadata.Item is an array** — use `.find()`, not direct key access
7. **Not saving CheckoutRequestID** — you cannot match the callback without it
8. **Caching access token** — request a new token per session or cache with TTL < 1 hour
