# Notifications — Push, SMS & WhatsApp

> This file covers when, how, and what to send for every job status change.
> The notifications module is called by other modules — it never calls them.

---

## Channel priority

For every trigger, the system checks channels in this order:

1. **Push** (Web Push API) — if the user has an active push subscription, use it exclusively
2. **SMS** (Africa's Talking) — fallback if no push subscription and `user.notifSms` is true
3. **WhatsApp** — additional channel on `job_ready` only if `user.notifWhatsapp` is true

Push and SMS are mutually exclusive per trigger. WhatsApp is always additive on `job_ready`.

---

## Notification triggers

| Trigger               | Push | SMS              | WhatsApp   | When it fires                              |
|-----------------------|------|------------------|------------|--------------------------------------------|
| `job_received`        | ✓    | ✓ (fallback)     | —          | Job submitted successfully                 |
| `payment_confirmed`   | ✓    | ✓ (fallback)     | —          | M-Pesa callback received with ResultCode 0 |
| `printing_started`    | ✓    | —                | —          | Clerk marks status → 'printing'            |
| `job_ready`           | ✓    | ✓ (fallback)     | ✓ (additive) | Clerk marks status → 'ready'             |
| `job_delivered`       | ✓    | ✓ (fallback)     | —          | Clerk marks status → 'delivered'           |
| `payment_failed`      | ✓    | ✓ (fallback)     | —          | M-Pesa callback with non-zero ResultCode   |

---

## Push notification payloads

```typescript
const payloads = {
  job_received:      { title: 'Print job received',      body: 'Job #{id} is in the queue. Pay via M-Pesa to confirm.',        url: '/app/orders/{id}' },
  payment_confirmed: { title: 'Payment confirmed ✓',    body: 'Job #{id} is confirmed and in the print queue.',               url: '/app/orders/{id}' },
  printing_started:  { title: 'Now printing 🖨',        body: 'Job #{id} is being printed now.',                              url: '/app/orders/{id}' },
  job_ready:         { title: 'Your print is ready! 🎉', body: 'Job #{id} is ready for collection.',                           url: '/app/orders/{id}' },
  job_delivered:     { title: 'Job delivered ✓',        body: 'Job #{id} has been delivered. Thank you!',                     url: '/app/orders/{id}' },
  payment_failed:    { title: 'Payment failed',          body: 'Payment for Job #{id} was not completed. Please try again.',   url: '/app/orders/{id}' },
}
```

---

## SMS message templates

### job_received
```
Hi {name}! Your print job has been received.

Job #{jobId} · House {houseNumber}
File: {fileName}
{pages} pages · {copies} copies

Total: KES {total}

Pay via M-Pesa to confirm your order.
```

### payment_confirmed
```
✓ Payment received — KES {amount}

Job #{jobId} is now in the print queue. We'll notify you when it's ready.

Est. wait: 20–30 min.
```

### printing_started
*(Push only — no SMS template)*

### job_ready (pickup)
```
Your print is ready! 🎉

Job #{jobId} · House {houseNumber}

Come collect at your convenience. We're open until 8 PM.

Thank you for using PrintEase.
```

### job_ready (delivery)
```
Your print is on the way! 🚚

Job #{jobId} · House {houseNumber}

Your documents are being delivered.

Thank you for using PrintEase.
```

### job_delivered
```
Job #{jobId} collected. Thank you!

Need to print again? Visit printease.co.ke

PrintEase — your neighbourhood print shop 🏠
```

### payment_failed
```
Payment for Job #{jobId} was not completed.

Please try again from the PrintEase app or contact support.

PrintEase Support: 0712 345 678
```

---

## Backend module structure

```
src/modules/
  push/
    models/
      push-subscription.model.ts  ← Sequelize model for push_subscriptions table
    dto/
      subscribe.dto.ts
    push.service.ts               ← VAPID init, subscribe/unsubscribe, sendPush()
    push.controller.ts            ← GET /push/vapid-key, POST /push/subscribe, DELETE /push/unsubscribe
    push.module.ts                ← exports PushService

  notifications/
    models/
      notification-log.model.ts   ← Sequelize model for notifications_log table
    notifications.service.ts      ← send(), sendPush(), sendSms(), sendWhatsapp()
    notifications.module.ts       ← imports PushModule, exports NotificationsService
```

---

## Push API endpoints

```
GET  /api/push/vapid-key    → public, no auth, returns { publicKey }
POST /api/push/subscribe    → authenticated (JwtAuthGuard), body: { endpoint, p256dh, auth }
DELETE /api/push/unsubscribe → authenticated (JwtAuthGuard)
```

`subscribe` destroys all existing subscriptions for the user and creates a fresh one (one subscription per user).

---

## VAPID setup

```bash
# Generate keys (run once, store in .env)
npx web-push generate-vapid-keys
```

Backend `.env`:
```
VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated>
VAPID_SUBJECT=mailto:support@printease.co.ke
```

Frontend `.env`:
```
NUXT_PUBLIC_VAPID_KEY=<same generated public key>
```

`PushService` calls `webpush.setVapidDetails()` in its constructor. This must be called before any `sendNotification()` call.

---

## NotificationsService.send() — calling pattern

Callers pass context directly (job + user data already in scope):

```typescript
import { NotificationsService, JobContext } from '../notifications/notifications.service';

// In JobsService / AdminService / PaymentsService:
await this.notificationsService.send('job_received', {
  jobId: job.id,
  userId: user.id,
  user: {
    name:          user.name,
    phone:         user.phone,
    houseNumber:   user.houseNumber,
    notifSms:      user.notifSms,
    notifWhatsapp: user.notifWhatsapp,
  },
  job: {
    fileName:     job.fileName,
    pages:        job.pages,
    copies:       job.copies,
    cost:         job.cost,
    deliveryFee:  job.deliveryFee,
    deliveryType: job.deliveryType,
  },
});
```

---

## Frontend push integration

**Composable:** `composables/usePushNotifications.ts`

```typescript
const { isSupported, isGranted, requestAndSubscribe, unsubscribe } = usePushNotifications()
```

- `isSupported` — `computed` — false on server, false if browser lacks Push API
- `isGranted` — `computed` — true only when `Notification.permission === 'granted'`
- `requestAndSubscribe()` — requests OS permission → subscribes browser → POSTs to backend
- `unsubscribe()` — unsubscribes browser, DELETEs from backend

**Auto-prompt after login/signup:** `stores/auth.ts` calls `schedulePushPrompt()` after successful login or signup. It fires `requestAndSubscribe()` after a 2-second delay if permission is still `'default'`.

**Profile page toggle:** `pages/app/profile/index.vue` shows a "Push notifications" toggle above SMS. Toggling on calls `requestAndSubscribe()`. Toggling off calls `unsubscribe()`. If permission is `'denied'`, the toggle is disabled with a help text.

**Service worker push handler:** `public/sw-push.js` — loaded via `workbox.importScripts` in `nuxt.config.ts`. Handles `push` and `notificationclick` events.

---

## SMS — Africa's Talking

```bash
npm install africastalking
```

Backend `.env`:
```
AT_USERNAME=sandbox   # use 'sandbox' for testing
AT_API_KEY=<key from sandbox dashboard>
```

Phone formatting: Africa's Talking requires `+254XXXXXXXXX` format.

The SMS integration is stubbed in `notifications.service.ts` with `TODO` comments. Activate by uncommenting the SDK call and installing `africastalking`.

---

## Who calls notifications.send()

| Caller module | Trigger                |
|---------------|------------------------|
| `jobs`        | `job_received`         |
| `payments`    | `payment_confirmed`    |
| `payments`    | `payment_failed`       |
| `admin/jobs`  | `printing_started`     |
| `admin/jobs`  | `job_ready`            |
| `admin/jobs`  | `job_delivered`        |

`NotificationsModule` must be imported in each calling module.

---

## Rules

- Never throw from a notification failure — catch all errors and log them
- Never block the main response waiting for notification delivery
- Always log to `notifications_log` whether success or failure
- Push is preferred over SMS — if a push subscription exists, skip SMS entirely
- If `sendNotification()` returns HTTP 410 Gone, delete that subscription row immediately
