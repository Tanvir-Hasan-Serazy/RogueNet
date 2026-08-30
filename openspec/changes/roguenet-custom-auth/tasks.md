# Tasks — RogueNet Custom Auth (Prisma 8 RC, JWT+Rotation, Bcrypt, Single Image)

> Mirror of `/TASK.md` for OpenSpec. Execute top-to-bottom.

## Phase 0 — Cleanup & Baseline (better-auth removal)

- [ ] 0.1 Remove `better-auth` from backend (`npm uninstall better-auth`, delete `src/core/auth/better-auth.config.ts`, remove `overrides` in `backend/package.json:32-36`, verify `grep -r better-auth backend/` 0)
- [ ] 0.2 Remove `better-auth` from frontend (`npm uninstall better-auth`, delete `src/lib/auth-client.ts:1-20`, replace `hooks/use-sign-up.ts:15` + `hooks/use-login.ts:13`, verify `grep -r authClient frontend/src` 0)
- [ ] 0.3 Env baseline (clear `BETTER_AUTH_*`, keep `DATABASE_URL`, `PORT`, `NEXT_PUBLIC_API_URL`, `FRONTEND_URL`, verify dev boots)

## Phase 1 — Env & Core Config

- [ ] 1.1 Expand `backend/src/core/config/env.ts:1-7` with zod: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLOUDINARY_*`, `SMTP_*`, `BCRYPT_ROUNDS=12`, `RATE_LIMIT_*`
- [ ] 1.2 Add `backend/src/core/config/constant.ts` (`ALLOWED_MIME`, `MAX_FILE_SIZE=5MB`, `CLOUDINARY_FOLDER=roguenet/avatar`, token expiries)
- [ ] 1.3 Install deps `bcrypt`, `jsonwebtoken`, `nodemailer`, `multer`, `express-rate-limit`, `@types/*`

## Phase 2 — Prisma 8 RC Data Model

- [ ] 2.1 Define `User { id cuid, email @unique, username @unique, passwordHash, dob, bio?, image?, imagePublicId?, emailVerified Boolean@default(false) }` in `prisma/contract.prisma`, run `npx prisma contract emit` + `npx prisma db init`
- [ ] 2.2 Define `Session { refreshTokenHash @unique, expiresAt }`, `VerificationToken { tokenHash @unique, expiresAt 24h }`, `PasswordResetToken { tokenHash @unique, expiresAt 15m, usedAt? }` relations to `User`, emit again
- [ ] 2.3 Verify `backend/src/core/db/client.ts:1-6` + `prisma/db.ts:1-9` exports `db.orm.public.*`

## Phase 3 — Auth Core

- [ ] 3.1 `src/core/auth/hash.ts` `bcrypt 12`
- [ ] 3.2 `src/core/auth/jwt.ts` access 15m + refresh raw/hash (crypto.randomBytes 32)
- [ ] 3.3 `src/core/auth/auth.validation.ts` zod (mirrors `frontend/src/schema/signUpSchema.ts:1-70`, age 13-120, username regex)
- [ ] 3.4 `src/core/auth/auth.service.ts` `register/login/refresh/verifyEmail/requestReset/resetPassword/getMe/logout` with rotation (delete old session, create new)
- [ ] 3.5 `src/core/auth/email.ts` `sendVerificationEmail` + `sendPasswordResetEmail` via nodemailer, dev console fallback + `GET /api/debug/last-email`
- [ ] 3.6 `src/core/auth/auth.controller.ts` + `auth.routes.ts` `POST /register, /login, /refresh, /logout, /logout-all, /verify-email, /resend-verification, /forgot-password, /reset-password, GET /me` + `Set-Cookie refreshToken httpOnly Lax`
- [ ] 3.7 `src/core/auth/auth.middleware.ts` `requireAuth` (Bearer or cookie) + `requireVerified` for media, attach `req.user`
- [ ] 3.8 Wire `src/index.ts:1-14` (`cookieParser`, `express.json`, `cors {credentials:true}`, `/api/auth`, error handler)

## Phase 4 — Rate Limiting

- [ ] 4.1 `src/core/http/rateLimit.ts` (`authLimiter 15m/5`, `verifyLimiter 1h/3`, `mediaSignLimiter 15m/20`, key by ip+email)
- [ ] 4.2 Apply to auth/media/profile routes, verify 6th hit 429 with `Retry-After`

## Phase 5 — Cloudinary + Single Profile Image

- [ ] 5.1 `src/core/media/cloudinary.ts` `cloudinary.config` + `getSignedParams(folder,publicId)` + `deleteImage`
- [ ] 5.2 `src/core/media/media.routes.ts` `POST /media/sign` (auth+verified, allowlist folder, `avatar_<userId>_<ts>`) + optional `POST /profile/avatar/upload` `multer.memoryStorage()`
- [ ] 5.3 `src/features/profile/profile.routes.ts` `PATCH /avatar {imageUrl,publicId}` (host check `res.cloudinary.com`), `DELETE /avatar`, `GET /profile/:username` public, delete old `imagePublicId` on update
- [ ] 5.4 Frontend wiring (`lib/axios.ts:3 withCredentials:true`, `hooks/use-auth.ts` memory accessToken, `verify-email/forgot/reset` pages, update `sign-up/page.tsx:60` + `login/page.tsx:59`, new `AvatarUploader.tsx` flow `sign → FormData→Cloudinary → PATCH`)

## Phase 6 — Email Templates & Forgot/Reset UI

- [ ] 6.1 Templates with `FRONTEND_URL` links, 24h/15m notices
- [ ] 6.2 Routes `/verify-email?token`, `/forgot-password`, `/reset-password?token`, handle expired/used 400, revoke all sessions on reset

## Phase 7 — Hardening & Verification

- [ ] 7.1 Security checks (no passwordHash leak, host validation, size/MIME, me checks user exists)
- [ ] 7.2 Integration cURL matrix (register 201, dup 409, pre-verify login 403, verify 200, login 200+cookie, me 200, refresh rotation, old refresh 401, sign 200→upload→PATCH→profile shows, rate 429, reset old pass 401 new pass 200)
- [ ] 7.3 Cleanup docs (`README.md` env template, fresh clone `prisma contract emit && prisma db init` works)
