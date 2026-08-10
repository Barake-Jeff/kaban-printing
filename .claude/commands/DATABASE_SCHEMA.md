# Database Schema — PrintEase MySQL

> This is the authoritative database design.
> All Sequelize models must match these tables exactly.
> Column names in MySQL are snake_case. TypeScript properties are camelCase (use `field:` option in column definitions).

---

## Database name

```
kaban
```

---

## Tables overview

| Table                | Purpose                                          |
|----------------------|--------------------------------------------------|
| `users`              | All users: customers, clerks, admins             |
| `jobs`               | Print job records                                |
| `files`              | Uploaded file metadata                           |
| `payments`           | Payment records linked to jobs                   |
| `refresh_tokens`     | JWT refresh token store (for logout/blacklist)   |
| `push_subscriptions` | Web Push subscription endpoints per user         |
| `notifications_log`  | Record of every notification sent (push/SMS/WA)  |
| `settings`           | Admin-configurable key-value settings store      |

---

## Table: `users`

```sql
CREATE TABLE users (
  id             VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  name           VARCHAR(255) NOT NULL,
  phone          VARCHAR(20)  NOT NULL UNIQUE,
  house_number   VARCHAR(20)  NOT NULL,
  estate         VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('customer', 'clerk', 'admin') NOT NULL DEFAULT 'customer',
  active         TINYINT(1)   NOT NULL DEFAULT 1,      -- FALSE = deactivated staff
  notif_sms      BOOLEAN      NOT NULL DEFAULT TRUE,
  notif_whatsapp BOOLEAN      NOT NULL DEFAULT FALSE,
  credit_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  loyalty_points INT          NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Sequelize model property mapping:**

| MySQL column     | TypeScript property  | Notes                              |
|------------------|----------------------|------------------------------------|
| `id`             | `id`                 |                                    |
| `name`           | `name`               |                                    |
| `phone`          | `phone`              |                                    |
| `house_number`   | `houseNumber`        |                                    |
| `estate`         | `estate`             |                                    |
| `password_hash`  | `passwordHash`       |                                    |
| `role`           | `role`               |                                    |
| `active`         | `active`             | Default TRUE; FALSE = deactivated  |
| `notif_sms`      | `notifSms`           |                                    |
| `notif_whatsapp` | `notifWhatsapp`      |                                    |
| `credit_balance` | `creditBalance`      |                                    |
| `loyalty_points` | `loyaltyPoints`      |                                    |
| `created_at`     | `createdAt`          |                                    |
| `updated_at`     | `updatedAt`          |                                    |

> **Staff deactivation:** Do NOT delete staff records. Set `active = false` to deactivate and `active = true` to reactivate. This preserves audit history.

---

## Table: `jobs`

```sql
CREATE TABLE jobs (
  id              VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  user_id         VARCHAR(36)  NOT NULL,
  file_id         VARCHAR(36)  NULL,
  file_name       VARCHAR(500) NULL,
  file_key        VARCHAR(1000) NULL,  -- MinIO object key for the original file
  instructions    TEXT         NULL,
  pages           INT          NOT NULL DEFAULT 1,
  copies          INT          NOT NULL DEFAULT 1,
  color_mode      ENUM('bw', 'color') NOT NULL DEFAULT 'bw',
  sides           ENUM('single', 'double') NOT NULL DEFAULT 'single',
  paper_size      VARCHAR(20)  NOT NULL DEFAULT 'A4',
  delivery_type   ENUM('pickup', 'delivery') NOT NULL DEFAULT 'pickup',
  payment_method  ENUM('mpesa', 'pay_on_pickup') NOT NULL DEFAULT 'mpesa',
  payment_status  ENUM('unpaid', 'paid', 'pay_on_pickup') NOT NULL DEFAULT 'unpaid',
  status          ENUM('pending', 'printing', 'ready', 'delivered') NOT NULL DEFAULT 'pending',
  cost            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  delivery_fee    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  mpesa_ref       VARCHAR(50)  NULL,
  admin_notes     TEXT         NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_payment_status (payment_status),
  INDEX idx_created_at (created_at)
);
```

**Sequelize model property mapping:**

| MySQL column      | TypeScript property  |
|-------------------|----------------------|
| `id`              | `id`                 |
| `user_id`         | `userId`             |
| `file_id`         | `fileId`             |
| `file_name`       | `fileName`           |
| `file_key`        | `fileKey`            |
| `instructions`    | `instructions`       |
| `pages`           | `pages`              |
| `copies`          | `copies`             |
| `color_mode`      | `colorMode`          |
| `sides`           | `sides`              |
| `paper_size`      | `paperSize`          |
| `delivery_type`   | `deliveryType`       |
| `payment_method`  | `paymentMethod`      |
| `payment_status`  | `paymentStatus`      |
| `status`          | `status`             |
| `cost`            | `cost`               |
| `delivery_fee`    | `deliveryFee`        |
| `mpesa_ref`       | `mpesaRef`           |
| `admin_notes`     | `adminNotes`         |
| `created_at`      | `createdAt`          |
| `updated_at`      | `updatedAt`          |

---

## Table: `files`

> `file_key` and `pdf_key` store MinIO object keys (e.g. `originals/userId/uuid.pdf`).
> Presigned URLs are generated at runtime — never stored in the DB.

```sql
CREATE TABLE files (
  id            VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id       VARCHAR(36)   NOT NULL,
  original_name VARCHAR(500)  NOT NULL,
  stored_name   VARCHAR(500)  NOT NULL,
  mime_type     VARCHAR(100)  NOT NULL,
  size_bytes    INT           NOT NULL,
  page_count    INT           NOT NULL DEFAULT 1,
  file_key      VARCHAR(1000) NOT NULL,   -- MinIO object key for original file
  pdf_key       VARCHAR(1000) NULL,       -- MinIO object key for converted PDF
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);
```

**Sequelize model property mapping:**

| MySQL column    | TypeScript property  |
|-----------------|----------------------|
| `original_name` | `originalName`       |
| `stored_name`   | `storedName`         |
| `mime_type`     | `mimeType`           |
| `size_bytes`    | `sizeBytes`          |
| `page_count`    | `pageCount`          |
| `file_key`      | `fileKey`            |
| `pdf_key`       | `pdfKey`             |
| `created_at`    | `createdAt`          |

---

## Table: `payments`

```sql
CREATE TABLE payments (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  job_id          VARCHAR(36)   NOT NULL UNIQUE,
  user_id         VARCHAR(36)   NOT NULL,
  method          ENUM('mpesa', 'cash', 'pay_on_pickup') NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  status          ENUM('pending', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  mpesa_ref       VARCHAR(50)   NULL,
  mpesa_receipt   VARCHAR(100)  NULL,
  phone           VARCHAR(20)   NULL,
  merchant_req_id VARCHAR(100)  NULL,
  checkout_req_id VARCHAR(100)  NULL,
  result_code     VARCHAR(10)   NULL,
  result_desc     VARCHAR(500)  NULL,
  paid_at         DATETIME      NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_checkout_req_id (checkout_req_id),
  INDEX idx_mpesa_ref (mpesa_ref)
);
```

The `checkout_req_id` index is critical — Daraja's callback identifies the payment using `CheckoutRequestID`.

---

## Table: `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id           VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  user_id      VARCHAR(36)  NOT NULL,
  token_hash   VARCHAR(255) NOT NULL UNIQUE,
  expires_at   DATETIME     NOT NULL,
  revoked      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_token_hash (token_hash)
);
```

Store a hash of the token, not the token itself. On refresh, hash the incoming token and look it up.

---

## Table: `push_subscriptions`

```sql
CREATE TABLE push_subscriptions (
  id         VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id    VARCHAR(36) NOT NULL,
  endpoint   TEXT        NOT NULL,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);
