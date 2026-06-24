# Chuleta de Arquitectura — AppDiaIa Backend

> Stack: NestJS 11 · TypeScript · MySQL 2 · Nx Monorepo · JWT Auth

---

## 1. Estructura del proyecto

```
backend/
├── api/                        ← Aplicación NestJS principal
│   └── src/
│       ├── main.ts             ← Bootstrap (helmet, CORS, ValidationPipe, prefix /api)
│       ├── app/
│       │   ├── app.module.ts   ← Módulo raíz — importa todos los módulos
│       │   ├── app.controller.ts
│       │   └── app.service.ts
│       ├── database/
│       │   ├── database.module.ts   ← Módulo global (no hace falta importarlo)
│       │   ├── database.service.ts  ← Pool MySQL + query() + transaction()
│       │   ├── seed.ts              ← Datos de prueba (roles, company, usuarios)
│       │   └── migrations/
│       │       ├── 001_create_tables.sql  ← Schema principal
│       │       └── 002_auth_fields.sql    ← uuid, failed attempts, refresh_tokens
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── guards/
│       │   │   ├── jwt-auth.guard.ts       ← Puerta 1: ¿tiene JWT válido?
│       │   │   ├── roles.guard.ts          ← Puerta 2: ¿tiene el rol correcto?
│       │   │   └── throttle-login.guard.ts ← Rate limiting del login
│       │   ├── decorators/
│       │   │   ├── current-user.decorator.ts  ← @CurrentUser()
│       │   │   └── roles.decorator.ts          ← @Roles('SuperAdmin')
│       │   ├── strategies/
│       │   │   └── jwt.strategy.ts   ← Passport: extrae y valida el JWT
│       │   ├── interfaces/
│       │   │   ├── jwt-payload.interface.ts   ← { sub, email, role }
│       │   │   └── auth-response.interface.ts ← AuthResponse, MeResponse
│       │   └── dto/
│       │       └── login.dto.ts
│       └── companies/
│           ├── companies.module.ts
│           ├── companies.controller.ts
│           ├── companies.service.ts
│           └── dto/
│               └── create-company.dto.ts
├── worker/                     ← App worker (independiente, aún sin lógica)
├── shared/                     ← Librería compartida entre apps
├── api-e2e/ worker-e2e/        ← Tests end-to-end
├── package.json                ← Dependencias del monorepo
└── nx.json                     ← Configuración Nx
```

---

## 2. Base de datos — Schema completo

### Tablas y columnas

```sql
roles
  id   INT PK AUTO_INCREMENT
  name VARCHAR(50) UNIQUE          ← 'SuperAdmin' | 'Owner' | 'Manager' | 'Employee'

companies
  id         INT PK AUTO_INCREMENT
  name       VARCHAR(100) NOT NULL
  nif        VARCHAR(20)  NOT NULL UNIQUE
  address    VARCHAR(255) NOT NULL
  phone      VARCHAR(20)           ← opcional
  active     TINYINT(1)   DEFAULT 1
  created_at DATETIME

users
  id                    INT PK AUTO_INCREMENT
  uuid                  CHAR(36) UNIQUE           ← ID público (nunca exponer id numérico)
  email                 VARCHAR(100) UNIQUE NOT NULL
  password              VARCHAR(255) NOT NULL      ← hash bcrypt (10 rounds)
  active                TINYINT(1) DEFAULT 1
  role_id               INT FK → roles.id
  company_id            INT FK → companies.id
  failed_login_attempts TINYINT DEFAULT 0
  locked_until          DATETIME                  ← NULL = no bloqueado
  last_login_at         DATETIME
  created_at            DATETIME
  updated_at            DATETIME ON UPDATE

profiles
  id         INT PK AUTO_INCREMENT
  user_id    INT UNIQUE FK → users.id
  first_name VARCHAR(100) NOT NULL
  last_name  VARCHAR(100) NOT NULL
  dni        VARCHAR(20) UNIQUE                   ← opcional en BD, obligatorio en DTO del owner
  phone      VARCHAR(20)
  address    VARCHAR(255)
  avatar     VARCHAR(255)

workcenters
  id         INT PK AUTO_INCREMENT
  name       VARCHAR(100) NOT NULL
  address    VARCHAR(255)
  email      VARCHAR(100)
  company_id INT FK → companies.id
  active     TINYINT(1) DEFAULT 1

user_workcenters                                  ← muchos a muchos
  user_id       INT FK → users.id   ]
  workcenter_id INT FK → workcenters.id ]  PK compuesta

refresh_tokens
  id         INT PK AUTO_INCREMENT
  user_id    INT FK → users.id (ON DELETE CASCADE)
  token_hash VARCHAR(255) UNIQUE    ← SHA-256 del token original, nunca el token en claro
  expires_at DATETIME
  revoked    TINYINT(1) DEFAULT 0
  created_at DATETIME
```

