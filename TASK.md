# RogueNet — Custom Auth + Single Profile Image (Prisma 8 RC)

> Decisions locked:
> 1. **Prisma stays on `8.0.0-rc` (`@prisma/orm-postgres`, `prisma/contract.prisma`)**
> 2. **Auth: JWT access (15m) + httpOnly refresh (7d) + rotation**
> 3. **Email verification + forgot/reset password + rate limiter — all in MVP**
> 4. **Single image for both `profileImage` and `avatar` (`User.image`/`avatarUrl` same value, one column)**
> 5. **Hash: `bcrypt` (12 rounds)**

Execute top-to-bottom. Check each box only after its **Verify** passes.

---

## Phase 0 — Cleanup & Baseline (better-auth removal)

- [ ] **0.1 Remove better-auth from backend**
  - `npm uninstall better-auth` in `backend/`
  - Delete `backend/src/core/auth/better-auth.config.ts` (currently empty) and any imports referencing it
  - Remove `overrides` block in `backend/package.json:32-36` (`prisma` / `@prisma/client` alias for better-auth)
  - **Verify:** `grep -r "better-auth" backend/` returns 0; `npm ls better-auth` fails; `npm run dev` still boots on `env.PORT`

- [ ] **0.2 Remove better-auth from frontend**
  - `npm uninstall better-auth` in `frontend/` (also remove if `@better-auth/*` present)
  - Delete/replace `frontend/src/lib/auth-client.ts:1-20` (`createAuthClient` + `inferAdditionalFields { username,dob }`)
  - Replace `frontend/src/hooks/use-sign-up.ts:2,15` (`authClient.signUp.email`) and `frontend/src/hooks/use-login.ts:2,13` (`authClient.signIn.email`) with `axios` stubs (actual logic in 3.6)
  - **Verify:** `grep -r "better-auth\|authClient" frontend/src` returns 0; `npm run dev` (frontend) compiles; `npm run build` no type error

- [ ] **0.3 Env baseline**
  - Remove `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` from `backend/.env` and `frontend/.env`
  - Keep `DATABASE_URL`, `PORT`, `NEXT_PUBLIC_API_URL=http://localhost:5000`, `FRONTEND_URL=http://localhost:3000`
  - **Verify:** `backend/src/core/config/env.ts:1-7` loads without better-auth keys; both dev servers start

---

## Phase 1 — Env & Core Config

