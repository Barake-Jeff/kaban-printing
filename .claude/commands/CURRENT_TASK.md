# Current Task — Session Briefing

> The agent reads this file first before touching any code.
> All decisions are locked. Do not ask clarifying questions.

---

## Current state (as of 2026-06-30)

Both layers are **fully built and wired**. There is no pending task at session start.
Read the git diff and ask the user what to work on next.

---

## What has been completed

### Backend (NestJS — `kaban-backend/`)

| Module        | Status   | Notes                                                              |
|---------------|----------|--------------------------------------------------------------------|
| Auth          | Complete | Customer register/login, admin login, JWT access+refresh, logout  |
| Users         | Complete | Profile, house lookup, notification prefs                          |
| Jobs          | Complete | Create, list (customer), single job, pricing calculation           |
| Files         | Complete | MinIO upload, LibreOffice PDF conversion, presigned URLs           |
| Payments      | Complete | M-Pesa STK Push stub, pay-on-pickup confirm, Daraja callback stub  |
| Notifications | Complete | Push (VAPID), SMS stub, WhatsApp stub; logs to notifications_log   |
| Push          | Complete | VAPID key endpoint, subscribe/unsubscribe                          |
| Admin         | Complete | Queue, stats, customers, job mutations, staff CRUD, settings, reports, file download |

### Frontend (Nuxt 3 — `kaban-frontend/`)

| Area             | Status   | Notes                                                           |
|------------------|----------|-----------------------------------------------------------------|
| Auth page        | Complete | Customer login/register; subtle "Staff? Sign in here →" link   |
| Admin login page | Complete | `/admin/login` — separate staff portal, routes by role          |
| Admin dashboard  | Complete | Stats, queue, job slide panel, customers, reports, settings     |
| Admin staff      | Complete | Staff list, create, deactivate/reactivate (real API)            |
| Admin settings   | Complete | Business, pricing, notification matrix (real API)               |
| Admin reports    | Complete | 6 chart sections, all real SQL aggregations                     |
| File download    | Complete | Clerks/admins download job files via presigned URLs             |
| Customer home    | Complete | Greeting, active jobs spotlight, stats bar, recent orders       |
| Customer orders  | Complete | Filter tabs, infinite scroll, search                            |
| Customer job detail | Complete | Progress tracker (in-progress) + receipt (delivered)          |
| Customer profile | Complete | Stats, notifications toggles, security, support, logout         |
| Customer profile edit | Complete | Personal info form, change password                        |

---

## Architecture decisions locked in

| Decision                    | Choice                                                      |
|-----------------------------|-------------------------------------------------------------|
| ORM                         | Sequelize via `@nestjs/sequelize` + `sequelize-typescript`  |
| Auth                        | JWT access (1h) + refresh (30d) in localStorage             |
| File storage                | MinIO (S3-compatible); presigned URLs for access            |
| Staff management            | Staff are Users with `role IN (clerk, admin)`; `active` bool for soft disable |
| Settings storage            | `settings` table — key/value rows, JSON-serialized values   |
| Reports                     | Raw `sequelize.query()` SQL — 6 aggregations                |
| Admin login route           | `/admin/login` (separate page, `layout: false`)             |
| Customer login route        | `/auth`                                                     |
| DB name                     | `kaban`                                                     |
| Backend port                | `3001`                                                      |
| Frontend port               | `3000`                                                      |
| Push notifications          | Web Push API + VAPID; one subscription per user             |

---

## What the agent must NOT do

- Do not switch the ORM back to TypeORM — the project uses Sequelize
- Do not change the DB name from `kaban`
- Do not touch M-Pesa or Africa's Talking integrations — they are stubs intentionally
- Do not re-debate architecture decisions listed above