### Relaciones clave

```
companies  1 ─── N  users
companies  1 ─── N  workcenters
users      1 ─── 1  profiles
users      N ─── N  workcenters  (via user_workcenters)
users      1 ─── N  refresh_tokens
roles      1 ─── N  users
```

### Datos de seed (desarrollo)

| Email | Password | Rol |
|---|---|---|
| alberto@blancoapp.com | Alberto123! | SuperAdmin |
| manager@blancoapp.com | Manager123! | Manager |
| empleado@blancoapp.com | Empleado123! | Employee |

Company: **Blanco App** · NIF: B12345678

---

## 3. DatabaseService — Cómo hablar con la BD

```typescript
// Inyección en cualquier service (DatabaseModule es @Global())
constructor(private readonly db: DatabaseService) {}

// Query simple — SELECT
const rows = await this.db.query<RowDataPacket[]>(
  'SELECT * FROM users WHERE uuid = ?',
  [uuid]
);

// Query simple — INSERT
const result = await this.db.query<ResultSetHeader>(
  'INSERT INTO users (email, password) VALUES (?, ?)',
  [email, hash]
);
const newId = result.insertId;

// Transacción — todo o nada
const data = await this.db.transaction(async (query) => {
  // 'query' es la misma firma que db.query pero dentro de la transacción
  const rows = await query<RowDataPacket[]>('SELECT ...', [...]);
  const result = await query<ResultSetHeader>('INSERT ...', [...]);
  return { ... };
  // Si lanzas una excepción aquí → ROLLBACK automático
  // Si todo va bien → COMMIT automático
});
```

**Tipos de mysql2 a importar:**
```typescript
import { ResultSetHeader, RowDataPacket } from 'mysql2';
```

---

## 4. Sistema de autenticación

### Flujo completo del login

```
Cliente
  │
  ▼
POST /api/auth/login  { email, password }
  │
  ├── ThrottleLoginGuard  ← ¿demasiados intentos? → 429
  │
  ├── ValidationPipe      ← ¿body válido? → 400
  │
  ├── AuthService.login()
  │     ├── findUserByEmail()
  │     ├── Si no existe → bcrypt.compare(dummy) → 401  (timing attack prevention)
  │     ├── Si cuenta bloqueada → 401
  │     ├── bcrypt.compare(password, hash)
  │     ├── Si falla → handleFailedAttempt() → 401
  │     │     └── Si ≥ 5 fallos → locked_until = ahora + 30 min
  │     └── Si OK:
  │           ├── reset failed_login_attempts = 0
  │           ├── jwt.sign({ sub: uuid, email, role }) → accessToken (15 min)
  │           ├── crypto.randomBytes(32) → refreshToken (7 días)
  │           └── SHA-256(refreshToken) → guardar en refresh_tokens
  │
  ▼
{ accessToken, refreshToken, expiresIn: 900 }
```

### Flujo de una petición autenticada

```
Cliente
  │
  ▼
GET /api/auth/me
  Authorization: Bearer <accessToken>
  │
  ├── JwtAuthGuard (AuthGuard('jwt'))
  │     └── JwtStrategy.validate()
  │           ├── Extrae token del header Bearer
  │           ├── Verifica firma con JWT_SECRET
  │           ├── Verifica no expirado
  │           └── Pone { sub, email, role } en req.user
  │
  ├── [Si hay @Roles()] RolesGuard
  │     ├── Lee @Roles('SuperAdmin') del decorator
  │     ├── Compara con req.user.role
  │     └── Si no coincide → ForbiddenException 403
  │
  └── Controller recibe req.user via @CurrentUser()
```

### Refresh token rotation

```
POST /api/auth/refresh  { refreshToken: "abc123..." }
  │
  ├── SHA-256("abc123...") → buscar en refresh_tokens
  ├── Verificar: revoked = 0 AND expires_at > NOW()
  ├── Revocar token antiguo (revoked = 1)
  ├── Emitir nuevo accessToken
  └── Guardar nuevo refreshToken (el mismo token recibido se reutiliza como nuevo)
```