- [ ] **1.1 Expand `backend/src/core/config/env.ts`**
  - Add via `zod` validation: `DATABASE_URL`, `PORT`, `JWT_ACCESS_SECRET` (≥32 chars), `JWT_REFRESH_SECRET` (≥32), `JWT_ACCESS_EXPIRES=15m`, `JWT_REFRESH_EXPIRES=7d`, `FRONTEND_URL`, `BACKEND_URL=http://localhost:5000`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER=roguenet/avatar`, `BCRYPT_ROUNDS=12`, `EMAIL_FROM`, `SMTP_*` (or resend key), `RATE_LIMIT_WINDOW_MS`, `MAX_FILE_SIZE=5*1024*1024`
  - Export typed `env`
  - **Verify:** `tsx --eval "import {env} from './src/core/config/env.ts'; console.log(Object.keys(env))"` throws if any required missing, passes when set

- [ ] **1.2 Add constants `backend/src/core/config/constant.ts`**
  - `ALLOWED_MIME=["image/jpeg","image/png","image/webp"]`, `MAX_FILE_SIZE`, `CLOUDINARY_FOLDER`, `VERIFICATION_TOKEN_EXPIRES=24h`, `RESET_TOKEN_EXPIRES=15m`, `MIN_AGE=13`, `MAX_AGE=120`
  - **Verify:** Import in a test file compiles

- [ ] **1.3 Install deps**
  - `backend: npm i bcrypt jsonwebtoken nodemailer multer express-rate-limit zod cookie-parser`
  - `backend dev: npm i -D @types/bcrypt @types/jsonwebtoken @types/multer @types/cookie-parser`
  - Keep `cloudinary@2.11.0`, `cors`, `express`, `dotenv`, `prisma@8-rc`, `@prisma/orm-postgres`
  - **Verify:** `npm ls bcrypt jsonwebtoken` OK; no peer conflicts

---

## Phase 2 — Prisma 8 RC Data Model (stays on Next)

> All models go in `backend/prisma/contract.prisma` then `npx prisma contract emit` + `npx prisma db init` / `migration status`. API via `backend/prisma/db.ts:1-9` (`import { db } from "../../../prisma/db"`) + `db.orm.public.<Model>`.

- [ ] **2.1 Define `User` model**
  ```prisma
  model User {
    id              String   @id @default(cuid())
    email           String   @unique
    username        String   @unique
    name            String?  // display name, optional
    passwordHash    String
    dob             DateTime
    bio             String?  @db.Text
    image           String?  // SINGLE image — used as both avatar & profile image (Cloudinary secure_url)
    imagePublicId   String?  // Cloudinary public_id for deletion
    emailVerified   Boolean  @default(false)
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt
    @@index([createdAt])
  }
  ```
  - Add `@@unique([username])`, `@@unique([email])` (implicit via `@unique`)
  - **Verify:** `npx prisma contract emit` regenerates `prisma/contract.json` + `contract.d.ts` with `User`; `npx prisma db init` applies without error to Neon (`DATABASE_URL`)

- [ ] **2.2 Define auth support tables**
  ```prisma
  model Session {
    id               String   @id @default(cuid())
    userId           String
    refreshTokenHash String   @unique // sha256 of raw refresh token
    userAgent        String?
    ipAddress        String?
    expiresAt        DateTime
    createdAt        DateTime @default(now())
    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
    @@index([userId])
    @@index([expiresAt])
  }
  model VerificationToken {
    id        String   @id @default(cuid())
    userId    String   @unique
    tokenHash String   @unique // sha256
    expiresAt DateTime
    createdAt DateTime @default(now())
    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  }
  model PasswordResetToken {
    id        String   @id @default(cuid())
    userId    String
    tokenHash String   @unique
    expiresAt DateTime
    createdAt DateTime @default(now())
    usedAt    DateTime?
    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
    @@index([userId])
    @@index([expiresAt])
  }
  ```
  - **Verify:** `contract emit` again; tables visible in Neon (`SELECT tablename FROM pg_tables WHERE schemaname='public'`)

- [ ] **2.3 Export typed client**
  - Ensure `backend/src/core/db/client.ts:1-6` re-exports `db` and `type DbClient = typeof db` for services
  - **Verify:** `import { db } from "./prisma/db"; await db.orm.public.User.findMany()` typechecks

---

## Phase 3 — Custom Auth Core (bcrypt + JWT + rotation)

- [ ] **3.1 `backend/src/core/auth/hash.ts`**
  - `hashPassword(plain: string) => bcrypt.hash(plain, env.BCRYPT_ROUNDS)` (12)
  - `verifyPassword(plain, hash) => bcrypt.compare(plain, hash)`
  - **Verify:** unit test: hash then verify returns true, wrong returns false, hash != plain

- [ ] **3.2 `backend/src/core/auth/jwt.ts`**
  - `signAccessToken(payload: { userId: string }) => jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, { expiresIn: "15m" })`
  - `verifyAccessToken(token) => jwt.verify(...)`
  - `generateRefreshToken() => { raw: crypto.randomBytes(32).toString("hex"), hash: sha256(raw) }` (use `node:crypto`)
  - `signRefreshCookie` helper not needed — raw goes into httpOnly cookie, hash stored in `Session`
  - **Verify:** sign then verify returns sub; expired throws; raw ≠ hash

- [ ] **3.3 `backend/src/core/auth/auth.validation.ts` (zod)**
  - Reuse rules from `frontend/src/schema/signUpSchema.ts:1-70`:
    - `username: z.string().trim().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/)`
    - `email: z.string().trim().toLowerCase().pipe(z.email())`
    - `password: z.string().min(8).max(32)`
    - `confirmPassword` check
    - `dob: z.string().refine(Date.parse).refine(age>=13).refine(age<=120)` — then transform to `Date`
  - Exports `registerSchema`, `loginSchema {email,password}`, `verifyEmailSchema`, `forgotSchema {email}`, `resetSchema {token,password,confirmPassword}`
  - **Verify:** zod `safeParse` rejects age 12, accepts 20, rejects mismatch passwords

- [ ] **3.4 `backend/src/core/auth/auth.service.ts`**
  - `register({ username,email,password,confirmPassword,dob, ip, ua })`
    - validate, check `username` taken → 409, `email` taken → 409 (case-insensitive: store lowercased)
    - `passwordHash = hashPassword(password)`
    - `db.orm.public.User.create({ data: { username, email: email.toLowerCase(), passwordHash, dob: new Date(dob), emailVerified:false } })`
    - create `VerificationToken` (hash, expires 24h), send email via `email.ts` (see 3.5)
    - **Do NOT auto-login** until verified (or allow but `GET /me` shows `emailVerified:false` and block uploads — decide; spec blocked verification, here we block media until verified)
  - `login({ email,password, ip, ua })`
    - find user by lowercased email, `verifyPassword`, if `!emailVerified` → 403 `{code:"EMAIL_NOT_VERIFIED", resend:true}`
    - create `Session` with `refreshTokenHash`, `expiresAt = now+7d`
    - return `{ user, accessToken, refreshRaw }`
  - `refresh(refreshRaw, ip, ua)`
    - hash raw, find `Session` where `refreshTokenHash=hash && expiresAt > now`
    - if not found → 401 (reuse detection: if hash not found but user had session, optionally revoke all — log)
    - **Rotation:** delete old session, create new session with new hash, return new `accessToken` + new `refreshRaw`
  - `logout(refreshRaw)` → delete session by hash
  - `logoutAll(userId)` → `deleteMany where userId`
  - `verifyEmail(tokenRaw)` → hash, find `VerificationToken` where not expired, set `user.emailVerified=true`, delete token
  - `requestPasswordReset(email)` → if user exists, create `PasswordResetToken` (15m), send email (always 200 to avoid enumeration)
  - `resetPassword({ tokenRaw, password })` → hash, find valid not-used not-expired, hash new password, delete token, `logoutAll(userId)` (invalidate all sessions)
  - `getMe(userId)` → select without `passwordHash`
  - **Verify:** manual sql: user created, passwordHash starts `$2b$12$`, session row exists, rotation replaces hash, old raw 401

- [ ] **3.5 `backend/src/core/auth/email.ts`**
  - Nodemailer (or Resend) transport using `SMTP_*` or `RESEND_API_KEY`
  - `sendVerificationEmail(to, tokenRaw)` → link `${FRONTEND_URL}/verify-email?token=${tokenRaw}` (frontend route to build in 3.6)
  - `sendPasswordResetEmail(to, tokenRaw)` → `${FRONTEND_URL}/reset-password?token=${tokenRaw}`
  - In dev, log to console and expose `GET /api/debug/last-email` (guarded `NODE_ENV !== production`)
  - **Verify:** `npm run dev` + register → console logs verification URL; `curl` the link succeeds

- [ ] **3.6 `backend/src/core/auth/auth.controller.ts` + `auth.routes.ts`**
  - Routes (all `express.json()` + `cookieParser()` before):
    ```
    POST   /api/auth/register        → 201 { user: {id,username,email,dob,emailVerified} } + set? no cookie until verified
    POST   /api/auth/login           → 200 { user, accessToken } + Set-Cookie refreshToken=httpOnly Secure SameSite=Lax Path=/api/auth/refresh, Max-Age=7d
    POST   /api/auth/refresh         → 200 { accessToken } + rotated Set-Cookie (read cookie or body)
    POST   /api/auth/logout          → 200 clear cookie + delete session
    POST   /api/auth/logout-all      → 200 (auth)
    GET    /api/auth/me              → 200 { user } (auth)
    POST   /api/auth/verify-email    → 200 { message } body { token }
    POST   /api/auth/resend-verification → 200 (rate-limited, requires email)
    POST   /api/auth/forgot-password → 200 { message } always
    POST   /api/auth/reset-password  → 200 { message }
    ```
  - Cookie opts: `httpOnly:true, secure: process.env.NODE_ENV==="production", sameSite:"lax", path:"/", maxAge: 7*24*60*60*1000`
  - **Verify:** `curl -i POST /api/auth/register`, then `curl -i POST /api/auth/login -c cookies.txt` gets `Set-Cookie: refreshToken=...; HttpOnly`, `GET /api/auth/me -H "Authorization: Bearer <access>"` 200, without 401, with expired access but valid refresh `POST /api/auth/refresh -b cookies.txt` returns new access

- [ ] **3.7 `backend/src/core/auth/auth.middleware.ts`**
  - `requireAuth(req,res,next)` → read `Authorization: Bearer <token>` OR `req.cookies.accessToken` (if you also set it), `verifyAccessToken`, attach `req.user = { id: sub, ...fullUser? }` (fetch from DB for fresh `emailVerified/image`), `next()` else 401
  - `requireVerified` (optional) → checks `req.user.emailVerified` else 403 `EMAIL_NOT_VERIFIED` — use for media upload
  - **Verify:** unauth `GET /api/auth/me` 401, auth 200, unverified `PATCH /api/profile/avatar` 403

- [ ] **3.8 Wire in `backend/src/index.ts:1-14`**
  ```ts
  import cookieParser from "cookie-parser";
  import { env } from "./core/config/env";
  import { authRouter } from "./core/auth/auth.routes";
  app.use(cookieParser());
  app.use(express.json());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use("/api/auth", authRouter);
  app.get("/api/health", ...);
  // error handler
  ```
  - **Verify:** `npm run dev` boots, `GET /api/health` 200, `POST /api/auth/register` 201

---

## Phase 4 — Rate Limiting (now, not later)

- [ ] **4.1 `backend/src/core/http/rateLimit.ts`**
  - Using `express-rate-limit`:
    - `authLimiter: window 15m, max 5` for `/api/auth/login`, `/register`, `/forgot-password`
    - `verifyLimiter: window 1h, max 3` for `/resend-verification`
    - `mediaSignLimiter: window 15m, max 20` for `/api/media/sign` and `PATCH /api/profile/avatar`
  - Key by `ip + body.email` where applicable to prevent bypass
  - Return `429 { error:"Too many requests", retryAfter }`
  - **Verify:** `for i in {1..6}; do curl -s -o /dev/null -w "%{http_code}\n" POST /api/auth/login ...; done` → 6th is 429 with `Retry-After`

- [ ] **4.2 Apply**
  - `auth.routes.ts`: `rateLimit(authLimiter)` on login/register/forgot/reset
  - `media.routes.ts` + `profile.routes.ts`: `rateLimit(mediaSignLimiter)`
  - **Verify:** unauthenticated flood 429, does not affect `/api/health`

---

## Phase 5 — Cloudinary + Single Profile Image

> Single image = `User.image` (and optionally `imagePublicId`). Avatar and profile use same column — no separate gallery table.

- [ ] **5.1 `backend/src/core/media/cloudinary.ts`**
  - `import { v2 as cloudinary } from "cloudinary"; cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key:..., api_secret:... })`
  - `getSignedParams(folder, publicId?) => { timestamp=Math.floor(Date.now()/1000); signature=cloudinary.utils.api_sign_request({ timestamp, folder, public_id: publicId }, secret) }`
  - `deleteImage(publicId) => cloudinary.uploader.destroy(publicId)`
  - **Verify:** `node -e "import('./src/core/media/cloudinary.ts')"` configs without throw

- [ ] **5.2 `backend/src/core/media/media.routes.ts`**
  - `POST /api/media/sign` → `requireAuth` (+ `requireVerified` if you block unverified), `mediaSignLimiter`
    - Body `{ folder?: string }` validated allowlist `[env.CLOUDINARY_FOLDER]` (single folder for MVP)
    - `publicId = "avatar_${userId}_${Date.now()}"` (deterministic prefix for easy cleanup)
    - Return `{ cloudName, apiKey, folder, publicId, timestamp, signature }` (expires 10m)
    - **Verify:** unauth 401, unverified 403 (if enabled), auth 200 with valid signature; try uploading with tampered timestamp → Cloudinary 401

  - Proxy fallback (optional but recommended):
    - `POST /api/profile/avatar/upload` → `requireAuth`, `requireVerified`, `multer.memoryStorage()`, `limits: { fileSize: MAX_FILE_SIZE }`, `fileFilter: ALLOWED_MIME`
    - `cloudinary.uploader.upload_stream({ folder, public_id: publicId, resource_type:"image", transformation:[{width:800,height:800,crop:"limit"}, {quality:"auto"}] })`
    - On success, update user, delete old `imagePublicId` if exists
    - **Verify:** `curl -F "file=@./test.jpg" POST /api/profile/avatar/upload -H "Authorization: Bearer ..."` 200, DB updated

- [ ] **5.3 `backend/src/features/profile/profile.routes.ts` (or `src/core/profile/*`)**
  - `PATCH /api/profile/avatar` → `requireAuth`, `requireVerified`, body `{ imageUrl: string, publicId: string }`
    - Validate `imageUrl` host `res.cloudinary.com` + `imageUrl.includes(env.CLOUDINARY_CLOUD_NAME)`, `publicId` starts with `avatar_${userId}`
    - Optionally verify via `cloudinary.api.resource(publicId)` (costs 1 API call — do only if you suspect client spoof)
    - Load old user, `db.orm.public.User.update({ where:{id}, data:{ image: imageUrl, imagePublicId: publicId } })`
    - Delete old Cloudinary image via `deleteImage(oldPublicId)` (fire-and-forget, don't fail request if delete fails)
    - Return `{ user: { id, username, image, imagePublicId } }`
  - `DELETE /api/profile/avatar` → `requireAuth`, clear `image` + `imagePublicId`, `deleteImage`
  - `GET /api/profile/:username` public → return `{ id, username, name, bio, image, emailVerified, createdAt }` (never passwordHash)
  - `GET /api/profile/me` alias to `GET /api/auth/me` or reuse
  - **Verify:** 
    - sign → direct upload to `https://api.cloudinary.com/v1_1/<cloud>/image/upload` with FormData `{file, api_key, timestamp, signature, folder, public_id}` → get `secure_url/public_id` → `PATCH` 200 → DB `image` matches → `GET /api/profile/:username` shows it
    - second upload deletes old image (check Cloudinary Media Library old publicId gone)
    - invalid host URL 400, unverified 403, unauth 401

- [ ] **5.4 Frontend upload integration**
  - `frontend/src/lib/axios.ts:1-11` already `withCredentials:true`; ensure `baseURL=http://localhost:5000`
  - New `frontend/src/hooks/use-auth.ts`:
    ```ts
    export const useMe = () => useQuery({ queryKey:["me"], queryFn: async()=> (await api.get("/api/auth/me",{headers:{Authorization:`Bearer ${accessToken}`} })).data })
    export const useLogin/useRegister/useLogout/useRefresh` via `api.post("/api/auth/...")`
    ```
  - Store `accessToken` in memory (zustand or React context, **not** localStorage) + `refresh` via httpOnly cookie automatic; on 401 try `POST /api/auth/refresh` then retry
  - Create `frontend/src/app/(auth)/verify-email/page.tsx` — reads `?token=`, calls `POST /api/auth/verify-email`, shows success/auto-redirect to login
  - Create `frontend/src/app/(auth)/forgot-password/page.tsx` + `reset-password/page.tsx`
  - Update `frontend/src/app/sign-up/page.tsx:60-77` to call `api.post("/api/auth/register", {username,email,password,confirmPassword,dob})` → toast “Check email to verify” → redirect to login
  - Update `frontend/src/app/login/page.tsx:59-72` to call `api.post("/api/auth/login")`, store accessToken, `router.push("/")`
  - New `frontend/src/components/profile/AvatarUploader.tsx`:
    - Props `{ currentImage?: string, onUploaded(url) }`
    - Input `accept="image/jpeg,image/png,image/webp"`, `max 5MB`, preview URL preview
    - Flow: `POST /api/media/sign` (with auth header) → `FormData` to Cloudinary → `PATCH /api/profile/avatar`
    - States: idle/uploading/success/error, drag-drop optional
  - Wire into `frontend/src/app/profile/[username]/page.tsx` (create if not exists) + Settings page
  - **Verify:** register → verify email link works (dev console), login → logout → refresh rotation → upload avatar → refresh page persists (DB), delete avatar clears

---

## Phase 6 — Email Templates & Forgot/Reset UI

- [ ] **6.1 Email content**
  - Minimal HTML templates for verification + reset (plain text fallback)
  - Include `FRONTEND_URL` links, expiry notice (24h / 15m)
  - **Verify:** emails received in Mailtrap/Ethereal or console; link clickable

- [ ] **6.2 Frontend routes**
  - `/verify-email?token=...` → auto-verify on mount
  - `/forgot-password` → form email → `POST /forgot-password` → toast “If account exists, email sent” (no enumeration)
  - `/reset-password?token=...` → form new password + confirm → `POST /reset-password` → redirect login
  - **Verify:** expired token 400 `Token expired`, used token 400, success 200, old sessions revoked (try old access 401)

---

## Phase 7 — Hardening & Verification Matrix

- [ ] **7.1 Security checks**
  - Passwords never returned in any `GET`; `select` excludes `passwordHash`
  - `GET /api/auth/me` validates not just token signature but user still exists
  - `imageUrl` validation prevents SSRF (must be Cloudinary host)
  - `MAX_FILE_SIZE` enforced both multer and client + Cloudinary `max_bytes`
  - **Verify:** `curl GET /api/auth/me` no `passwordHash`; `PATCH avatar {imageUrl:"https://evil.com/x.jpg"}` 400

- [ ] **7.2 Integration test script (manual cURL or vitest)**
  ```bash
  # 1 register
  curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{...valid...}' # 201
  curl -X POST .../register same username # 409
  curl -X POST .../login before verify # 403 EMAIL_NOT_VERIFIED
  # 2 verify
  curl -X POST .../verify-email -d '{"token":"..."}' # 200
  curl -X POST .../login -c cookies.txt -d '{email,password}' # 200 + Set-Cookie + {accessToken}
  # 3 me/refresh/logout
  curl http://localhost:5000/api/auth/me -H "Authorization: Bearer $AT" # 200
  curl -X POST .../refresh -b cookies.txt -c cookies.txt # 200 new AT, old refresh fails
  # 4 upload
  curl -X POST .../media/sign -H "Authorization: Bearer $AT" # 200
  # direct upload to cloudinary, then PATCH avatar # 200
  curl http://localhost:5000/api/profile/:username # shows image
  # 5 rate limit
  for i in 1..6; do curl -s -w "%{http_code}\n" POST .../login; done # 6th 429
  # 6 reset
  curl -X POST .../forgot-password -d '{"email":"..."}' # 200
  curl -X POST .../reset-password -d '{"token":"...","password":"new8chars","confirmPassword":"new8chars"}' # 200
  curl -X POST .../login old password # 401
  curl -X POST .../login new password # 200
  ```

- [ ] **7.3 Cleanup & docs**
  - Update `README.md` with `env` template (`cp .env.example .env`)
  - Remove any leftover `better-auth` docs/comments
  - **Verify:** fresh clone `npm i && npx prisma contract emit && npx prisma db init` + dev start works

---

## Execution Tips

- Do tasks **in order**; each phase depends on previous. Commit after each `Verify` green.
- Single image: never add `UserPhoto` table — reuse `User.image`/`imagePublicId`. If later you need gallery, add table then.
- Keep `prisma contract emit` after every `contract.prisma` edit.

Good luck — start at **0.1** and ping when hitting a failing `Verify`.
