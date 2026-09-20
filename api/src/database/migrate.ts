import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  const db = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER ?? 'sgf',
    password: process.env.DB_PASSWORD ?? 'sgf',
    database: process.env.DB_NAME ?? 'sgf',
  });

  await db.connect();
  console.log('Conectado a PostgreSQL');

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
