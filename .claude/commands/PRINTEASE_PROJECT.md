# PrintEase — Master Project Context

> Read this file at the start of every session before writing any code.
> This is the single source of truth for project decisions, naming, and structure.

---

## What this project is

PrintEase is a neighbourhood print shop management platform for a home-based printing business in Nairobi, Kenya. Customers submit print jobs via a web app, pay via M-Pesa or on pickup, and track their job status in real time. Clerks manage the queue from an admin dashboard.

---

## Current build phase

```
Phase:   Both layers complete — backend fully wired to frontend.
State:   Production-ready for internal use. M-Pesa and Africa's Talking SMS
         are stubbed (placeholder responses only, not yet live).

Completed:
  ✓ NestJS backend — all modules built and running on port 3001
  ✓ Nuxt 3 frontend — all customer pages + full admin dashboard
  ✓ Frontend stores wired to real API (no more dummy data)
  ✓ Admin: staff CRUD, settings, reports, job file download
  ✓ Separate admin login page (/admin/login)

Not yet built:
  ✗ Real Daraja STK Push (currently returns mock response)
  ✗ Real Africa's Talking SMS (currently logs to console)
  ✗ Real WhatsApp API (currently logs to console)
  ✗ Electron print client
```

---

## Tech stack

| Layer            | Technology                                        |
|------------------|---------------------------------------------------|
| Frontend         | Nuxt 3 + Tailwind CSS + Pinia                     |
| Backend          | NestJS + Sequelize (`sequelize-typescript`) + MySQL |
| Auth             | JWT (access 1h + refresh 30d), stored in localStorage |
| Payments         | Safaricom Daraja API — M-Pesa STK Push (stubbed)  |
| File storage     | MinIO (S3-compatible); presigned URLs for access  |
| File conversion  | LibreOffice headless → PDF                        |
| Notifications    | Web Push (VAPID) + Africa's Talking SMS (stubbed) + WhatsApp (stubbed) |
| API gateway      | None — direct NestJS on port 3001                 |
| Environment      | Windows dev, Docker for prod                      |

---

## Repository structure

```
kaban-printing-frontend/         ← git root
  kaban-frontend/                ← Nuxt 3 app
    pages/
      auth.vue                   ← customer login/register
      admin/
        login.vue                ← staff portal login (layout: false)
        index.vue                ← admin dashboard
        queue/
        customers/
        reports/
        settings/
      app/
        index.vue                ← customer home
        orders/
          index.vue              ← order list
          [id].vue               ← job detail
        profile/
          index.vue              ← profile view
          edit.vue               ← profile edit
        new-job.vue
        payment.vue
    components/
      admin/                     ← admin-specific components
    composables/
      useApi.ts                  ← authenticated $fetch wrapper
      useAdminStaff.ts           ← staff API calls
      useAdminSettings.ts        ← settings API calls
      useAdminReports.ts         ← reports API calls
      usePushNotifications.ts
    stores/
      auth.ts                    ← login, logout, adminLogin, user state
      jobs.ts                    ← customer job store
      admin.ts                   ← admin queue/stats/customers + staff/settings/reports
    layouts/
      customer.vue
      admin.vue
    middleware/
      admin-redirect.ts
    .env                         ← not committed
    .env.example                 ← committed template

  kaban-backend/                 ← NestJS app
    src/
      modules/
        auth/                    ← register, login, adminLogin, refresh, logout
        users/                   ← profile, notification prefs
        jobs/                    ← create, list, single, pricing
        payments/                ← STK Push stub, pay-on-pickup, Daraja callback
        files/                   ← upload, MinIO, LibreOffice PDF, presigned URLs
        notifications/           ← push + SMS stub + WhatsApp stub
        push/                    ← VAPID, subscribe/unsubscribe
        admin/                   ← queue, stats, customers, staff, settings, reports
      common/
        guards/                  ← JwtAuthGuard, RolesGuard
        decorators/              ← @CurrentUser(), @Roles()
        interceptors/            ← TransformInterceptor
        filters/                 ← GlobalExceptionFilter
    .env                         ← not committed
    .env.example                 ← committed template
```

---

## Module responsibilities

| Module          | Responsibility                                                  |
|-----------------|-----------------------------------------------------------------|
| `auth`          | Register/login (customer + admin), JWT issue, refresh, logout   |
| `users`         | Profile, house number lookup, notification prefs, password      |
| `jobs`          | Create job, list (customer), single job, pricing calc           |
| `payments`      | M-Pesa STK Push stub, Daraja callback, pay-on-pickup            |
| `files`         | Upload, validate, convert to PDF, page count, presigned URLs    |
| `notifications` | Push + SMS stub + WhatsApp stub on every status change          |
| `push`          | VAPID setup, subscribe/unsubscribe per user                     |
| `admin`         | Queue, stats, customers, job mutations, staff CRUD, settings, reports, file download |

---

## API base URL

```
Development:  http://localhost:3001/api
Production:   https://api.printease.co.ke/api   (update when deployed)
```

All routes are prefixed with `/api` via `app.setGlobalPrefix('api')` in `main.ts`.

---

## Complete API contract

### Auth