```

**Sequelize model:** `src/modules/push/models/push-subscription.model.ts`

One subscription per user — subscribing again replaces the old row.

---

## Table: `notifications_log`

```sql
CREATE TABLE notifications_log (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  job_id      VARCHAR(36)  NOT NULL,
  user_id     VARCHAR(36)  NOT NULL,
  channel     ENUM('sms', 'whatsapp', 'push') NOT NULL,
  trigger     VARCHAR(100) NOT NULL,
  phone       VARCHAR(20)  NULL,
  message     TEXT         NOT NULL,
  status      ENUM('sent', 'failed') NOT NULL DEFAULT 'sent',
  provider_id VARCHAR(200) NULL,
  sent_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  INDEX idx_job_id (job_id)
);
```

**Sequelize model property mapping:**

| MySQL column  | TypeScript property |
|---------------|---------------------|
| `job_id`      | `jobId`             |
| `user_id`     | `userId`            |
| `channel`     | `channel`           |
| `trigger`     | `trigger`           |
| `phone`       | `phone`             |
| `message`     | `message`           |
| `status`      | `status`            |
| `provider_id` | `providerId`        |
| `sent_at`     | `sentAt`            |

---

## Table: `settings`

Stores admin-configurable key-value pairs. Values are JSON-serialized strings.

```sql
CREATE TABLE settings (
  `key`   VARCHAR(50) PRIMARY KEY,
  `value` LONGTEXT    NOT NULL
);
```

**Sequelize model:** `src/modules/admin/models/setting.model.ts`

```typescript
@Table({ tableName: 'settings', timestamps: false })
export class Setting extends Model {
  @Column({ type: DataType.STRING(50), primaryKey: true })
  key: string;

  @Column({ type: DataType.TEXT('long'), allowNull: false })
  value: string;
}
```

Known keys: `business`, `pricing`, `notificationMatrix`.
Values are `JSON.stringify`-ed objects.
Use `model.upsert({ key, value })` to save — never `create` (would fail on duplicate key).

---

## Pricing logic (implemented in JobsService)

```typescript
const PRICING = {
  bwPerPage:    5,    // KES per page black & white
  colorPerPage: 20,   // KES per page colour
  doubleSidedMultiplier: 1.8,
  deliveryFee:  50,   // KES flat delivery fee
};

function calculateCost(pages, copies, colorMode, sides, deliveryType): number {
  const perPage = colorMode === 'color' ? PRICING.colorPerPage : PRICING.bwPerPage;
  const sidesMult = sides === 'double' ? PRICING.doubleSidedMultiplier : 1;
  const printCost = Math.round(pages * copies * perPage * sidesMult);
  const deliveryFee = deliveryType === 'delivery' ? PRICING.deliveryFee : 0;
  return printCost + deliveryFee;
}
```

---

## Migration strategy

Use Sequelize `synchronize: true` in development (auto-creates/alters tables).
For new columns on existing tables in dev, run ALTER TABLE manually if `synchronize` doesn't pick them up (e.g. after a hot-reload without full restart):

```sql
ALTER TABLE users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1;
```

Never use `sync({ force: true })` in production.

---

## Seed data (for development)

```
Admin:    phone 0700000000, password admin,    role admin,    active true
Clerk:    phone 0711000000, password clerk,    role clerk,    active true
Customer: phone 0712345678, password password, role customer, houseNumber 14B, estate Westlands Gardens
```

Run with: `npm run seed` (from `kaban-backend/`)
