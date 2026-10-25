import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { Role } from './../src/generated/prisma/client.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

interface StoredUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

/** Minimal in-memory stand-in for PrismaService so e2e tests need no database. */
function createPrismaMock() {
  const users = new Map<string, StoredUser>();
  const now = new Date();
  const password = bcrypt.hashSync('supersecret', 10);
  const seed = (id: string, email: string, name: string, role: Role) => {
    users.set(id, { id, email, password, name, role, createdAt: now, updatedAt: now });
  };
  seed('director-1', 'director@example.com', 'Director', Role.DIRECTOR_GENERAL);
  seed('teacher-1', 'teacher@example.com', 'Teacher', Role.PROFESOR);

  return {
    user: {
      findUnique: ({ where }: { where: { id?: string; email?: string } }): Promise<StoredUser | null> => {
        if (where.id) return Promise.resolve(users.get(where.id) ?? null);
        const match = [...users.values()].find((user) => user.email === where.email);
        return Promise.resolve(match ?? null);
      },
      create: ({ data }: { data: { email: string; password: string; name: string; role?: Role } }): Promise<StoredUser> => {
        const user: StoredUser = {
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          email: data.email,
          password: data.password,
          name: data.name,
          role: data.role ?? Role.PROFESOR,
        };
        users.set(user.id, user);
        return Promise.resolve(user);
      },
    },
  };
}

interface LoginBody {
  accessToken: string;
  user: { email: string; role: string; password?: string };
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  async function tokenFor(email: string) {
    const response = await request(server).post('/api/auth/login').send({ email, password: 'supersecret' }).expect(200);
    return (response.body as LoginBody).accessToken;
  }

  describe('GET /api/health', () => {
    it('is reachable without a token', async () => {
      const response = await request(server).get('/api/health').expect(200);
      expect(response.body).toMatchObject({ status: 'ok', service: 'siga-backend' });
    });
  });

  describe('POST /api/auth/register', () => {
    const account = { email: 'ana@example.com', password: 'supersecret', name: 'Ana', role: Role.ASISTENTE_DIRECCION };

    it('rejects anonymous registration', async () => {
      await request(server).post('/api/auth/register').send(account).expect(401);
    });

    it('rejects a teacher', async () => {
      const token = await tokenFor('teacher@example.com');
      await request(server).post('/api/auth/register').set('Authorization', `Bearer ${token}`).send(account).expect(403);
    });

    it('lets the general director create an account with the requested role', async () => {
      const token = await tokenFor('director@example.com');
      const response = await request(server).post('/api/auth/register').set('Authorization', `Bearer ${token}`).send(account).expect(201);

      expect(response.body).toMatchObject({ email: account.email, name: account.name, role: Role.ASISTENTE_DIRECCION });
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('accessToken');
    });

    it('rejects a duplicate email', async () => {
      const token = await tokenFor('director@example.com');
      await request(server).post('/api/auth/register').set('Authorization', `Bearer ${token}`).send(account).expect(409);
    });

    it('rejects an invalid payload', async () => {
      const token = await tokenFor('director@example.com');
      await request(server).post('/api/auth/register').set('Authorization', `Bearer ${token}`).send({ email: 'not-an-email', password: 'short' }).expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns a token for valid credentials', async () => {
      const response = await request(server).post('/api/auth/login').send({ email: 'director@example.com', password: 'supersecret' }).expect(200);
      const body = response.body as LoginBody;
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user).not.toHaveProperty('password');
    });

    it('rejects a wrong password', async () => {
      await request(server).post('/api/auth/login').send({ email: 'director@example.com', password: 'wrong-password' }).expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the authenticated user for a valid token', async () => {
      const accessToken = await tokenFor('director@example.com');
      const response = await request(server).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(response.body).toMatchObject({ email: 'director@example.com', role: Role.DIRECTOR_GENERAL });
    });

    it('rejects anonymous requests', async () => {
      await request(server).get('/api/auth/me').expect(401);
    });

    it('rejects a malformed token', async () => {
      await request(server).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
    });
  });
});