```
POST   /api/auth/register          → register new customer
POST   /api/auth/login             → customer login → { accessToken, refreshToken, user }
POST   /api/auth/refresh           → body: { refreshToken } → new accessToken
POST   /api/auth/logout            → revokes refresh token

POST   /api/admin/auth/login       → staff login (clerk or admin only)
POST   /api/admin/auth/create-staff → create clerk/admin account (admin role only)
```

### Jobs (customer-facing)

```
GET    /api/jobs/my                → array of jobs for current user
POST   /api/jobs                   → submit new print job
GET    /api/jobs/:id               → single job detail
```

### Files

```
POST   /api/files/upload           → multipart upload → { fileId, fileName, fileUrl, pdfUrl, pageCount }
GET    /api/files/:filename        → serve file (authenticated, own files only)
```

### Payments

```
POST   /api/payments/mpesa/stk     → initiate STK Push (stub) → { checkoutRequestId, ... }
POST   /api/payments/mpesa/callback → Daraja webhook (no auth)
PATCH  /api/payments/:jobId/pickup → confirm pay-on-pickup as paid
```

### Push notifications

```
GET    /api/push/vapid-key         → public, returns { publicKey }
POST   /api/push/subscribe         → authenticated, body: { endpoint, p256dh, auth }
DELETE /api/push/unsubscribe       → authenticated
```

### Admin (clerk or admin role)

```
GET    /api/admin/jobs             → full queue with customer info + pagination
GET    /api/admin/stats            → { jobsToday, pending, completed, revenueToday }
GET    /api/admin/customers        → all customers with aggregated stats
GET    /api/admin/customers/lookup?house=14B → single customer by house number
PATCH  /api/admin/jobs/:id/status  → { status: 'printing' | 'ready' | 'delivered' }
PATCH  /api/admin/jobs/:id/payment → mark pay-on-pickup as paid
PATCH  /api/admin/jobs/:id/notes   → { notes: string }
DELETE /api/admin/jobs/:id         → cancel job
GET    /api/admin/jobs/:id/file    → presigned download URL for job file (clerks/admins only)

GET    /api/admin/staff            → list all clerks and admins
POST   /api/admin/staff            → create staff member (admin only)
PATCH  /api/admin/staff/:id/deactivate → soft-disable staff (admin only)
PATCH  /api/admin/staff/:id/reactivate → re-enable staff (admin only)

GET    /api/admin/settings         → { business, pricing, notificationMatrix }
PATCH  /api/admin/settings         → partial update any settings section

GET    /api/admin/reports          → { dailyRevenue, jobsByDayOfWeek, jobsByStatus,
                                       avgFulfillmentHours, paymentMethodSplit, topCustomers }
```

---

## Standard response envelope

Every endpoint returns this shape. The frontend expects this exactly.

```typescript
// Success
{
  statusCode: 200,
  message: 'Success',
  data: { ... }       // the actual payload
}

// Error
{
  statusCode: 400,
  message: 'Validation failed',
  errors: [ ... ]     // optional array of field errors
}
```

Implemented via `common/interceptors/transform.interceptor.ts` (global).

---

## User roles

```typescript
enum UserRole {
  CUSTOMER = 'customer',
  CLERK    = 'clerk',
  ADMIN    = 'admin',
}
```

- `CUSTOMER` — can only see and create their own jobs
- `CLERK` — can view full queue, update job status, mark as paid, download files
- `ADMIN` — everything CLERK can do + staff management, reports, settings

Guards: `JwtAuthGuard` on all protected routes, `RolesGuard` on admin routes.

---

## Job status lifecycle

```
pending → printing → ready → delivered
```

Payment status is separate:

```
unpaid | paid | pay_on_pickup
```

A job with `paymentStatus: 'unpaid'` should NOT enter the print queue until paid.
A job with `paymentStatus: 'pay_on_pickup'` enters the queue immediately.

---

## Naming conventions

| Context          | Convention      | Example                          |
|------------------|-----------------|----------------------------------|
| TypeScript vars  | camelCase       | `colorMode`, `deliveryType`      |
| MySQL columns    | snake_case      | `color_mode`, `delivery_type`    |
| Sequelize model  | camelCase       | `field: 'color_mode'`            |
| API response     | camelCase       | matches frontend store field names |
| File names       | kebab-case      | `jobs.service.ts`                |
| NestJS modules   | PascalCase      | `JobsModule`                     |
| Environment vars | SCREAMING_SNAKE | `MINIO_ACCESS_KEY`               |

---

## Environment variables

See `kaban-backend/.env.example` and `kaban-frontend/.env.example` for full lists.

**Backend key vars:**
```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_NAME=kaban
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=printease
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
```

**Frontend key vars:**
```env
NUXT_PUBLIC_API_BASE=http://localhost:3001/api
NUXT_PUBLIC_VAPID_KEY=
```

---

## What the agent must never do

- Never put business logic inside a controller — controllers receive, validate, delegate, respond only
- Never skip DTOs — every request body must have a DTO with class-validator decorators
- Never hardcode credentials, URLs, or secrets — always use ConfigService
- Never write raw SQL except for reporting aggregations — use Sequelize model methods everywhere else
- Never use TypeORM — the project uses Sequelize + sequelize-typescript
- Never change field names in API responses without updating the frontend stores to match
- Never create a new module without registering it in AppModule imports AND adding its models to the global models array
- Never add `@Unique` to a column that multiple staff records may share (e.g. houseNumber defaults to 'N/A' for all staff)
