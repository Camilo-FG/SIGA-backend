import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const password = await bcrypt.hash('SigaPrueba2026!', 10);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const firstNames = ['Ana', 'Luis', 'María', 'Diego', 'Sofía', 'Andrés', 'Valeria', 'Gabriel', 'Camila', 'José', 'Lucía', 'Mateo', 'Isabella', 'Daniel', 'Emma', 'Adrián', 'Renata', 'Santiago', 'Paula', 'Nicolás'];
const lastNames = ['Solís', 'Vargas', 'Mora', 'Jiménez', 'Rojas', 'Castro', 'Herrera', 'Navarro', 'Quesada', 'Araya', 'Campos', 'Salazar', 'Porras', 'Espinoza', 'Chaves', 'Fonseca', 'Alfaro', 'Blanco', 'Cordero', 'Vega'];
const catalog = [
  { name: 'Danza latina', day: 1, start: '16:00', end: '17:30' },
  { name: 'Danza urbana', day: 2, start: '16:00', end: '17:30' },
  { name: 'Folclore', day: 3, start: '16:00', end: '17:30' },
  { name: 'Jazz', day: 4, start: '16:00', end: '17:30' },
  { name: 'Contemporánea', day: 5, start: '16:00', end: '17:30' },
  { name: 'Teatro, canto y música', day: 6, start: '09:00', end: '10:30' },
];
const concepts = ['Mensualidad', 'Matrícula', 'Vestuario', 'Taller intensivo', 'Presentación'];
const location = 'Salón ADAGIO, Santa Cruz';
const keptTeachers = ['prueba.docente01@siga.local', 'prueba.docente02@siga.local', 'prueba.docente03@siga.local', 'prueba.docente04@siga.local', 'prueba.docente05@siga.local', 'prueba.docente06@siga.local'];
const statuses = ['PRESENTE', 'PRESENTE', 'TARDIA', 'AUSENTE', 'JUSTIFICADA'];
const methods = ['SINPE', 'TRANSFERENCIA', 'EFECTIVO'];

function pad(n) { return String(n).padStart(2, '0'); }
function money(n) { return (25000 + n * 1500).toFixed(2); }

let db = pool;
async function one(sql, params) {
  const result = await db.query(sql, params);
  return result.rows[0];
}

