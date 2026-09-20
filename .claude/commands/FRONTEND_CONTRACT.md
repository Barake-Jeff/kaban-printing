# Frontend Contract — API Response Shapes

> This file defines exactly what each API endpoint must return.
> Field names, types, and nesting must match this spec exactly.
> The Vue frontend stores are already written against these shapes.

---

## Why this file exists

The Nuxt 3 frontend (`data/dummy.ts`) was built first.
All stores use these exact field names. If the backend returns `color_mode`
instead of `colorMode`, the frontend breaks silently.
Never change a field name in an API response without updating the frontend store.

---

## Auth responses

### POST /api/auth/login → POST /api/auth/register

```typescript
// data shape inside the response envelope
{
  accessToken:  string,    // JWT, expires 1 hour
  refreshToken: string,    // JWT, expires 30 days
  user: {
    id:            string,
    name:          string,
    phone:         string,
    houseNumber:   string,   // camelCase — NOT house_number
    estate:        string,
    role:          'customer',
    notifSms:      boolean,
    notifWhatsapp: boolean,
    creditBalance: number,
    loyaltyPoints: number,
  }
}
```

### POST /api/admin/auth/login

```typescript
{
  accessToken:  string,
  refreshToken: string,
  user: {
    id:    string,
    name:  string,
    phone: string,
    role:  'clerk' | 'admin',
    active: boolean,
  }
}
```

### POST /api/auth/refresh

```typescript
// Refresh tokens rotate — persist BOTH fields, not just accessToken
{ accessToken: string, refreshToken: string }
```

### POST /api/auth/forgot-password

Request body:
```typescript
{ phone: string }
```

Response (always the same shape/message, whether or not the phone is registered):
```typescript
{ success: true, message: string }
```

---

## Job shapes

### GET /api/jobs/my  (customer — their own jobs)

```typescript
// Returns array of:
{
  id:            string,
  userId:        string,
  fileName:      string | null,
  instructions:  string | null,
  pages:         number,
  copies:        number,
  colorMode:     'bw' | 'color',
  sides:         'single' | 'double',
  paperSize:     string,
  deliveryType:  'pickup' | 'delivery',
  paymentMethod: 'mpesa' | 'pay_on_pickup',
  paymentStatus: 'unpaid' | 'paid' | 'pay_on_pickup',
  mpesaRef:      string | null,
  status:        'pending' | 'printing' | 'ready' | 'delivered',
  cost:          number,
  deliveryFee:   number,
  adminNotes:    string | null,
  createdAt:     string,   // ISO 8601
  updatedAt:     string,
}
```

### GET /api/admin/jobs  (admin — all jobs with customer info)

Same as above, plus:

```typescript
{
  customerName: string,
  houseNumber:  string,
  phone:        string,
}
```

---

## Admin stats

### GET /api/admin/stats

```typescript
{
  jobsToday:    number,
  pending:      number,
  completed:    number,
  revenueToday: number,
}
```

---

## Customer list

### GET /api/admin/customers

```typescript
// Returns array of:
{
  id:               string,
  name:             string,
  houseNumber:      string,
  phone:            string,
  totalJobs:        number,
  totalSpent:       number,
  payOnPickupCount: number,
  mpesaCount:       number,
}
```

### GET /api/admin/customers/lookup?house=14B

Returns single customer object or 404.

---

## File upload response

### POST /api/files/upload

```typescript
{
  fileId:    string,
  fileName:  string,
  fileUrl:   string,   // presigned URL for original (1h expiry)
  pdfUrl:    string,   // presigned URL for converted PDF (1h expiry)
  pageCount: number,
}
```

### GET /api/admin/jobs/:id/file

```typescript
{
  url:      string,   // presigned download URL (1h expiry) — MinIO prefers pdf_key, falls back to file_key
  fileName: string,
}
```

---

## Payment initiation

### POST /api/payments/mpesa/stk

Request body:
```typescript
{ jobId: string, phone: string }
```

