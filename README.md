# ASU Lost & Found

A mobile app that helps students at Applied Science Private University get lost items back. Students post what they lost or found on campus, the app suggests matches between the two, and the real owner proves an item is theirs before it is handed over.

> Work in progress. The project setup is done; the features below are being built in stages.

## How it works

1. A student finds a black wallet near the library and posts it with a blurred photo and the place on campus.
2. The finder adds private details only the owner would know, such as what is inside or a sticker on it. These are never shown publicly.
3. The owner sees the post (or gets it suggested after posting their own "Lost" post) and answers the finder's questions.
4. The finder accepts or rejects the claim. Valuable items go to the university security office, and the owner picks them up there with their student ID.

## Planned features

- [x] Project setup: API, database, mobile app, Docker, CI
- [ ] Accounts with university email only, email verification, roles (student, security office, admin)
- [ ] Lost and found posts with photos (blurred publicly, EXIF removed) and campus locations
- [ ] Ownership claims with private questions, limited attempts and claim history
- [ ] Handover: in-app messages, pickup code, security office desk
- [ ] Match suggestions between lost and found posts
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
│   │   ├── config/          environment validation
│   │   ├── health/          GET /api/health
│   │   └── prisma/          database client
│   └── test/                integration tests on a real PostgreSQL
├── mobile/                  Expo app
│   └── src/
│       ├── api/             API client and queries
│       ├── app/             screens (Expo Router)
│       ├── components/
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

Set `DB_ADMIN_PASSWORD`, `DB_PASSWORD` and `DB_APP_PASSWORD` in `.env`, each to a different output of `openssl rand -hex 24`. Then:

```bash
docker compose up -d --build
```

The API answers at http://localhost:4000/api/health with `{"status":"ok","database":"up"}`.

### 2. Mobile app

```bash
cd mobile
cp .env.example .env
npm install
npm run android
```

The home screen shows **Server online** when the app reaches the API. The Android emulator reaches your computer at `10.0.2.2`; for a real phone, put your computer's network address in `mobile/.env` and set `APP_BIND=0.0.0.0` in the root `.env`.

### Running the API outside Docker

With only the database running (`docker compose up -d db`), copy `backend/.env.example` to `backend/.env`, fill in the two passwords, and run:

```bash
cd backend
npm install
npm run db:migrate
npm run start:dev
```

## Tests

| Command | Folder | What it runs |
| --- | --- | --- |
| `npm test` | `backend/` | Unit tests |
| `npm run test:e2e` | `backend/` | API tests against PostgreSQL 17 in Docker (Testcontainers) |
| `npm run lint` / `npm run typecheck` | `backend/`, `mobile/` | oxlint or ESLint, TypeScript |
| `npm test` | `mobile/` | Component and API client tests |

GitHub Actions runs all of them on every pull request, plus a gitleaks secret scan and a Docker build that starts the whole stack and calls the health endpoint.

## Security

- Three database logins: the `postgres` superuser only creates the database, `lostfound` owns it and runs the migrations, and the API connects as `lostfound_app`, which can read and write rows but cannot create, change or drop tables. Neither of the last two is a superuser; integration tests check all of this.
- Configuration comes from environment variables and is validated at startup. Secrets live only in git-ignored `.env` files; the repository has `.env.example` copies.
- Security headers through Helmet, request bodies validated and stripped of unknown fields.
- The database and API ports listen on this machine only unless `APP_BIND` says otherwise.
- The Docker images run as a non-root user, and the API image holds only production packages (no Prisma CLI or TypeScript).

## Author

Malik · Faculty of IT, Applied Science Private University, Amman

## License

[MIT](LICENSE)
