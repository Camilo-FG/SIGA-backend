import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

interface StoredUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

/** Minimal in-memory stand-in for PrismaService so e2e tests need no database. */
function createPrismaMock() {
  const users = new Map<string, StoredUser>();

  return {
    user: {
      findUnique: ({
        where,
      }: {
        where: { id?: string; email?: string };
      }): Promise<StoredUser | null> => {
        if (where.id) {
          return Promise.resolve(users.get(where.id) ?? null);
        }
        const email = where.email;
        const match = [...users.values()].find((user) => user.email === email);
        return Promise.resolve(match ?? null);
      },
      create: ({
        data,
      }: {
        data: { email: string; password: string; name: string };
      }): Promise<StoredUser> => {
        const now = new Date();
        const user: StoredUser = {
          id: randomUUID(),
          role: 'USER',
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        users.set(user.id, user);
        return Promise.resolve(user);
      },
    },
  };
}

interface AuthResponseBody {
  accessToken: string;
  user: {
    email: string;
    name: string;
    role: string;
    password?: string;
  };
}

describe('SIGA API (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'test-secret';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  const credentials = {
    email: 'jane@example.com',
    password: 'supersecret',
    name: 'Jane Doe',
  };

  describe('GET /api/health', () => {
    it('is reachable without a token', async () => {
      const response = await request(server).get('/api/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        service: 'siga-backend',
      });
    });
  });

  describe('POST /api/auth/register', () => {
    it('creates a user and returns an access token', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);

      const body = response.body as AuthResponseBody;
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user).toMatchObject({
        email: credentials.email,
        name: credentials.name,
        role: 'USER',
      });
      expect(body.user).not.toHaveProperty('password');
    });

    it('rejects a duplicate email', async () => {
      await request(server)
        .post('/api/auth/register')
        .send(credentials)
        .expect(409);
    });

    it('rejects an invalid payload', async () => {
      await request(server)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns a token for valid credentials', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({ email: credentials.email, password: credentials.password })
        .expect(200);

      const body = response.body as AuthResponseBody;
      expect(body.accessToken).toEqual(expect.any(String));
    });

    it('rejects a wrong password', async () => {
      await request(server)
        .post('/api/auth/login')
        .send({ email: credentials.email, password: 'wrong-password' })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the authenticated user for a valid token', async () => {
      const login = await request(server)
        .post('/api/auth/login')
        .send({ email: credentials.email, password: credentials.password })
        .expect(200);

      const { accessToken } = login.body as AuthResponseBody;
      const response = await request(server)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ email: credentials.email });
    });

    it('rejects anonymous requests', async () => {
      await request(server).get('/api/auth/me').expect(401);
    });

    it('rejects a malformed token', async () => {
      await request(server)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });
  });
});
