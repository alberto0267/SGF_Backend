# SGF Backend — Endpoints disponibles

Base URL: `http://localhost:3000/api`

Todos los endpoints excepto `auth/login` y `auth/refresh` requieren header:
`Authorization: Bearer <token>`

---

## AUTH

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/auth/login` | Público | Login. Devuelve accessToken + refreshToken |
| POST | `/auth/refresh` | Público | Renueva accessToken con refreshToken |
| POST | `/auth/logout` | Todos | Cierra sesión, revoca token |
| GET | `/auth/me` | Todos | Datos del usuario autenticado |

---

## USERS

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/users` | SuperAdmin, Owner, Manager | Lista usuarios de la empresa |
| GET | `/users/:uuid` | SuperAdmin, Owner, Manager | Detalle de un usuario |
| POST | `/users/create-manager` | SuperAdmin, Owner | Crear Manager |
| POST | `/users/create-employee` | SuperAdmin, Owner | Crear Employee |
| PATCH | `/users/:uuid` | SuperAdmin, Owner | Editar perfil |
| PATCH | `/users/:uuid/role` | SuperAdmin | Cambiar rol |
| PATCH | `/users/:uuid/active` | SuperAdmin, Owner | Activar / desactivar |
| DELETE | `/users/:uuid` | SuperAdmin, Owner | Eliminar usuario |

---

## COMPANIES

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/companies` | SuperAdmin | Lista empresas paginada |
| GET | `/companies/select` | SuperAdmin | Lista empresas para desplegable (sin paginar) |
| POST | `/companies/create-company` | SuperAdmin | Crear empresa |
| PATCH | `/companies/:uuid` | SuperAdmin | Editar empresa |
| PATCH | `/companies/:uuid/active` | SuperAdmin | Activar / desactivar empresa |
| DELETE | `/companies/:uuid` | SuperAdmin | Eliminar empresa y todos sus datos |

---

## WORKCENTERS

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/workcenters` | SuperAdmin | Lista todos los centros de trabajo |
| GET | `/workcenters/mine` | Owner | Lista centros de trabajo de su empresa |
| POST | `/workcenters/create-workcenters` | SuperAdmin | Crear centro de trabajo |
| PATCH | `/workcenters/:uuid` | SuperAdmin | Editar centro de trabajo |
| DELETE | `/workcenters/:uuid` | SuperAdmin | Eliminar centro de trabajo |

---

## OVERTIMES (Horas extra)

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/overtimes` | Manager | Crear solicitud de horas extra |
| GET | `/overtimes` | Owner, Manager | Lista solicitudes (filtros: mes, año, estado, workcenter) |
| GET | `/overtimes/accumulation` | Owner, Manager | Horas acumuladas por empleado/mes (incluye `hours_paid` y `hours_pending`) |
| GET | `/overtimes/approved-detail` | Owner, Manager | Detalle de solicitudes aprobadas |
| POST | `/overtimes/payments` | Owner | Registrar pago de horas acumuladas (modalidad `money` / `hours_off`). Valida no sobre-pago |
| GET | `/overtimes/payments` | Owner | Historial de pagos de un empleado/mes (filtros: `employeeUuid`, `month`, `year`) |
| PATCH | `/overtimes/:uuid/approve` | Owner | Aprobar solicitud |
| PATCH | `/overtimes/:uuid/reject` | Owner | Rechazar solicitud |

---

## LEAVES (piloto DDD + hexagonal)

Arquitectura: `domain/` (agregados, VO, puertos) + `application/` (casos de uso) + `infrastructure/` (SQL, HTTP, module). Ver [CHULETA-DDD-HEXAGONAL.md](CHULETA-DDD-HEXAGONAL.md).

### Vacaciones
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/leaves/vacaciones` | Employee, Manager, Owner | Listar (employee lo suyo, manager su centro, owner su empresa) |
| POST | `/leaves/vacaciones` | Employee | Solicitar (valida bolsa 30 días naturales/año + no solapamiento) |
| PATCH | `/leaves/vacaciones/:id` | Employee | Editar (solo en pending, revalida saldo + solapamiento) |
| POST | `/leaves/vacaciones/:id/comentarios` | Employee, Owner | Añadir comentario al hilo |
| PATCH | `/leaves/vacaciones/:id/approve` | Owner | Aprobar (scoping por empresa) + notifica al empleado |
| PATCH | `/leaves/vacaciones/:id/reject` | Owner | Rechazar (scoping por empresa) + notifica al empleado |

