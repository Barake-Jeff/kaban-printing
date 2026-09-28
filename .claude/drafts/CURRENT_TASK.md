# Current Task — Session Briefing

> Rewrite this file at the start of EVERY agent session.
> The agent reads this first. Keep it short and ruthlessly specific.
> The more precise this is, the less the agent will drift.

---

## Active session

```
Date:          [fill in]
Phase:         [e.g. Backend — Module build]
Active module: [e.g. auth, jobs, payments]
```

---

## What we are building right now

[1–3 sentences maximum. Be specific about the exact deliverable.]

Example:
> Building the `auth` module. Need `AuthService` with `register()` and `login()` methods,
> `AuthController` with POST /auth/signup and POST /auth/login, and the JWT strategy.
> The refresh token flow will be handled in a follow-up session.

---

## What is already done — do not touch

- [ ] Frontend (Nuxt 3) — complete, do not modify
- [ ] `PRINTEASE_PROJECT.md` — do not modify
- [ ] [list any completed backend modules here]

---

## What the agent must build this session

List the exact files to create, in order:

1. `src/modules/auth/dto/register.dto.ts`
2. `src/modules/auth/dto/login.dto.ts`
3. `src/modules/auth/entities/user.entity.ts`  ← wait, this is in users module, import it
4. `src/modules/auth/auth.service.ts`
5. `src/modules/auth/auth.controller.ts`
6. `src/modules/auth/auth.module.ts`
7. Update `src/app.module.ts` to import AuthModule

---

## Constraints for this session

- Follow `NESTJS_PATTERNS.md` for all module/controller/service structure
- Follow `DATABASE_SCHEMA.md` for entity field names and column mappings
- Do not start the payments module — that comes next session
- Schema changes go through sequelize-cli migrations (`kaban-backend/db/migrations/`); `synchronize` is off
- Do not add WebSockets yet

---

## Key decisions already made (don't re-debate these)

- ORM: Sequelize with MySQL
- Auth: JWT access token (15min) + refresh token (7d) stored in DB
- Password hashing: bcrypt with salt rounds 12
- Token payload: `{ sub: userId, role: UserRole }`
- Refresh tokens: stored as hash in refresh_tokens table, not raw

---

## Definition of done for this session

The session is complete when:
- [ ] `npm run start:dev` starts without TypeScript errors
- [ ] POST /api/auth/signup creates a user and returns tokens
- [ ] POST /api/auth/login returns tokens for valid credentials
- [ ] POST /api/auth/login returns 401 for wrong credentials
- [ ] A protected route with `@UseGuards(JwtAuthGuard)` rejects requests without a token

---

## Reference files the agent should read

In order of priority:
1. `.claude/commands/CURRENT_TASK.md` ← this file
2. `.claude/commands/PRINTEASE_PROJECT.md`
3. `.claude/commands/NESTJS_PATTERNS.md`
4. `.claude/commands/DATABASE_SCHEMA.md`
5. `.claude/commands/FRONTEND_CONTRACT.md`
6. [module-specific skill file if applicable]
