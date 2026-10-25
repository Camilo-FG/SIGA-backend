import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const required = ['DATABASE_URL', 'BOOTSTRAP_ADMIN_EMAIL', 'BOOTSTRAP_ADMIN_PASSWORD', 'BOOTSTRAP_ADMIN_NAME'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const email = process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
const name = process.env.BOOTSTRAP_ADMIN_NAME.trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (password.length < 12) {
  console.error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM "users"');
  const userCount = countResult.rows[0].count;

  if (userCount > 0) {
    console.error('Bootstrap aborted: the database already contains users.');
    console.error('Create additional users through the protected admin endpoint.');
    process.exitCode = 1;
  } else {
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO "users" ("id", "email", "name", "password", "role", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, \'DIRECTOR_GENERAL\', NOW(), NOW()) RETURNING "email", "name", "role"',
      [randomUUID(), email, name, hashedPassword],
    );
    const user = result.rows[0];

    console.log(`Initial administrator created: ${user.email} (${user.role})`);
  }
} finally {
  await pool.end();
}
