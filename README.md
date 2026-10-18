# ASU Lost & Found

A mobile app that helps students at Applied Science Private University get lost items back. Students post what they lost or found on campus, the app suggests matches between the two, and the real owner proves an item is theirs before it is handed over.

> Work in progress. Accounts, posts with photos, ownership claims, the handover and match suggestions are done; moderation and polish are next.

## How it works

1. A student finds a black wallet near the library and posts it with a blurred photo and the place on campus.
2. The finder adds private details only the owner would know, such as what is inside or a sticker on it. These are never shown publicly.
3. The owner sees the post (or gets it suggested after posting their own "Lost" post) and answers the finder's questions.
4. The finder accepts or rejects the claim. Valuable items go to the university security office, and the owner picks them up there with their student ID.

## Planned features

- [x] Project setup: API, database, mobile app, Docker, CI
- [x] Accounts with university email only, email verification, roles (student, security office, admin)
- [x] Lost and found posts with photos (blurred publicly, EXIF removed) and campus locations
- [x] Ownership claims with private questions, limited attempts and claim history
- [x] Handover: in-app messages, pickup code, security office desk
- [x] Match suggestions between lost and found posts
- [ ] Moderation: reports, hidden posts, banned accounts

## Tech stack

| Part | Tools |
| --- | --- |
| Mobile app | React Native, Expo SDK 58, TypeScript, Expo Router, TanStack Query |
| API | Node.js 24, NestJS 12, TypeScript, Prisma 7 |
| Database | PostgreSQL 17 |
| Tests | Vitest, Supertest, Testcontainers (backend); Jest, React Native Testing Library (app) |
| Tooling | Docker Compose, GitHub Actions, gitleaks |

## Project structure

