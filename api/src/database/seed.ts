import * as mysql from 'mysql2/promise';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const SA1_EMAIL    = process.env.SUPERADMIN_1_EMAIL    ?? 'alberto@blancoapp.com';
const SA1_PASSWORD = process.env.SUPERADMIN_1_PASSWORD ?? 'Alberto123!';
const SA2_EMAIL    = process.env.SUPERADMIN_2_EMAIL    ?? 'backup@blancoapp.com';
const SA2_PASSWORD = process.env.SUPERADMIN_2_PASSWORD ?? 'Backup2Dev123!';

const usingEnvVars = !!(
  process.env.SUPERADMIN_1_EMAIL ||
  process.env.SUPERADMIN_2_EMAIL
);

async function seed() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER ?? 'diapp',
    password: process.env.DB_PASSWORD ?? 'diapp',
    database: process.env.DB_NAME ?? 'diapp',
    multipleStatements: true,
  });

  console.log('Conectado a MySQL');

  await db.query(`
    INSERT IGNORE INTO roles (name) VALUES
      ('SuperAdmin'), ('Owner'), ('Manager'), ('Employee')
  `);
  console.log('Roles insertados');

  const companyUuid = randomUUID();
  await db.query(
    `INSERT IGNORE INTO companies (uuid, name, nif, address, active) VALUES (?, 'Blanco App', 'B12345678', 'Calle Mayor 1, Madrid, 28001', 1)`,
    [companyUuid],
  );
  const [companies]: any = await db.query(`SELECT id FROM companies WHERE nif = 'B12345678'`);
  const companyId = companies[0].id;

  const workcenterUuid = randomUUID();
  await db.query(
    `INSERT IGNORE INTO workcenters (uuid, name, address, email, company_id, active) VALUES (?, 'Workcenter Blanco 1', 'Calle Mayor 1, Madrid, 28001', 'workcenter1@blancoapp.com', ?, 1)`,
    [workcenterUuid, companyId],
  );
  const [workcenters]: any = await db.query(`SELECT id FROM workcenters WHERE email = 'workcenter1@blancoapp.com'`);
  const workcenterId = workcenters[0].id;

  const [roles]: any = await db.query(`SELECT id, name FROM roles`);
  const roleId = (name: string) => roles.find((r: any) => r.name === name).id;

  // SuperAdmins: máximo 2 en el sistema. Solo se crean aquí, en el seed.
  // No existe ni existirá un endpoint para crearlos — esta es la única vía.
  // Las credenciales se leen de variables de entorno en producción.
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
    await db.query(
      `INSERT IGNORE INTO users (uuid, email, password, role_id, company_id) VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), u.email, u.password, u.roleId, companyId],
    );
    const [rows]: any = await db.query(`SELECT id FROM users WHERE email = ?`, [u.email]);
    const userId = rows[0].id;

    await db.query(
      `INSERT IGNORE INTO profiles (user_id, first_name, last_name, phone, address) VALUES (?, ?, ?, ?, ?)`,
      [userId, u.firstName, u.lastName, u.phone, 'Calle Mayor 1, Madrid, 28001'],
    );

    await db.query(
      `INSERT IGNORE INTO user_workcenters (user_id, workcenter_id) VALUES (?, ?)`,
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

  await db.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
