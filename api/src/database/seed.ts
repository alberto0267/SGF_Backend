import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const SA1_EMAIL    = process.env.SUPERADMIN_1_EMAIL    ?? 'alberto@sgf.com';
const SA1_PASSWORD = process.env.SUPERADMIN_1_PASSWORD ?? 'Alberto123!';
const SA2_EMAIL    = process.env.SUPERADMIN_2_EMAIL    ?? 'backup@sgf.com';
const SA2_PASSWORD = process.env.SUPERADMIN_2_PASSWORD ?? 'Backup2Dev123!';

const usingEnvVars = !!(
  process.env.SUPERADMIN_1_EMAIL ||
  process.env.SUPERADMIN_2_EMAIL
);

async function run(db: Client, sql: string, params?: any[]) {
  let i = 0;
  return db.query(sql.replace(/\?/g, () => `$${++i}`), params);
}

async function seed() {
  const db = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER ?? 'sgf',
    password: process.env.DB_PASSWORD ?? 'sgf',
    database: process.env.DB_NAME ?? 'sgf',
  });

  await db.connect();
  console.log('Conectado a PostgreSQL');

  await run(db, `
    INSERT INTO roles (name) VALUES
      ('SuperAdmin'), ('Owner'), ('Manager'), ('Employee')
    ON CONFLICT DO NOTHING
  `);
  console.log('Roles insertados');

  const companyUuid = randomUUID();
  await run(db,
    `INSERT INTO companies (uuid, name, nif, address, active) VALUES (?, 'Blanco App', 'B12345678', 'Calle Mayor 1, Madrid, 28001', true) ON CONFLICT DO NOTHING`,
    [companyUuid],
  );
  const companyRes = await run(db, `SELECT id FROM companies WHERE nif = 'B12345678'`);
  const companyId = companyRes.rows[0].id;

  const workcenterUuid = randomUUID();
  await run(db,
    `INSERT INTO workcenters (uuid, name, address, email, company_id, active) VALUES (?, 'Workcenter Blanco 1', 'Calle Mayor 1, Madrid, 28001', 'workcenter1@blancoapp.com', ?, true) ON CONFLICT DO NOTHING`,
    [workcenterUuid, companyId],
  );
  const workcenterRes = await run(db, `SELECT id FROM workcenters WHERE email = 'workcenter1@blancoapp.com'`);
  const workcenterId = workcenterRes.rows[0].id;

  const rolesRes = await run(db, `SELECT id, name FROM roles`);
  const roles = rolesRes.rows;
  const roleId = (name: string) => roles.find((r: any) => r.name === name).id;

  const users = [
    {
      email: SA1_EMAIL,
      password: await bcrypt.hash(SA1_PASSWORD, 10),
      roleId: roleId('SuperAdmin'),
      firstName: 'Admin',
      lastName: 'Principal',
      phone: '600000001',
    },
    {
      email: SA2_EMAIL,
      password: await bcrypt.hash(SA2_PASSWORD, 10),
      roleId: roleId('SuperAdmin'),
      firstName: 'Admin',
      lastName: 'Backup',
      phone: '600000002',
    },
    {
      email: 'manager@blancoapp.com',
      password: await bcrypt.hash('Manager123!', 10),
      roleId: roleId('Manager'),
      firstName: 'Manager',
      lastName: 'Blanco',
      phone: '600000003',
    },
    {
      email: 'empleado@blancoapp.com',
      password: await bcrypt.hash('Empleado123!', 10),
      roleId: roleId('Employee'),
      firstName: 'Empleado',
      lastName: 'Blanco',
      phone: '600000004',
    },
  ];

  for (const u of users) {
    await run(db,
      `INSERT INTO users (uuid, email, password, role_id, company_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      [randomUUID(), u.email, u.password, u.roleId, companyId],
    );
    const userRes = await run(db, `SELECT id FROM users WHERE email = ?`, [u.email]);
    const userId = userRes.rows[0].id;

    await run(db,
      `INSERT INTO profiles (user_id, first_name, last_name, phone, address) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      [userId, u.firstName, u.lastName, u.phone, 'Calle Mayor 1, Madrid, 28001'],
    );
    await run(db,
      `INSERT INTO user_workcenters (user_id, workcenter_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
      [userId, workcenterId],
    );
  }

  console.log('Usuarios, perfiles y workcenters insertados');
  console.log('');

  if (usingEnvVars) {
    console.log('Credenciales SuperAdmin cargadas desde variables de entorno.');
  } else {
    console.log('Credenciales de prueba (dev):');
    console.log(`  ${SA1_EMAIL}  /  ${SA1_PASSWORD}  (SuperAdmin principal)`);
    console.log(`  ${SA2_EMAIL}  /  ${SA2_PASSWORD}  (SuperAdmin backup)`);
  }

  console.log('  manager@blancoapp.com   / Manager123!   (Manager)');
  console.log('  empleado@blancoapp.com  / Empleado123!  (Employee)');

  // ── Empresa Los Mosquitos ──────────────────────────────────────────────────
  const mosqUuid = randomUUID();
  await run(db,
    `INSERT INTO companies (uuid, name, nif, address, phone, active) VALUES (?, 'Los Mosquitos S.L.', 'B98765432', 'Avenida del Sol 45, Sevilla, 41001', '954000000', true) ON CONFLICT DO NOTHING`,
    [mosqUuid],
  );
  const mosqCompanyRes = await run(db, `SELECT id FROM companies WHERE nif = 'B98765432'`);
  const mosqCompanyId = mosqCompanyRes.rows[0].id;

  const ownerHash = await bcrypt.hash('Owner123!', 10);
  await run(db,
    `INSERT INTO users (uuid, email, password, role_id, company_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    [randomUUID(), 'owner@losmosquitos.com', ownerHash, roleId('Owner'), mosqCompanyId],
  );
  const ownerRes = await run(db, `SELECT id FROM users WHERE email = 'owner@losmosquitos.com'`);
  const ownerId = ownerRes.rows[0].id;
  await run(db,
    `INSERT INTO profiles (user_id, first_name, last_name, phone, address) VALUES (?, 'Carlos', 'Mosquera', '622000000', 'Avenida del Sol 45, Sevilla, 41001') ON CONFLICT DO NOTHING`,
    [ownerId],
  );

  const mosqWorkcenters = [
    { name: 'Franquicia 1', address: 'Calle Betis 10, Sevilla, 41010',   email: 'franquicia1@losmosquitos.com' },
    { name: 'Franquicia 2', address: 'Calle Sierpes 22, Sevilla, 41004', email: 'franquicia2@losmosquitos.com' },
    { name: 'Franquicia 3', address: 'Calle Feria 55, Sevilla, 41003',   email: 'franquicia3@losmosquitos.com' },
  ];

  const mosqWcIds: number[] = [];
  for (const wc of mosqWorkcenters) {
    const wcUuid = randomUUID();
    await run(db,
      `INSERT INTO workcenters (uuid, name, address, email, company_id, active) VALUES (?, ?, ?, ?, ?, true) ON CONFLICT DO NOTHING`,
      [wcUuid, wc.name, wc.address, wc.email, mosqCompanyId],
    );
    const wcRes = await run(db, `SELECT id FROM workcenters WHERE email = ?`, [wc.email]);
    mosqWcIds.push(wcRes.rows[0].id);
  }

  const managerPassHash  = await bcrypt.hash('Manager123!', 10);
  const employeePassHash = await bcrypt.hash('Empleado123!', 10);

  const franchises = [
    {
      wcIdx: 0,
      manager: { email: 'manager1@losmosquitos.com', firstName: 'Sofía',   lastName: 'Ruiz',    phone: '633100001' },
      employees: [
        { email: 'emp1.1@losmosquitos.com', firstName: 'Lucía',   lastName: 'Gómez',   phone: '644100001' },
        { email: 'emp1.2@losmosquitos.com', firstName: 'Pablo',   lastName: 'Martín',  phone: '644100002' },
        { email: 'emp1.3@losmosquitos.com', firstName: 'Elena',   lastName: 'Sánchez', phone: '644100003' },
        { email: 'emp1.4@losmosquitos.com', firstName: 'Marcos',  lastName: 'López',   phone: '644100004' },
        { email: 'emp1.5@losmosquitos.com', firstName: 'Carmen',  lastName: 'Pérez',   phone: '644100005' },
      ],
    },
    {
      wcIdx: 1,
      manager: { email: 'manager2@losmosquitos.com', firstName: 'Andrés',  lastName: 'Torres',  phone: '633200001' },
      employees: [
        { email: 'emp2.1@losmosquitos.com', firstName: 'Irene',   lastName: 'Flores',  phone: '644200001' },
        { email: 'emp2.2@losmosquitos.com', firstName: 'Javier',  lastName: 'Castro',  phone: '644200002' },
        { email: 'emp2.3@losmosquitos.com', firstName: 'Raquel',  lastName: 'Moreno',  phone: '644200003' },
        { email: 'emp2.4@losmosquitos.com', firstName: 'Diego',   lastName: 'Herrera', phone: '644200004' },
        { email: 'emp2.5@losmosquitos.com', firstName: 'Natalia', lastName: 'Jiménez', phone: '644200005' },
      ],
    },
    {
      wcIdx: 2,
      manager: { email: 'manager3@losmosquitos.com', firstName: 'Beatriz', lastName: 'Vega',    phone: '633300001' },
      employees: [
        { email: 'emp3.1@losmosquitos.com', firstName: 'Hugo',    lastName: 'Romero',  phone: '644300001' },
        { email: 'emp3.2@losmosquitos.com', firstName: 'Marta',   lastName: 'Alonso',  phone: '644300002' },
        { email: 'emp3.3@losmosquitos.com', firstName: 'Sergio',  lastName: 'Navarro', phone: '644300003' },
        { email: 'emp3.4@losmosquitos.com', firstName: 'Alba',    lastName: 'Ramos',   phone: '644300004' },
        { email: 'emp3.5@losmosquitos.com', firstName: 'Iván',    lastName: 'Molina',  phone: '644300005' },
      ],
    },
  ];

  for (const f of franchises) {
    const wcId = mosqWcIds[f.wcIdx];

    await run(db,
      `INSERT INTO users (uuid, email, password, role_id, company_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      [randomUUID(), f.manager.email, managerPassHash, roleId('Manager'), mosqCompanyId],
    );
    const mgRes = await run(db, `SELECT id FROM users WHERE email = ?`, [f.manager.email]);
    const mgId = mgRes.rows[0].id;
    await run(db,
      `INSERT INTO profiles (user_id, first_name, last_name, phone) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      [mgId, f.manager.firstName, f.manager.lastName, f.manager.phone],
    );
    await run(db, `INSERT INTO user_workcenters (user_id, workcenter_id) VALUES (?, ?) ON CONFLICT DO NOTHING`, [mgId, wcId]);

    for (const emp of f.employees) {
      await run(db,
        `INSERT INTO users (uuid, email, password, role_id, company_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
        [randomUUID(), emp.email, employeePassHash, roleId('Employee'), mosqCompanyId],
      );
      const empRes = await run(db, `SELECT id FROM users WHERE email = ?`, [emp.email]);
      const empId = empRes.rows[0].id;
      await run(db,
        `INSERT INTO profiles (user_id, first_name, last_name, phone) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
        [empId, emp.firstName, emp.lastName, emp.phone],
      );
      await run(db, `INSERT INTO user_workcenters (user_id, workcenter_id) VALUES (?, ?) ON CONFLICT DO NOTHING`, [empId, wcId]);
    }
  }

  console.log('');
  console.log('  — Los Mosquitos S.L. —');
  console.log('  owner@losmosquitos.com    / Owner123!    (Owner)');
  console.log('  manager1@losmosquitos.com / Manager123!  (Manager - Franquicia 1)');
  console.log('  manager2@losmosquitos.com / Manager123!  (Manager - Franquicia 2)');
  console.log('  manager3@losmosquitos.com / Manager123!  (Manager - Franquicia 3)');
  console.log('  emp1.1 … emp3.5 @losmosquitos.com / Empleado123! (15 empleados)');

  // ── Horas extras (Los Mosquitos S.L.) ────────────────────────────────────
  const mg1Res = await run(db, `SELECT id FROM users WHERE email = 'manager1@losmosquitos.com'`);
  const mg2Res = await run(db, `SELECT id FROM users WHERE email = 'manager2@losmosquitos.com'`);
  const mg3Res = await run(db, `SELECT id FROM users WHERE email = 'manager3@losmosquitos.com'`);
  const mgId1 = mg1Res.rows[0].id;
  const mgId2 = mg2Res.rows[0].id;
  const mgId3 = mg3Res.rows[0].id;

  const getEmpId = async (email: string): Promise<number> => {
    const result = await run(db, `SELECT id FROM users WHERE email = ?`, [email]);
    return result.rows[0].id;
  };

  const emp1Ids = await Promise.all(
    ['emp1.1', 'emp1.2', 'emp1.3', 'emp1.4', 'emp1.5'].map((p) => getEmpId(`${p}@losmosquitos.com`)),
  );
  const emp2Ids = await Promise.all(
    ['emp2.1', 'emp2.2', 'emp2.3', 'emp2.4', 'emp2.5'].map((p) => getEmpId(`${p}@losmosquitos.com`)),
  );
  const emp3Ids = await Promise.all(
    ['emp3.1', 'emp3.2', 'emp3.3', 'emp3.4', 'emp3.5'].map((p) => getEmpId(`${p}@losmosquitos.com`)),
  );

  const insertOtRequest = async (
    workcenterId: number,
    managerId: number,
    date: string,
    reason: string,
    items: { employeeId: number; hours: number }[],
    status: 'pending' | 'approved' | 'rejected',
    approvedById?: number,
  ): Promise<void> => {
    const uuid = randomUUID();
    const res = await run(db,
      `INSERT INTO overtime_requests (uuid, workcenter_id, requested_by, date, reason) VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [uuid, workcenterId, managerId, date, reason],
    );
    const reqId: number = res.rows[0].id;

    for (const item of items) {
      await run(db,
        `INSERT INTO overtime_request_items (request_id, employee_id, hours) VALUES (?, ?, ?)`,
        [reqId, item.employeeId, item.hours],
      );
    }

    if (status !== 'pending') {
      await run(db,
        `UPDATE overtime_requests SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?`,
        [status, approvedById ?? null, `${date} 16:00:00`, reqId],
      );
    }

    if (status === 'approved') {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      for (const item of items) {
        await run(db,
          `INSERT INTO overtime_accumulation (employee_id, year, month, total_hours)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (employee_id, year, month) DO UPDATE SET total_hours = overtime_accumulation.total_hours + EXCLUDED.total_hours`,
          [item.employeeId, year, month, item.hours],
        );
      }
    }
  };

  // Franquicia 1 — Sofía Ruiz
  await insertOtRequest(mosqWcIds[0], mgId1, '2026-03-15', 'Inventario de cierre trimestral',
    emp1Ids.map((id) => ({ employeeId: id, hours: 2 })), 'approved', ownerId);

  await insertOtRequest(mosqWcIds[0], mgId1, '2026-04-10', 'Campaña de primavera',
    [emp1Ids[0], emp1Ids[1], emp1Ids[2]].map((id) => ({ employeeId: id, hours: 3 })), 'approved', ownerId);

  await insertOtRequest(mosqWcIds[0], mgId1, '2026-04-25', 'Visita de auditoría interna',
    [emp1Ids[3], emp1Ids[4]].map((id) => ({ employeeId: id, hours: 1.5 })), 'rejected', ownerId);

  await insertOtRequest(mosqWcIds[0], mgId1, '2026-05-05', 'Jornada de puertas abiertas',
    [emp1Ids[0], emp1Ids[1], emp1Ids[2], emp1Ids[3]].map((id) => ({ employeeId: id, hours: 2.5 })), 'approved', ownerId);

  await insertOtRequest(mosqWcIds[0], mgId1, '2026-05-20', 'Recepción de mercancía extra',
    [emp1Ids[0], emp1Ids[2], emp1Ids[4]].map((id) => ({ employeeId: id, hours: 2 })), 'pending');

  // Franquicia 2 — Andrés Torres
  await insertOtRequest(mosqWcIds[1], mgId2, '2026-03-20', 'Cierre de mes y cuadre de caja',
    [emp2Ids[0], emp2Ids[1], emp2Ids[2]].map((id) => ({ employeeId: id, hours: 4 })), 'approved', ownerId);

  await insertOtRequest(mosqWcIds[1], mgId2, '2026-04-15', 'Formación interna fuera de horario',
    [emp2Ids[0], emp2Ids[1], emp2Ids[2], emp2Ids[3]].map((id) => ({ employeeId: id, hours: 2 })), 'approved', ownerId);

  await insertOtRequest(mosqWcIds[1], mgId2, '2026-05-10', 'Campaña de mayo',
    [emp2Ids[3], emp2Ids[4]].map((id) => ({ employeeId: id, hours: 3 })), 'pending');

  // Franquicia 3 — Beatriz Vega
  await insertOtRequest(mosqWcIds[2], mgId3, '2026-04-05', 'Evento especial franquicia',
    [emp3Ids[0], emp3Ids[1]].map((id) => ({ employeeId: id, hours: 5 })), 'approved', ownerId);

  await insertOtRequest(mosqWcIds[2], mgId3, '2026-05-15', 'Preparación nueva temporada',
    [emp3Ids[2], emp3Ids[3], emp3Ids[4]].map((id) => ({ employeeId: id, hours: 2 })), 'pending');

  console.log('');
  console.log('Horas extras seed (Los Mosquitos):');
  console.log('  Franquicia 1: 5 solicitudes — 3 aprobadas, 1 rechazada, 1 pendiente');
  console.log('  Franquicia 2: 3 solicitudes — 2 aprobadas, 1 pendiente');
  console.log('  Franquicia 3: 2 solicitudes — 1 aprobada, 1 pendiente');

  await db.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
