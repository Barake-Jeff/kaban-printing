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

## Rules for every Daraja call (OWASP API10)

All outbound calls go through `kaban-backend/src/common/http/outbound-http.ts`. Never call `axios` directly:

- **`createOutboundClient({ name: 'M-Pesa', baseURL })`:** 10 s timeout, no redirects, 1 MiB response cap, https only. Failures are logged without headers or bodies, and surface as `UpstreamError` (502/504, message names only the provider).
- **`parseUpstream(Dto, response.data, 'M-Pesa')`:** validate every response against a DTO before using a field. Daraja is loose with types (`expires_in` arrives as `"3599"`), which implicit conversion handles. A missing field throws `UpstreamResponseError` (502).
- **`withRetry(fn)`:** **only** for the token fetch and STK query. **Never retry an STK push**: a push that timed out may still have reached the customer's phone, and a retry would prompt them, and possibly charge them, twice.

```typescript
// payments/daraja.client.ts (sketch)
import { IsInt, IsString, IsNotEmpty } from 'class-validator';
import { createOutboundClient, parseUpstream, withRetry } from '../../common/http/outbound-http';

class TokenResponse   { @IsString() @IsNotEmpty() access_token: string; @IsInt() expires_in: number; }
class StkPushResponse {
  @IsString() @IsNotEmpty() MerchantRequestID: string;
  @IsString() @IsNotEmpty() CheckoutRequestID: string;
  @IsString() ResponseCode: string;             // '0' = accepted for processing
  @IsString() CustomerMessage: string;
}
class StkQueryResponse {
  @IsString() ResponseCode: string;
  @IsString() ResultCode: string;               // '0' = paid
  @IsString() ResultDesc: string;
}

private readonly http = createOutboundClient({ name: 'M-Pesa', baseURL: this.getMpesaBaseUrl() });
```

---

## Step 1 — Get access token

The token is valid for `expires_in` seconds (about 1 hour). **Cache it in memory** and refresh it a minute early. Don't fetch one per payment. This is the one call that is safe to retry.

```typescript
private token: { value: string; expiresAt: number } | null = null;

async getAccessToken(): Promise<string> {
  if (this.token && Date.now() < this.token.expiresAt) return this.token.value;

  const key    = this.config.get('MPESA_CONSUMER_KEY');
  const secret = this.config.get('MPESA_CONSUMER_SECRET');
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');

  const res = await withRetry(() => this.http.get('/oauth/v1/generate', {
    params:  { grant_type: 'client_credentials' },
    headers: { Authorization: `Basic ${credentials}` },
  }));
  const body = parseUpstream(TokenResponse, res.data, 'M-Pesa');

  this.token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return this.token.value;
}
```

---

## Step 2 — Generate the password

The password is a base64 string of: `Shortcode + Passkey + Timestamp`
The timestamp format is `YYYYMMDDHHmmss` (14 digits, no separators), in **Kenyan time (EAT, UTC+3)**. Don't use `toISOString()`, which is UTC.

```typescript
generatePassword(): { password: string; timestamp: string } {
  const shortcode = this.config.get('MPESA_SHORTCODE');
  const passkey   = this.config.get('MPESA_PASSKEY');

  // sv-SE formats as "2026-05-27 11:45:00"; strip separators -> "20260527114500"
  const timestamp = new Date()
    .toLocaleString('sv-SE', { timeZone: 'Africa/Nairobi' })
    .replace(/\D/g, '');

  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  return { password, timestamp };
}
```

This is the most common mistake: a wrong timestamp format, the wrong time zone, or the wrong concatenation order. Confirm against the sandbox once.

---

## Step 3 — Send STK Push

**Not retried** (see the rules above). If it fails or times out, record the payment as failed and let the customer try again from the UI. A push that timed out on our side may still arrive, so the STK query in Step 5 is what tells you the outcome.

```typescript
async initiateStk(job: Job, phone: string, amount: number) {
  const token = await this.getAccessToken();
  const { password, timestamp } = this.generatePassword();
  const shortcode = this.config.get('MPESA_SHORTCODE');

  // Phone must be in format 2547XXXXXXXX (no + sign, no leading 0)
  const formattedPhone = phone.replace(/^\+/, '').replace(/^0/, '254');

  const res = await this.http.post('/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: shortcode,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   'CustomerPayBillOnline',
    Amount:            Math.ceil(amount),               // whole number, round UP
    PartyA:            formattedPhone,
    PartyB:            shortcode,
    PhoneNumber:       formattedPhone,
    CallBackURL:       this.config.get('MPESA_CALLBACK_URL'),  // ends in /<MPESA_CALLBACK_TOKEN>
    AccountReference:  `PE-${job.id.slice(0, 8)}`,      // max 12 chars (a full UUID is 36)
    TransactionDesc:   'Print job',                     // max 13 chars
  }, { headers: { Authorization: `Bearer ${token}` } });

  const body = parseUpstream(StkPushResponse, res.data, 'M-Pesa');
  if (body.ResponseCode !== '0') throw new BadRequestException(body.CustomerMessage || 'M-Pesa declined the request');

  // Save BOTH ids: the callback must match CheckoutRequestID and MerchantRequestID (Step 4).
  return { checkoutRequestId: body.CheckoutRequestID, merchantRequestId: body.MerchantRequestID };
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

Required at go-live:
- **Confirmation:** confirm each success callback with Daraja before marking a job paid (Step 4, layer 4).
- **Recovery:** recover payments whose callback never arrived, or was refused.

The query is idempotent, so it is retried on transient failures.

```typescript
async queryStk(checkoutRequestId: string): Promise<{ paid: boolean; resultCode: string; resultDesc: string }> {
  const token = await this.getAccessToken();
  const { password, timestamp } = this.generatePassword();

  const res = await withRetry(() => this.http.post('/mpesa/stkpushquery/v1/query', {
    BusinessShortCode: this.config.get('MPESA_SHORTCODE'),
    Password:          password,
    Timestamp:         timestamp,
    CheckoutRequestID: checkoutRequestId,
  }, { headers: { Authorization: `Bearer ${token}` } }));

  const body = parseUpstream(StkQueryResponse, res.data, 'M-Pesa');
  return { paid: body.ResultCode === '0', resultCode: body.ResultCode, resultDesc: body.ResultDesc };
}
```

While a push is still waiting for the customer's PIN, Daraja answers the query with an HTTP error: an `UpstreamError` whose `upstreamBody` says the transaction "is being processed". Treat that as "still pending", not as failed. `withRetry` will retry it a few times if Daraja returns it as a 5xx, so for polling, call `queryStk` on a schedule rather than in a tight loop.

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
3. **Wrong timestamp format** — must be `YYYYMMDDHHmmss`, 14 digits, no separators, in Africa/Nairobi time (not `toISOString()`, which is UTC)
4. **AccountReference too long** — max 12 characters, `PrintEase-1042` = 14 chars ❌, use `PE-1042` ✓
5. **Callback not public** — never put `JwtAuthGuard` on the callback endpoint (it's protected by `MpesaCallbackGuard` instead)
6. **CallbackMetadata.Item is an array** — use `.find()`, not direct key access
7. **Not saving CheckoutRequestID and MerchantRequestID** — the callback is matched on both
8. **Caching access token** — request a new token per session or cache with TTL < 1 hour
9. **Calling axios directly** — always use `createOutboundClient` / `parseUpstream` (timeouts, no redirects, validated responses), and never wrap an STK push in `withRetry`
