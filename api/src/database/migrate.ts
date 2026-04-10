import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER ?? 'diapp',
    password: process.env.DB_PASSWORD ?? 'diapp',
    database: process.env.DB_NAME ?? 'diapp',
    multipleStatements: true,
  });

  console.log('Conectado a MySQL');

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.query(sql);
    console.log(`✓ ${file}`);
  }

  await db.end();
  console.log('Migraciones completadas');
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