```
asu-lost-and-found/
├── backend/                 NestJS API
│   ├── prisma/              schema and SQL migrations
│   ├── src/
│   │   ├── auth/            sign-up, email codes, sign-in, tokens, guards
│   │   ├── claims/          ownership claims, answers, claim history
│   │   ├── handovers/       messages, pickup codes, the security office desk
│   │   ├── matches/         suggestions between lost and found posts
│   │   ├── cli/             set-role command
│   │   ├── config/          environment validation
│   │   ├── health/          GET /api/health
│   │   ├── mail/            email outbox and SMTP sender
│   │   ├── photos/          resizing, blurring and serving photos
│   │   ├── places/          campus places
│   │   ├── posts/           lost and found posts, search
│   │   ├── prisma/          database client
│   │   ├── rate-limit/      request limits
│   │   ├── storage/         file storage (a Docker volume, swappable)
│   │   └── users/           profiles and roles
│   └── test/                integration tests on a real PostgreSQL
├── mobile/                  Expo app
│   └── src/
│       ├── api/             API client with automatic token refresh
│       ├── app/             screens (Expo Router): sign-in screens, then Browse, My posts, My claims, Messages and Account tabs (and Desk for security staff)
│       ├── components/      form fields, buttons, screen layout
│       ├── session/         signed-in state and token storage
│       └── test/
├── docker/postgres/         database setup script
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Run it locally

You need Docker, Node.js 24 or newer, and an Android emulator (or a phone with Expo Go).

### 1. API and database

```bash
cp .env.example .env
```

Set `DB_ADMIN_PASSWORD`, `DB_PASSWORD` and `DB_APP_PASSWORD` in `.env`, each to a different output of `openssl rand -hex 24`, and `JWT_SECRET` and `SERIAL_HASH_KEY` each to a different output of `openssl rand -base64 48`. Then:

```bash
docker compose up -d --build
```

The API answers at http://localhost:4000/api/health with `{"status":"ok","database":"up"}`. Emails (verification and password reset codes) go to the Mailpit inbox at http://localhost:8027 until you point the `MAIL_*` settings at a real SMTP server.

### Making the first admin

Everyone signs up as a student. To give an account another role (`STUDENT`, `SECURITY` or `ADMIN`):

```bash
docker compose exec backend node dist/cli/set-role.js you@asu.edu.jo ADMIN
```

A `SECURITY` account sees a Desk tab in the app, for the university security office.

### 2. Mobile app

```bash
cd mobile
cp .env.example .env
npm install
npm run android
```

Create an account with an `@asu.edu.jo` address and read the code in Mailpit. The Android emulator reaches your computer at `10.0.2.2`; for a real phone, put your computer's network address in `mobile/.env` and set `APP_BIND=0.0.0.0` in the root `.env`.

### Running the API outside Docker

With only the database running (`docker compose up -d db`), copy `backend/.env.example` to `backend/.env`, fill in the passwords, `JWT_SECRET` and the same `SERIAL_HASH_KEY` as in the root `.env`, and run:

```bash
cd backend
npm install
npm run db:migrate
npm run start:dev
```

## API

All routes start with `/api`. Everything except the ones marked public needs `Authorization: Bearer <access token>`.

| Method and path | Public | What it does |
| --- | --- | --- |
| `POST /auth/register` | yes | Create an account with a university email; emails a 6-digit code |
| `POST /auth/resend-code` | yes | Send a new verification code (at most one a minute) |
| `POST /auth/verify-email` | yes | Email, password and code; verifies the email and signs in |
| `POST /auth/login` | yes | Returns an access token (15 minutes) and a refresh token (30 days) |
| `POST /auth/refresh` | yes | Swaps a refresh token for a new pair |
| `POST /auth/logout` | yes | Ends the sign-in that the refresh token belongs to |
| `POST /auth/forgot-password` | yes | Emails a password reset code |
| `POST /auth/reset-password` | yes | Sets a new password with the code and signs out every device |
| `GET /users/me` | no | The signed-in user's profile |
| `GET /places` | no | Campus places to choose from |
| `GET /posts` | no | Open posts, newest first; filters `type`, `category`, `placeId`, search `q`, paging with `cursor` and `limit` |
| `GET /posts/mine` | no | The signed-in student's posts, closed ones included |
| `GET /posts/:id` | no | One post (a closed post only for its author) |
| `POST /posts` | no | Create a post: form fields plus up to 4 photos (`multipart/form-data`); a found item also needs 1 to 3 questions for the owner |
| `PATCH /posts/:id` | no | Edit your own open post |
| `POST /posts/:id/close` | no | Close your own post |
| `GET /photos/:id` | no | The photo other students see (blurred for found items) |
| `GET /photos/:id/original` | no | The unblurred photo, only for the student who posted it or whose claim was accepted |
| `GET /posts/:id/claim-form` | no | The finder's questions, whether a serial number is needed, claims left and your own claim |
| `POST /posts/:id/claims` | no | Claim a found item by answering its questions |
| `GET /posts/:id/claims` | no | For the finder: their private notes and every claim on the item |
| `POST /claims/:id/accept` | no | Accept a claim; the item is marked claimed and the other waiting claims are closed |
| `POST /claims/:id/reject` | no | Reject a claim |
| `POST /claims/:id/withdraw` | no | Take back your own claim while it is waiting |
| `GET /claims/mine` | no | The signed-in student's claims |
| `GET /admin/claimants` | no | Admin only: students with their rejected and total claims |
| `GET /handovers/mine` | no | The signed-in student's handovers with the last message and unread count |
| `GET /posts/:id/handover` | no | For the finder and the owner: the handover; the owner also sees the pickup code |
| `GET /posts/:id/messages` | no | The finder's and the owner's messages, oldest first; marks them read |
| `POST /posts/:id/messages` | no | Send a message (until the item is handed over) |
| `POST /posts/:id/handover/return` | no | The finder, or the security office for items it holds, types the owner's code; the item becomes returned |
| `POST /posts/:id/handover/new-code` | no | The owner replaces a code that was locked after 5 wrong tries |
| `POST /posts/:id/desk` / `DELETE /posts/:id/desk` | no | The finder takes a found item to the security office, or changes their mind before it arrives |
| `GET /desk/items?status=` | no | Security staff only: items on the way to the desk, or at the desk |
| `POST /desk/items/:id/receive` | no | Security staff only: the desk has the item |
| `GET /posts/:id/matches` | no | For the author of a lost post: found items that may be theirs, with the reasons |
| `POST /posts/:id/matches/:foundId/dismiss` | no | Hide a suggested found item ("Not mine") |
| `GET /health` | yes | API and database status |

## Tests

| Command | Folder | What it runs |
| --- | --- | --- |
| `npm test` | `backend/` | Unit tests |
| `npm run test:e2e` | `backend/` | API tests against PostgreSQL 17 in Docker (Testcontainers) |
| `npm run lint` / `npm run typecheck` | `backend/`, `mobile/` | oxlint or ESLint, TypeScript |
| `npm test` | `mobile/` | Sign-in, posting, claim, handover and matching flows on the real screens, API client and token refresh |

GitHub Actions runs all of them on every pull request, plus a gitleaks secret scan and a Docker build that starts the whole stack and calls the health endpoint.

## Security

- Three database logins: the `postgres` superuser only creates the database, `lostfound` owns it and runs the migrations, and the API connects as `lostfound_app`, which can read and write rows but cannot create, change or drop tables. Neither of the last two is a superuser; integration tests check all of this.
- Only university emails can sign up, and an account works only after the emailed 6-digit code is entered. Codes are stored hashed, expire after 15 minutes and allow 5 tries. Each account gets at most 5 codes and 15 wrong guesses a day, so asking for new codes doesn't give an attacker more tries.
- Verifying an email needs the password as well as the code, so nobody can sign up with someone else's email first and take the account over once the real owner verifies it.
- Passwords hashed with bcrypt (cost 12). Sign-in gives the same answer for a wrong password and an unknown email, and takes the same time. Sign-up, resending a code and password reset give the same answer whether or not an email has an account. Emails never include text typed into the sign-up form, and names may only contain letters, spaces, apostrophes, dots and hyphens.
- Short-lived access tokens (JWT, HS256) and refresh tokens that work once: each refresh replaces the token, and reusing an old one ends that whole sign-in. Refresh tokens are stored hashed. Changing the password signs out every device and ends access tokens issued before it. In the app the refresh token lives in the device's secure storage.
- Every route needs a signed-in user unless it is marked public, and the user is checked against the database on every request. Roles are checked by a guard; extra fields such as `role` in a sign-up request are refused.
- Rate limits: 10 requests an hour that send an email (claims included) and 10 password or code attempts every 15 minutes per network address, and 5 posts with photos a minute per student (all set in `.env`). Once signed in, requests are counted per student, so students sharing the campus Wi-Fi don't use up each other's limit.
- Emails go through an outbox table in the same transaction as the change that triggers them, and are retried with backoff if the mail server is down.
- Photos: every upload is decoded and saved again as a new JPEG, so only real JPEG, PNG or WebP images are accepted and all EXIF data (GPS position, phone model) is removed. At most 4 photos of 8 MB each per post, and 10 posts a day per student, also when many arrive at the same moment.
- Uploads can't overload the server: each photo's header is checked before it is decoded (at most 25 megapixels, no 16-bit or animated images), photos are processed one at a time with at most two jobs running across the whole server, and the backend container has a memory limit. The app shrinks photos on the phone before uploading them.
- Found items are shown blurred to everyone except the student who posted them, so only the real owner can describe the details. Originals are only ever sent to the poster and, once a claim is accepted, to that claimant. Photos are fetched by id through the API after the sign-in check; file names on disk are random and never leave the server.
- A post that is closed disappears for everyone but its author, photos included. Editing or closing someone else's post answers 404, as if it didn't exist.
- Claims: claimers answer the finder's questions without seeing the private notes, and only the finder sees the answers next to the notes. Someone else's claim answers 404. A student gets 3 claims per item, and a withdrawn claim counts like a rejected one, so withdrawing and claiming again can't flood the finder with emails. Withdrawn claims disappear from the finder's list. New claims and decisions on one item wait for each other, and the database allows one waiting claim per student per item and one accepted claim per item, so two accepts at the same moment can't both win. Claim emails never include the answers or the notes.
- Serial numbers and IMEIs are never stored as typed: the server keeps an HMAC-SHA256 fingerprint made with a secret key from `.env` (`SERIAL_HASH_KEY`), so a copy of the database alone can't be used to work them out. It compares that with the claimer's number, and only the finder learns whether it matched.
- Handover: only the finder and the student whose claim was accepted can read the chat or the handover; anyone else gets 404. The pickup code is shown only to the owner, and only the person holding the item can type it: the finder, or security staff once the item is at the desk (never for their own item). 5 wrong codes lock it until the owner asks for a new one, even when guesses arrive at the same moment, and code attempts count toward the password and code rate limit. Message emails never include the text and go out at most once an hour per chat, only to someone who hasn't had it open for 5 minutes and has opened it since the last email.
- The security office sees the finder's name and email, the owner's full name once it has the item (to check the student ID at pickup), and the original photos of items it is handling. Only accounts with the security role can open the desk.
- Match suggestions are shown only to the author of the lost post, with the same blurred photos as Browse. The match email names only the student's own lost item. It goes out only when the titles themselves are alike, to at most 3 students per found item, and nobody gets more than one a day.
- A student or an item that has claims can't be deleted, so the claim history and the 3-claims limit can't be reset. Closing a found item closes its waiting claims and emails those claimants.
- Emails to a real mail server must use TLS; only the local Mailpit inbox is allowed plain SMTP.
- Configuration comes from environment variables and is validated at startup. Secrets live only in git-ignored `.env` files; the repository has `.env.example` copies.
- Security headers through Helmet, request bodies validated and stripped of unknown fields.
- The database and API ports listen on this machine only unless `APP_BIND` says otherwise.
- The Docker images run as a non-root user, and the API image holds only production packages (no Prisma CLI or TypeScript).

## Known limits

- Rate limits are kept in memory, so they assume a single API server. Behind a proxy the API would also need to trust its forwarded address, or every request would count as the proxy's.
- Signing up again with an email that is still waiting for verification replaces the password, so someone who knows a classmate is signing up can make the classmate's code fail until they sign up once more. It can't be used to take the account over, because verifying needs the password together with the emailed code.
- Response times of the password reset and resend-code endpoints differ by a few milliseconds between existing and unknown emails.
- Messages arrive by asking the server every few seconds while a chat is open, not instantly, and there are no push notifications; emails stand in for them.
- Matching compares spelling, not meaning: "purse" and "wallet" don't count as similar titles, although the category, place and date still bring such items up.
- An item left at the security office that nobody claims stays listed at the desk; there is no step yet to give it back to the finder or dispose of it.

## Author

Malik · Faculty of IT, Applied Science Private University, Amman

## License

[MIT](LICENSE)
