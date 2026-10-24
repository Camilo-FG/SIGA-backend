# SIGA Backend

REST API for SIGA, built with [NestJS](https://nestjs.com) 12, [Prisma](https://www.prisma.io) 7 and PostgreSQL.
It ships with JWT authentication (Passport + bcrypt), request validation, ESLint/Prettier and Vitest.

## Requirements

- Node.js 22.20+
- PostgreSQL 14+
- npm 10+

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Create your local environment file
cp .env.example .env
# then edit DATABASE_URL and JWT_SECRET

# 3. Generate the Prisma client
npm run prisma:generate

# 4. Apply the migrations
npm run prisma:migrate

# 5. Start the API in watch mode
npm run start:dev
```

The API is served at `http://localhost:3000/api` and the health check is `GET /api/health`.

## Environment variables

| Variable         | Description                                                    |
| ---------------- | -------------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string.                                  |
| `JWT_SECRET`     | Secret used to sign access tokens. Required.                   |
| `JWT_EXPIRES_IN` | Access token lifetime in **seconds** (default `86400`).        |
| `PORT`           | HTTP port (default `3000`).                                    |
| `CORS_ORIGIN`    | Comma-separated list of allowed browser origins.               |

## API

All routes are protected by the JWT guard unless marked public. Send the token as
`Authorization: Bearer <accessToken>`.

| Method | Route              | Public | Description                          |
| ------ | ------------------ | ------ | ------------------------------------ |
| GET    | `/api/health`      | yes    | Liveness probe.                      |
| POST   | `/api/auth/register` | yes  | Create an account, returns a token.  |
| POST   | `/api/auth/login`  | yes    | Exchange credentials for a token.    |
| GET    | `/api/auth/me`     | no     | Current authenticated user.          |

Example:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"supersecret","name":"Jane"}'
```

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "…",
    "email": "jane@example.com",
    "name": "Jane",
    "role": "USER",
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

## Project structure

```
prisma/
  schema.prisma          # Data model (User, Role)
  migrations/            # SQL migrations
src/
  auth/                  # Register/login, JWT strategy and guard, decorators
  prisma/                # PrismaService (driver adapter) and global module
  users/                 # User queries, password hashing, DTOs
  generated/prisma/      # Prisma Client output (git-ignored, run prisma:generate)
  app.module.ts          # Root module
  main.ts                # Bootstrap: CORS, validation pipe, global prefix
test/                    # Vitest e2e tests (need a database)
```

## Scripts

| Script                   | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `npm run start:dev`      | Start in watch mode.                        |
| `npm run build`          | Compile to `dist/`.                         |
| `npm run start:prod`     | Run the compiled build.                     |
| `npm run lint`           | Run ESLint.                                 |
| `npm run lint:fix`       | Run ESLint and apply fixes.                 |
| `npm run format`         | Format with Prettier.                       |
| `npm test`               | Unit tests.                                 |
| `npm run test:e2e`       | E2E tests (requires a running database).    |
| `npm run prisma:generate`| Regenerate Prisma Client.                   |
| `npm run prisma:migrate` | Create/apply migrations in development.     |
| `npm run prisma:deploy`  | Apply pending migrations (production).      |
| `npm run prisma:studio`  | Open Prisma Studio.                         |

## Notes

- The project is ESM (`"type": "module"`), so relative imports use the `.js` extension even in TypeScript.
- Prisma 7 uses the `prisma-client` generator with an explicit output (`src/generated/prisma`) and the
  `@prisma/adapter-pg` driver adapter; run `npm run prisma:generate` after cloning or changing the schema.
- `npm install` may need `--legacy-peer-deps` on npm 10.x with Nest 12; that is a known npm resolution bug.