try {
    const client = await pool.connect();
    db = client;
    try {
      await client.query('BEGIN');
    const director = await one('SELECT id FROM users WHERE email = $1', ['demo.director@siga.local']);
    const admin = await one('SELECT id FROM users WHERE email = $1', ['demo.admin@siga.local']);
    const assistant = await one('SELECT id FROM users WHERE email = $1', ['demo.asistente@siga.local']);
    if (!director || !admin || !assistant) throw new Error('Faltan los usuarios demo. Ejecuta primero la semilla de usuarios.');

    await client.query('DELETE FROM groups');
    await client.query(`DELETE FROM disciplines WHERE name <> ALL($1::text[])`, [catalog.map((item) => item.name)]);
    await client.query(
      `UPDATE users SET active = false, "updatedAt" = NOW() WHERE email LIKE 'prueba.docente%' AND email <> ALL($1::text[])`,
      [keptTeachers],
    );
    await client.query(
      `UPDATE payment_concepts SET active = false, "updatedAt" = NOW() WHERE name <> ALL($1::text[])`,
      [concepts],
    );

    const teachers = [];
    for (let i = 1; i <= catalog.length; i += 1) {
      const email = `prueba.docente${pad(i)}@siga.local`;
      const role = 'COREOGRAFO';
      const row = await one(
        `INSERT INTO users (id, email, name, password, role, active, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::"Role", true, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, active = true, "updatedAt" = NOW()
         RETURNING id`,
        [randomUUID(), email, `${firstNames[i - 1]} ${lastNames[(i + 3) % 20]}`, password, role],
      );
      teachers.push(row.id);
    }

    const disciplineIds = [];
    for (const item of catalog) {
      const row = await one(
        `INSERT INTO disciplines (id, name, active, "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())
         ON CONFLICT (name) DO UPDATE SET active = true, "updatedAt" = NOW()
         RETURNING id`,
        [randomUUID(), item.name],
      );
      disciplineIds.push(row.id);
    }

    const groupIds = [];
    for (let i = 0; i < catalog.length; i += 1) {
      const item = catalog[i];
      const row = await one(
        `INSERT INTO groups (id, name, "disciplineId", "dayOfWeek", "startTime", "endTime", location, active, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
         ON CONFLICT ("disciplineId", name) DO UPDATE SET "dayOfWeek" = EXCLUDED."dayOfWeek", "startTime" = EXCLUDED."startTime", "endTime" = EXCLUDED."endTime", location = EXCLUDED.location, active = true, "updatedAt" = NOW()
         RETURNING id`,
        [randomUUID(), item.name, disciplineIds[i], item.day, item.start, item.end, location],
      );
      groupIds.push(row.id);
      await client.query(
        `INSERT INTO group_teachers ("groupId", "userId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [row.id, teachers[i]],
      );
      await client.query(
        `INSERT INTO group_schedules (id, "groupId", "dayOfWeek", "startTime", "endTime", location)
         SELECT $1, $2, $3, $4, $5, $6
         WHERE NOT EXISTS (SELECT 1 FROM group_schedules WHERE "groupId" = $2 AND "dayOfWeek" = $3 AND "startTime" = $4)`,
        [randomUUID(), row.id, item.day, item.start, item.end, location],
      );
    }

    const studentIds = [];
    for (let i = 1; i <= 20; i += 1) {
      const minor = i <= 10;
      const status = i > 18 ? 'INACTIVE' : i > 16 ? 'PENDING' : 'ACTIVE';
      const row = await one(
        `INSERT INTO students (id, "firstName", "lastName", "birthDate", email, phone, "enrollmentStatus", "emergencyContactName", "emergencyContactPhone", "nationalId", notes, "enrolledAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7::"EnrollmentStatus", $8, $9, $10, $11, '2026-08-01', NOW(), NOW())
         ON CONFLICT ("nationalId") DO UPDATE SET "enrollmentStatus" = EXCLUDED."enrollmentStatus", email = EXCLUDED.email, "updatedAt" = NOW()
         RETURNING id`,
        [
          randomUUID(),
          firstNames[i - 1],
          lastNames[i - 1],
          minor ? `201${i % 4}-0${(i % 9) + 1}-15` : `199${i % 8}-0${(i % 9) + 1}-20`,
          `prueba.estudiante${pad(i)}@siga.local`,
          `8888${pad(i)}${pad(i)}`,
          status,
          `${firstNames[(i + 5) % 20]} ${lastNames[(i + 7) % 20]}`,
          `7777${pad(i)}${pad(i)}`,
          `9${String(i).padStart(8, '0')}`,
          minor ? 'Estudiante de prueba, menor de edad.' : 'Estudiante de prueba.',
        ],
      );
      studentIds.push({ id: row.id, status });
    }

    for (let i = 1; i <= 20; i += 1) {
      const guardian = await one(
        `INSERT INTO guardians (id, "firstName", "lastName", email, phone, "nationalId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT ("nationalId") DO UPDATE SET email = EXCLUDED.email, phone = EXCLUDED.phone, "updatedAt" = NOW()
         RETURNING id`,
        [randomUUID(), firstNames[(i + 4) % 20], lastNames[(i + 9) % 20], `prueba.encargado${pad(i)}@siga.local`, `6666${pad(i)}${pad(i)}`, `8${String(i).padStart(8, '0')}`],
      );
      const student = studentIds[(i - 1) % 20];
      await client.query(
        `INSERT INTO student_guardians ("studentId", "guardianId", relationship, "isPrimary", "isPaymentResponsible")
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [student.id, guardian.id, i % 2 === 0 ? 'Padre' : 'Madre', true, i % 2 === 1],
      );
    }

    for (let i = 0; i < studentIds.length; i += 1) {
      if (studentIds[i].status === 'INACTIVE') continue;
      await client.query(
        `INSERT INTO student_groups ("studentId", "groupId", "startedAt") VALUES ($1, $2, '2026-08-01') ON CONFLICT DO NOTHING`,
        [studentIds[i].id, groupIds[i % groupIds.length]],
      );
    }

    for (let i = 0; i < groupIds.length; i += 1) {
      const date = `2026-11-${pad(2 + i)}`;
      const groupId = groupIds[i];
      const session = await one(
        `INSERT INTO attendance_sessions (id, "groupId", date, "createdById", cancelled, note, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, false, $5, NOW(), NOW())
         ON CONFLICT ("groupId", date) DO UPDATE SET note = EXCLUDED.note, "updatedAt" = NOW()
         RETURNING id`,
        [randomUUID(), groupId, date, teachers[i], catalog[i].name],
      );
      const enrolled = await client.query(
        `SELECT "studentId" FROM student_groups WHERE "groupId" = $1 AND ("endedAt" IS NULL OR "endedAt" > $2)`,
        [groupId, date],
      );
      for (const [index, enrollment] of enrolled.rows.entries()) {
        await client.query(
          `INSERT INTO attendance_records ("sessionId", "studentId", status, observation)
           VALUES ($1, $2, $3::"AttendanceStatus", $4)
           ON CONFLICT ("sessionId", "studentId") DO UPDATE SET status = EXCLUDED.status`,
          [session.id, enrollment.studentId, statuses[(i + index) % statuses.length], 'Registro de prueba'],
        );
      }
    }

    const conceptIds = [];
    for (let i = 0; i < concepts.length; i += 1) {
      const row = await one(
        `INSERT INTO payment_concepts (id, name, amount, periodicity, active, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4::"PaymentPeriodicity", true, NOW(), NOW())
         ON CONFLICT (name) DO UPDATE SET amount = EXCLUDED.amount, active = true, "updatedAt" = NOW()
         RETURNING id, name, amount`,
        [randomUUID(), concepts[i], money(i), concepts[i] === 'Mensualidad' ? 'MENSUAL' : 'UNICO'],
      );
      conceptIds.push(row);
    }

    await client.query(
      `DELETE FROM payments WHERE "chargeId" IN (SELECT id FROM charges WHERE concept <> ALL($1::text[]))`,
      [concepts],
    );
    await client.query(`DELETE FROM charges WHERE concept <> ALL($1::text[])`, [concepts]);

    const activeStudents = studentIds.filter((student) => student.status === 'ACTIVE');
    const mensualidad = conceptIds.find((concept) => concept.name === 'Mensualidad');
    for (let i = 0; i < activeStudents.length; i += 1) {
      const student = activeStudents[i];
      const concept = mensualidad;
      const period = '2026-11';
      const due = '2026-11-30';
      const charge = await one(
        `INSERT INTO charges (id, "studentId", concept, amount, period, "dueDate", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE'::"ChargeStatus", NOW(), NOW())
         ON CONFLICT ("studentId", concept, period) DO UPDATE SET amount = EXCLUDED.amount, "dueDate" = EXCLUDED."dueDate", "updatedAt" = NOW()
         RETURNING id, amount`,
        [randomUUID(), student.id, concept.name, concept.amount, period, due],
      );
      const reference = `PRUEBA-${period}-${i + 1}`;
      if (i < 6) {
        await client.query(
          `INSERT INTO payments (id, "chargeId", amount, "receivedAt", reference, "receiptStatus", method, "registeredById", "validatedById", "validatedAt", "createdAt")
           SELECT $1, $2, $3, NOW(), $4, 'APROBADO'::"ReceiptStatus", $5::"PaymentMethod", $6, $7, NOW(), NOW()
           WHERE NOT EXISTS (SELECT 1 FROM payments WHERE reference = $4)`,
          [randomUUID(), charge.id, charge.amount, reference, methods[i % 3], assistant.id, admin.id],
        );
        await client.query(`UPDATE charges SET status = 'PAGADO'::"ChargeStatus", "updatedAt" = NOW() WHERE id = $1`, [charge.id]);
      } else if (i < 12) {
        await client.query(
          `INSERT INTO payments (id, "chargeId", amount, "receivedAt", reference, "receiptStatus", method, "registeredById", "createdAt")
           SELECT $1, $2, $3, NOW(), $4, 'PENDIENTE'::"ReceiptStatus", $5::"PaymentMethod", $6, NOW()
           WHERE NOT EXISTS (SELECT 1 FROM payments WHERE reference = $4)`,
          [randomUUID(), charge.id, charge.amount, reference, methods[i % 3], assistant.id],
        );
        await client.query(`UPDATE charges SET status = 'PENDIENTE'::"ChargeStatus", "updatedAt" = NOW() WHERE id = $1`, [charge.id]);
      } else if (i < 16) {
        await client.query(
          `INSERT INTO payments (id, "chargeId", amount, "receivedAt", reference, "receiptStatus", method, "rejectionReason", "registeredById", "validatedById", "validatedAt", "createdAt")
           SELECT $1, $2, $3, NOW(), $4, 'RECHAZADO'::"ReceiptStatus", $5::"PaymentMethod", 'Comprobante de prueba ilegible', $6, $7, NOW(), NOW()
           WHERE NOT EXISTS (SELECT 1 FROM payments WHERE reference = $4)`,
          [randomUUID(), charge.id, charge.amount, reference, methods[i % 3], assistant.id, admin.id],
        );
      }
    }

    const seeded = await one(`SELECT COUNT(*)::int AS total FROM audit_logs WHERE action = 'SEMILLA_PRUEBA'`, []);
    if (seeded.total < 20) {
      for (let i = seeded.total; i < 20; i += 1) {
        await client.query(
          `INSERT INTO audit_logs (id, "userId", action, entity, "entityId", detail, "createdAt")
           VALUES ($1, $2, 'SEMILLA_PRUEBA', 'Sistema', $3, $4::jsonb, NOW())`,
          [randomUUID(), director.id, `semilla-${pad(i + 1)}`, JSON.stringify({ orden: i + 1 })],
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    db = pool;
  }

  const counts = await pool.query(`
    SELECT 'usuarios' AS modulo, COUNT(*)::int AS total FROM users
    UNION ALL SELECT 'disciplinas', COUNT(*)::int FROM disciplines
    UNION ALL SELECT 'grupos', COUNT(*)::int FROM groups
    UNION ALL SELECT 'horarios', COUNT(*)::int FROM group_schedules
    UNION ALL SELECT 'estudiantes', COUNT(*)::int FROM students
    UNION ALL SELECT 'encargados', COUNT(*)::int FROM guardians
    UNION ALL SELECT 'vinculos', COUNT(*)::int FROM student_guardians
    UNION ALL SELECT 'sesiones', COUNT(*)::int FROM attendance_sessions
    UNION ALL SELECT 'marcas', COUNT(*)::int FROM attendance_records
    UNION ALL SELECT 'conceptos', COUNT(*)::int FROM payment_concepts
    UNION ALL SELECT 'cargos', COUNT(*)::int FROM charges
    UNION ALL SELECT 'pagos', COUNT(*)::int FROM payments
    ORDER BY modulo
  `);
  for (const row of counts.rows) console.log(`${row.modulo}: ${row.total}`);
  console.log('Docentes activos de prueba: prueba.docente01@siga.local … prueba.docente06@siga.local / SigaPrueba2026!');
} finally {
  await pool.end();
}