Response:
```typescript
{
  checkoutRequestId: string,
  merchantRequestId: string,
  responseCode:      string,
  responseDesc:      string,
  customerMessage:   string,
}
```

---

## Staff

### GET /api/admin/staff

```typescript
// Returns array of:
{
  id:    string,
  name:  string,
  phone: string,
  role:  'clerk' | 'admin',
  active: boolean,
  createdAt: string,
}
```

### POST /api/admin/staff

Request body:
```typescript
{ name: string, phone: string, password: string, role: 'clerk' | 'admin' }
```

Response: single staff member object (above).

### PATCH /api/admin/staff/:id/deactivate | /reactivate

Returns updated staff member object.

---

## Settings

### GET /api/admin/settings

```typescript
{
  business: {
    name: string,
    phone: string,
    email: string,
    address: string,
    hours: string,
  },
  pricing: {
    bwPerPage: number,
    colorPerPage: number,
    deliveryFee: number,
    doubleSidedMultiplier: number,
  },
  notificationMatrix: {
    jobReceived: boolean,
    paymentConfirmed: boolean,
    printingStarted: boolean,
    jobReady: boolean,
    jobDelivered: boolean,
  }
}
```

### PATCH /api/admin/settings

Request body: partial (any subset of the above).

---

## Reports

### GET /api/admin/reports

```typescript
{
  dailyRevenue: Array<{ date: string, revenue: number }>,       // last 14 days
  jobsByDayOfWeek: Array<{ day: string, count: number }>,       // Mon–Sun
  jobsByStatus: Array<{ status: string, count: number }>,
  avgFulfillmentHours: number | null,
  paymentMethodSplit: Array<{ method: string, count: number }>,
  topCustomers: Array<{ name: string, houseNumber: string, totalJobs: number, totalSpent: number }>,
}
```

---

## Password reset requests (admin only)

### GET /api/admin/password-reset-requests

Pending requests only, oldest first. `role` may be `'admin'` — those can be dismissed but not
reset in-app (the backend returns 403 for `PATCH /admin/users/:id/password` against an admin).

```typescript
Array<{
  id:          string,
  userId:      string,        // pass this to PATCH /admin/users/:id/password
  name:        string | null,
  phone:       string | null,
  houseNumber: string | null, // 'N/A' for staff
  role:        'customer' | 'clerk' | 'admin' | null,
  createdAt:   string,        // ISO 8601
}>
```

### PATCH /api/admin/password-reset-requests/:id/dismiss

Returns `{ success: true }`. Resolves the request without changing any password.

### PATCH /api/admin/users/:id/password

Request body: `{ newPassword: string }` — 8–100 chars, at least one letter and one number.
Returns `{ success: true }`. Also revokes all of the user's refresh tokens and resolves any
pending request for them. Works for customers and clerks, at any time (no request needed).

---

## Nuxt store → API endpoint mapping