---

## 5. Guards — Las puertas de acceso

### JwtAuthGuard
```typescript
// Uso:
@UseGuards(JwtAuthGuard)

// Qué hace: valida que el header Authorization: Bearer <token> sea correcto
// Si falla: 401 Unauthorized automático (lo maneja Passport)
// Fuente: extiende AuthGuard('jwt') de passport-jwt
```

### RolesGuard
```typescript
// Uso: SIEMPRE después de JwtAuthGuard (necesita req.user)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')           // ← define quién entra

// Qué hace: lee el decorator @Roles(), compara con req.user.role
// Si falla: 403 ForbiddenException
// Si no hay @Roles() en la ruta → deja pasar a cualquier autenticado
```

### ThrottleLoginGuard
```typescript
// Uso: solo en POST /auth/login
@UseGuards(ThrottleLoginGuard)

// Capa 1: por IP → máx 10 intentos / 15 min → 429 + { captchaRequired: true }
// Capa 2: por IP+email → máx 5 intentos / 15 min → 429
// Almacenamiento: Map en memoria (reinicia con el proceso)
// Nota: para múltiples instancias → migrar Maps a Redis
```

### Orden de guards siempre importa
```typescript
// ✅ Correcto
@UseGuards(JwtAuthGuard, RolesGuard)

// ❌ Incorrecto — RolesGuard necesita req.user que pone JwtAuthGuard
@UseGuards(RolesGuard, JwtAuthGuard)
```

---

## 6. Decoradores

### @CurrentUser()
```typescript
// Extrae req.user (puesto por JwtStrategy) como parámetro del método
@Get('me')
@UseGuards(JwtAuthGuard)
getMe(@CurrentUser() user: JwtPayload) {
  console.log(user.sub);    // UUID del usuario
  console.log(user.email);
  console.log(user.role);   // 'SuperAdmin' | 'Owner' | 'Manager' | 'Employee'
}
```

### @Roles()
```typescript
// Pega una etiqueta en la ruta que el RolesGuard lee
@Roles('SuperAdmin')          // solo superadmin
@Roles('Manager', 'Owner')    // manager O owner (OR, no AND)
```

---

## 7. JwtPayload — Lo que viaja en el token

```typescript
interface JwtPayload {
  sub: string;   // UUID del usuario — identificador público
  email: string;
  role: string;  // Nombre del rol en texto
  iat?: number;  // issued at (lo pone jwt automáticamente)
  exp?: number;  // expiration (lo pone jwt automáticamente)
}
```

> **Regla importante:** el `sub` es el UUID, nunca el `id` numérico de la BD. El `id` numérico es privado, solo para JOINs internos.

---

## 8. Endpoints disponibles

### Auth — `/api/auth`

| Método | Ruta | Guard | Body | Respuesta |
|---|---|---|---|---|
| POST | `/login` | ThrottleLoginGuard | `{ email, password }` | `{ accessToken, refreshToken, expiresIn }` |
| POST | `/refresh` | — | `{ refreshToken }` | `{ accessToken, expiresIn }` |
| POST | `/logout` | JwtAuthGuard | — | 204 No Content |
| GET | `/me` | JwtAuthGuard | — | `{ uuid, email, role, name, companyName }` |

### Companies — `/api/companies`

| Método | Ruta | Guard | Body | Respuesta |
|---|---|---|---|---|
| POST | `/` | JwtAuthGuard + RolesGuard | `CreateCompanyDto` | 201 + company + owner + workCenters |

**Body de POST /api/companies:**
```json
{
  "name": "Empresa S.L.",
  "nif": "B12345678",
  "address": "Calle Mayor 1",
  "phone": "600000000",
  "owner": {
    "firstName": "Juan",
    "lastName": "García",
    "dni": "12345678A",
    "email": "juan@empresa.com",
    "password": "Pass123!",
    "phone": "600000001"
  },
  "workCenters": [
    { "name": "Centro Sur", "address": "Calle Sur 1", "email": "sur@empresa.com" }
  ]
}
```