### Ausencias (sin saldo; por días u horas)
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/leaves/ausencias` | Employee, Manager, Owner | Listar (mismo scoping que vacaciones) |
| POST | `/leaves/ausencias` | Employee | Solicitar (modalidad `dias` o `horas` con tramo) |
| PATCH | `/leaves/ausencias/:id` | Employee | Editar (solo en pending) |
| POST | `/leaves/ausencias/:id/comentarios` | Employee, Owner | Añadir comentario al hilo |
| PATCH | `/leaves/ausencias/:id/approve` | Owner | Aprobar (scoping) + notifica al empleado |
| PATCH | `/leaves/ausencias/:id/reject` | Owner | Rechazar (scoping) + notifica al empleado |

Notificaciones: al solicitar avisa a los Owners de la empresa; al aprobar/rechazar avisa al empleado. (Solo filas en BD; el push Firebase sigue siendo deuda.)

---

## CASH REGISTER — Cierre de caja (capas + DDD)

Entidad `CierreCaja` que calcula los derivados (`dif_datafono`, `dif_total`, `retiradas = n_ret × valor`, `t_ventas`, `t_efectivo`). Inputs del trabajador: `efectivo, nRet, datafono, cTarjeta, difArqueoEf`.

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/cash-register/closures` | Employee | Crea su cierre del día → notifica al owner (detalle). `UNIQUE(empleado, fecha)` |
| PATCH | `/cash-register/closures/:uuid` | Employee, Owner | Edita (comentario obligatorio, se registra en historial) → notifica al otro lado. Employee solo el suyo; Owner los de su empresa |
| GET | `/cash-register/closures` | Owner | Lista por mes (`month`, `year`) agrupada por día con totales |
| GET | `/cash-register/resumen` | Owner | Resumen mensual: ventas totales + por empleado **neto** y **solo-faltas** |
| PATCH | `/cash-register/retirada-valor` | Owner | Cambia el valor de retirada de su empresa (default 500) |

Pendiente: notificación modo "resumen al final del día" (2ª fase, necesita job programado).

---

## NOTIFICATIONS

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/notifications` | Todos | Mis notificaciones |
| PATCH | `/notifications/read-all` | Todos | Marcar todas como leídas |
| PATCH | `/notifications/:id/read` | Todos | Marcar una como leída |

---

## Estado por módulo

| Módulo | Controller | Service | Repository | Estado |
|--------|-----------|---------|------------|--------|
| Auth | ✅ | ✅ | ✅ | Completo |
| Users | ✅ | ✅ | ✅ | Completo |
| Companies | ✅ | ✅ | ✅ | Completo |
| Workcenters | ✅ | ✅ | ✅ | Completo |
| Overtimes | ✅ | ✅ | ✅ | Completo |
| Notifications | ✅ | ✅ | ✅ | Completo |
| Refunds | ❌ | ❌ | ❌ | Tabla existe, módulo no creado |
| Vacaciones (leaves) | ✅ | ✅ | ✅ | Piloto DDD completo; compila. Falta probar con front + Firebase |
| Ausencias (leaves) | ✅ | ✅ | ✅ | Piloto DDD completo; compila. Falta probar con front + Firebase |
| Truck deliveries | ❌ | ❌ | ❌ | Tabla existe, módulo no creado |
| Cash register | ✅ | ✅ | ✅ | Capas + DDD; compila. Falta probar + modo resumen diario |
| Bakery | ❌ | ❌ | ❌ | Tabla existe, módulo no creado |
| PDFs | ❌ | ❌ | ❌ | Tabla existe, módulo no creado |

---

## Deuda técnica

| Qué | Por qué | Cuándo |
|-----|---------|--------|
| `app.listen(port, '0.0.0.0')` → volver a `app.listen(port)` + nginx delante | En dev necesario para móvil en red local. En prod NestJS no debe quedar expuesto directamente | Antes de salir a producción |
| Notificaciones push con Firebase (FCM) a Android. Hoy solo se guardan filas en `notifications`; no se empuja nada al móvil. Tabla `mobile_tokens` creada pero sin usar. **Quién recibe qué**: Owner → push cuando el Manager pide horas extras; Manager (`requested_by`) → push cuando el Owner aprueba o rechaza. Empleado nunca recibe nada. | Primero la lógica de negocio; las notificaciones push van después | Tras cerrar el módulo de pago de horas |
