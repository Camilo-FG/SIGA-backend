import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const users = [
  { email: 'demo.director@siga.local', name: 'Demo Director General', role: 'DIRECTOR_GENERAL', password: 'SigaDirector2026!' },
  { email: 'demo.admin@siga.local', name: 'Demo Director Administrativo', role: 'DIRECTOR_ADMINISTRATIVO', password: 'SigaAdmin2026!' },
  { email: 'demo.asistente@siga.local', name: 'Demo Asistente Dirección', role: 'ASISTENTE_DIRECCION', password: 'SigaAsistente2026!' },
  { email: 'demo.coreografo@siga.local', name: 'Demo Coreógrafo', role: 'COREOGRAFO', password: 'SigaCoreografo2026!' },
  { email: 'demo.profesor@siga.local', name: 'Demo Profesor', role: 'PROFESOR', password: 'SigaProfesor2026!' },
];

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required.'); process.exit(1); }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const user of users) {
    const password = await bcrypt.hash(user.password, 12);
    await pool.query('INSERT INTO "users" ("id", "email", "name", "password", "role", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5::"Role", NOW(), NOW()) ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "password" = EXCLUDED."password", "role" = EXCLUDED."role", "updatedAt" = NOW()', [randomUUID(), user.email, user.name, password, user.role]);
    console.log(`${user.role}: ${user.email} / ${user.password}`);
  }
} finally { await pool.end(); }