**Respuesta 201:**
```json
{
  "company": { "id": 2, "name": "Empresa S.L.", "nif": "B12345678", "address": "...", "phone": null, "active": true },
  "owner": { "uuid": "f47ac10b-...", "email": "juan@empresa.com", "firstName": "Juan", "lastName": "García" },
  "workCenters": [{ "id": 3, "name": "Centro Sur", "address": "...", "email": "..." }]
}
```

---

## 9. Validación — DTOs

El `ValidationPipe` está configurado globalmente en `main.ts`:
```typescript
new ValidationPipe({
  whitelist: true,            // elimina propiedades no declaradas en el DTO
  forbidNonWhitelisted: true, // lanza 400 si llegan props extras
  transform: true,            // necesario para @Type() en DTOs anidados
})
```

**Decoradores de class-validator más usados:**

| Decorator | Qué valida |
|---|---|
| `@IsString()` | Es un string (pero acepta `""`) |
| `@IsNotEmpty()` | No está vacío (`""` falla) |
| `@IsEmail()` | Formato email válido (rechaza `""` también) |
| `@IsOptional()` | Si el campo no viene, no valida |
| `@MinLength(n)` | Longitud mínima |
| `@Matches(/regex/)` | Cumple expresión regular |
| `@IsArray()` | Es un array |
| `@ValidateNested()` | Valida objeto anidado |
| `@Type(() => ClaseDto)` | Necesario para que `@ValidateNested` funcione |

**Regex de contraseña fuerte** (reutilizar en todos los DTOs):
```typescript
@Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]).{8,}$/, {
  message: 'La contraseña debe contener al menos una mayúscula, un número y un carácter especial',
})
```

---

## 10. Módulos — Cómo están conectados

```
AppModule
  ├── DatabaseModule (@Global) ← disponible en toda la app sin importar
  ├── AuthModule
  │     └── exports: JwtAuthGuard, RolesGuard
  └── CompaniesModule
        └── imports: AuthModule  ← para usar JwtAuthGuard y RolesGuard
```

**Regla:** si un módulo necesita usar `JwtAuthGuard` o `RolesGuard`, debe importar `AuthModule`.

**DatabaseModule es `@Global()`** → `DatabaseService` se inyecta en cualquier módulo sin importarlo explícitamente.

---

## 11. Seguridad implementada

| Medida | Dónde | Detalle |
|---|---|---|
| Bcrypt | AuthService | 10 rounds, siempre en hash |
| Timing attack prevention | AuthService.login() | `bcrypt.compare(dummy)` si email no existe |
| Bloqueo de cuenta | AuthService | 5 intentos fallidos → bloqueado 30 min |
| Refresh token rotation | AuthService.refresh() | Token antiguo se revoca al refrescar |
| Tokens en hash | refresh_tokens | SHA-256 del token, nunca el valor en claro |
| Rate limiting login | ThrottleLoginGuard | 10/IP y 5/IP+email en 15 min |
| UUID público | users.uuid | El `id` numérico nunca sale de la BD |
| Helmet | main.ts | Headers HTTP de seguridad |
| CORS | main.ts | Orígenes configurables por .env |
| Whitelist DTO | main.ts | Propiedades extra eliminadas o rechazadas |

---

## 12. Variables de entorno

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=diapp
DB_PASSWORD=diapp
DB_NAME=diapp

JWT_SECRET=tu_secreto_aqui
JWT_EXPIRES_IN=900          # segundos (15 min)

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

PORT=3000
```

---

## 13. Comandos útiles

```bash
# Levantar la API en desarrollo
pnpm nx serve api

# Ejecutar seed (borra y recrea datos de prueba)
pnpm nx run api:seed

# Build de producción
pnpm nx build api

# Ver todos los proyectos del monorepo
pnpm nx show projects
```

---

## 14. Patrones a seguir al añadir un módulo nuevo

1. Crear carpeta `api/src/nombre-modulo/`
2. Crear `nombre-modulo.module.ts` con `imports: [AuthModule]`
3. Crear `nombre-modulo.controller.ts` con `@UseGuards(JwtAuthGuard, RolesGuard)`
4. Crear `nombre-modulo.service.ts` — inyecta `DatabaseService`
5. Crear `dto/` con los DTOs necesarios
6. Añadir el módulo en `app.module.ts`

**Si necesitas transacción en el service:**
```typescript
return this.db.transaction(async (query) => {
  // todas las queries comparten la misma conexión
});
// Excepción lanzada dentro → ROLLBACK automático
```