| Store method                             | HTTP call                                      |
|------------------------------------------|------------------------------------------------|
| `useAuthStore().login()`                 | POST /api/auth/login                           |
| `useAuthStore().register()`              | POST /api/auth/register                        |
| `useAuthStore().adminLogin()`            | POST /api/admin/auth/login                     |
| `useAuthStore().logout()`                | POST /api/auth/logout                          |
| `useAuthStore().requestPasswordReset()`  | POST /api/auth/forgot-password                 |
| `useJobsStore().fetchMyJobs()`           | GET /api/jobs/my                               |
| `useJobsStore().submitJob()`             | POST /api/jobs                                 |
| `useJobsStore().initiateMpesa(jobId)`    | POST /api/payments/mpesa/stk                   |
| `useAdminStore().fetchQueue()`           | GET /api/admin/jobs                            |
| `useAdminStore().fetchStats()`           | GET /api/admin/stats                           |
| `useAdminStore().fetchCustomers()`       | GET /api/admin/customers                       |
| `useAdminStore().updateJobStatus()`      | PATCH /api/admin/jobs/:id/status               |
| `useAdminStore().markAsPaid(id)`         | PATCH /api/admin/jobs/:id/payment              |
| `useAdminStore().saveNotes()`            | PATCH /api/admin/jobs/:id/notes                |
| `useAdminStore().cancelJob(id)`          | DELETE /api/admin/jobs/:id                     |
| `useAdminStore().lookupCustomer()`       | GET /api/admin/customers/lookup?house={house}  |
| `useAdminStore().fetchJobFileUrl(id)`    | GET /api/admin/jobs/:id/file                   |
| `useAdminStaff().fetchStaff()`          | GET /api/admin/staff                           |
| `useAdminStaff().createStaff(dto)`      | POST /api/admin/staff                          |
| `useAdminStaff().deactivateStaff(id)`   | PATCH /api/admin/staff/:id/deactivate          |
| `useAdminStaff().reactivateStaff(id)`   | PATCH /api/admin/staff/:id/reactivate          |
| `useAdminSettings().fetchSettings()`    | GET /api/admin/settings                        |
| `useAdminSettings().saveSettings(dto)`  | PATCH /api/admin/settings                      |
| `useAdminReports().fetchReportData()`   | GET /api/admin/reports                         |
| `usePasswordResets().fetchRequests()`   | GET /api/admin/password-reset-requests         |
| `usePasswordResets().dismissRequest(id)`| PATCH /api/admin/password-reset-requests/:id/dismiss |
| `usePasswordResets().setUserPassword(userId, pw)` | PATCH /api/admin/users/:id/password  |

---

## How the frontend calls the API

All authenticated calls go through `composables/useApi.ts` — read that file for the exact
code. The contract it upholds:

- `baseURL` is `NUXT_PUBLIC_API_BASE`; the access token is added as a `Bearer` header.
- On a 401 it calls `POST /auth/refresh` and stores **both** returned tokens
  (`accessToken` and `refreshToken` — refresh tokens rotate and are single-use).
- **Concurrent 401s must share one refresh call** (module-level in-flight promise). The
  backend treats a replayed refresh token as theft and revokes every session, so parallel
  independent refreshes would log the user out whenever the access token expires. Do not
  "simplify" this back to a refresh per failed request.
- It does not retry the original failed request; the next call succeeds with the new token.

---

## Field name cross-reference

| Frontend field      | Backend response field  | MySQL column             |
|---------------------|-------------------------|--------------------------|
| `id`                | `id`                    | `id`                     |
| `userId`            | `userId`                | `user_id`                |
| `fileName`          | `fileName`              | `file_name`              |
| `instructions`      | `instructions`          | `instructions`           |
| `pages`             | `pages`                 | `pages`                  |
| `copies`            | `copies`                | `copies`                 |
| `colorMode`         | `colorMode`             | `color_mode`             |
| `sides`             | `sides`                 | `sides`                  |
| `paperSize`         | `paperSize`             | `paper_size`             |
| `deliveryType`      | `deliveryType`          | `delivery_type`          |
| `paymentMethod`     | `paymentMethod`         | `payment_method`         |
| `paymentStatus`     | `paymentStatus`         | `payment_status`         |
| `mpesaRef`          | `mpesaRef`              | `mpesa_ref`              |
| `status`            | `status`                | `status`                 |
| `cost`              | `cost`                  | `cost`                   |
| `deliveryFee`       | `deliveryFee`           | `delivery_fee`           |
| `adminNotes`        | `adminNotes`            | `admin_notes`            |
| `notifSms`          | `notifSms`              | `notif_sms`              |
| `notifWhatsapp`     | `notifWhatsapp`         | `notif_whatsapp`         |
| `createdAt`         | `createdAt`             | `created_at`             |
| `updatedAt`         | `updatedAt`             | `updated_at`             |
| `customerName`      | `customerName`          | joined: `users.name`     |
| `houseNumber`       | `houseNumber`           | `house_number`           |
| `phone`             | `phone`                 | `phone`                  |
| `active`            | `active`                | `active`                 |
