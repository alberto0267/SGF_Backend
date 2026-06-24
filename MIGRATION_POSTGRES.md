# Migración MySQL → PostgreSQL + Renombrado a SGF

## Estado actual

| Capa | Archivo | Estado |
|------|---------|--------|
| Infraestructura | `docker-compose.yml` | ✅ Completado |
| Driver / Conexión | `database.service.ts` | ⬜ Pendiente |
| Script migración | `migrate.ts` | ⬜ Pendiente |
| Script seed | `seed.ts` | ✅ Completado |
| Schema SQL | `001_create_tables.sql` | ✅ Completado |
| Repository | `company.repository.ts` | ✅ Completado |
| Repository | `workcenter.repository.ts` | ✅ Completado |
| Repository | `user.repository.ts` (auth) | ✅ Completado |
| Repository | `audit.repository.ts` | ✅ Sin cambios (ya era limpio) |
| Repository | `notification.repository.ts` | ✅ Completado |
| Repository | `overtime.repository.ts` | ✅ Completado |
| Dependencias | `package.json` raíz + `api/package.json` | ✅ Completado |
| Renombrado | `diapp` → `sgf` en todos los archivos | ⬜ Pendiente |

---

## Qué cambia y por qué

### 1. docker-compose.yml
- Imagen `mysql:8.0` → `postgres:16`
- Variables de entorno distintas (`MYSQL_*` → `POSTGRES_*`)
- Puerto `3306` → `5432`

### 2. Driver (database.service.ts)
- Paquete `mysql2` → `pg`
- `mysql2` devuelve `[rows, fields]` — desestructuramos el array
- `pg` devuelve `{ rows, rowCount }` — leemos `.rows`
- Añadimos conversor `?` → `$1, $2...` para no tocar todos los repositories

### 3. Placeholders en queries
- MySQL usa `?` para todos los parámetros
- PostgreSQL usa `$1`, `$2`, `$3`... posicionales
- **Solución:** conversor interno en `DatabaseService` — los repositories no cambian

### 4. Schema SQL (001_create_tables.sql)

| MySQL | PostgreSQL | Por qué |
|-------|-----------|---------|
| `AUTO_INCREMENT` | `SERIAL` | Postgres no tiene AUTO_INCREMENT |
| `TINYINT(1)` | `BOOLEAN` | Postgres tiene tipo booleano nativo |
| `DATETIME` | `TIMESTAMP` | Nombre distinto, mismo concepto |
| `INT COMMENT '...'` | `INT` | Postgres no admite COMMENT inline |
| `ON UPDATE CURRENT_TIMESTAMP` | trigger o eliminado | No existe en Postgres |

### 5. Seed (seed.ts)
| MySQL | PostgreSQL | Por qué |
|-------|-----------|---------|
| `INSERT IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` | MySQL-specific |
| `ON DUPLICATE KEY UPDATE` | `ON CONFLICT (...) DO UPDATE SET` | MySQL-specific |

### 6. Repositories — patrones que cambian

| Patrón MySQL | Patrón PostgreSQL | Archivos afectados |
|---|---|---|
| `result.insertId` | `RETURNING id` + `rows[0].id` | company, workcenter, user, overtime |
| `active = 1` / `active = 0` | `active = true` / `active = false` | company, workcenter, user |
| `UPDATE a JOIN b SET` | `UPDATE a SET ... FROM b WHERE` | company.repository (revokeTokens) |
| `import { RowDataPacket, ResultSetHeader } from 'mysql2'` | eliminar, tipos propios | todos |

---

## Flujo de arranque tras la migración

```bash
docker-compose down -v && docker-compose up -d
pnpm nx db:migrate @org/api
pnpm nx db:seed @org/api
pnpm nx serve @org/api
```

---

## Renombrado diapp → sgf

Archivos con referencias a `diapp`:
- `docker-compose.yml` — container name, credenciales
- `database.service.ts` — credenciales por defecto
- `migrate.ts` — credenciales por defecto
- `seed.ts` — credenciales por defecto
- `ARQUITECTURA.md` — documentación
- `diapp.postman_collection.json` — renombrar archivo

---

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| ⬜ | Pendiente |
| 🔄 | En progreso |
| ✅ | Completado |
