# Chuleta — DDD + Hexagonal (léela con calma)

Resumen de todo lo que vamos tocando, para no olvidarlo. Ejemplos del módulo `leaves` (vacaciones).

---

## 1. La idea madre

> **Decidir** (aplicar reglas, cambiar datos en memoria) y **guardar** (escribir en la BBDD) son **dos cosas separadas.**

`vacacion.aprobar()` NO guarda nada — solo cambia `_estado` en memoria. Guardar lo hace el repo, después y aparte.

---

## 2. Las 3 capas: qué va en cada una

| Capa | Qué tiene | Conoce SQL/NestJS? | Suena a... |
|------|-----------|--------------------|------------|
| **domain/** | Las **reglas** (agregados + value objects) | ❌ NO. TS puro | "X no puede / X debe" |
| **application/** | **Coordinar pasos** (casos de uso) | ❌ NO (solo usa puertos) | "primero…, luego…, después…" |
| **infrastructure/** | Lo técnico: SQL, HTTP, notificaciones | ✅ SÍ, aquí vive lo sucio | "guardar fila", "responder JSON" |

**Truco para decidir dónde va algo:**
- ¿Es una regla sobre la cosa en sí? → **domain**
- ¿Es coordinar varios pasos? → **application**
- ¿Es técnico (BBDD, HTTP)? → **infrastructure**

---

## 3. El "Service" viejo desaparece

En arquitectura por capas, el **Service** tenía reglas + coordinación mezcladas.
En DDD se **parte en dos**:
- Las **reglas** → se van a `domain/` (dentro del agregado).
- La **coordinación** → se va a `application/` (caso de uso).

No hay ningún archivo "service" en hexagonal.

---

## 4. Value Object (VO)

Un dato que **no puede existir roto** y es **inmutable**. Ejemplos: `Rango`, `Comentario`, `Dinero`.

- Constructor **privado** → no se crea con `new` directo.
- Se crea por una factoría que **valida**: `Rango.crear(inicio, fin)` lanza error si `fin < inicio`.
- Consecuencia: si tienes un `Rango` en la mano, **es válido seguro**. No revalidas nunca más.

---

## 5. Agregado (la "caja rica")

Una clase con **datos + reglas dentro**. Ejemplo: `Vacacion`.

- **Datos privados** (`_estado`) + solo **getters** → sin setters → las reglas no se saltan.
- **Dos factorías** (clave):
  - `Vacacion.solicitar(...)` → nace NUEVA (estado `pending`, genera uuid).
  - `Vacacion.fromPersistence(...)` → RECONSTRUIR una que ya existía en BBDD (sin re-aplicar reglas de nacimiento).
- Los métodos **vigilan**: `aprobar()` lanza error si no está `pending`.

Regla: la lógica que cruza **varios** agregados (los 30 días = todas las vacaciones del año) NO va en el agregado, va en el **caso de uso**.

---

## 6. Errores: de dominio vs de aplicación

Donde vive la regla, vive su error.

- **`domain/errors.ts`** → `ValorInvalido`, `OperacionNoPermitida` (reglas de una cosa).
- **`application/errors.ts`** → `SaldoVacacionesExcedido`, `FechasSolapadas` (reglas que coordina el caso de uso). Extienden `DomainError`.

🔑 El dominio **NUNCA** lanza `BadRequestException` de NestJS — eso acoplaría el núcleo al framework. Lanza SU error; el borde (controller) lo traduce a HTTP.

---

## 7. Puerto y Adaptador (el enchufe)

- **Puerto** = una **interfaz** en el dominio. El "hueco". Dice QUÉ necesita, no CÓMO. Habla en idioma de dominio (`guardar(vacacion)`), nunca SQL. Ej: `VacacionRepository`.
- **Adaptador** = la implementación real en `infrastructure/`. El "aparato" que rellena el hueco con SQL de verdad.
- El **module** de NestJS los **enchufa**: `{ provide: TOKEN, useClass: AdaptadorSQL }`.

Resultado: el caso de uso usa el puerto y **nunca sabe** qué hay al otro lado. Cambias de BBDD → cambias el adaptador → el dominio ni se entera.

---

## 8. Symbol y Token (¡importante!)

**El problema:** las **interfaces de TS se evaporan al compilar** (los tipos se borran, solo sobrevive el código real). Entonces NestJS no puede inyectar `VacacionRepository` por su nombre — ya no existe en ejecución.

**La solución:** un **token** = una etiqueta única que SÍ existe en ejecución, para nombrar el enchufe.

```ts
export const VACACION_REPOSITORY = Symbol('VacacionRepository');
```

- El caso de uso: `@Inject(VACACION_REPOSITORY)` = "conéctame a la toma con esta etiqueta".
- El module: "en esa toma va el adaptador SQL".

**¿Por qué `Symbol` y no un string?** Un `Symbol` es **único garantizado** — aunque dos tengan la misma descripción, son distintos. Evita colisiones de nombres.

Recuerda:
- **Clase** = código real → sobrevive a la compilación → NestJS la encuentra sola.
- **Interfaz** = solo tipo → se evapora → necesita un **token** como etiqueta.

---

## 9. La regla de oro de hexagonal

> **Ningún archivo de `domain/` puede importar NestJS, pg, ni un adaptador.**

Se verifica **mirando los imports**. Si `vacacion.ts` algún día importa `@nestjs/common`, has roto hexagonal. El dominio no depende de nadie; todos dependen de él.

---

## 10. Patrón de un caso de uso (cargar → llamar → guardar)

```
1. cargar:   vacacion = repo.buscarPorId(id)      // por el puerto
2. política: scoping (¿misma empresa?)            // política de app
3. llamar:   vacacion.aprobar(ownerId)            // la REGLA la decide el objeto
4. guardar:  repo.guardar(vacacion)               // por el puerto
```

El caso de uso **orquesta**; no decide reglas de negocio (esas están en el agregado).

---

## 11. ¿Cuándo usar DDD/hexagonal y cuándo NO?

- ✅ **SÍ**: dominio con reglas ricas (saldos, estados, aprobaciones). Ej: vacaciones, horas extra.
- ❌ **NO**: CRUD plano (crear/editar/listar). Ej: companies, notifications. Ahí es cañonazo a mosquito → usar capas normales.

**Lo ganas:** testear sin BBDD · reglas blindadas · cambiar infra sin tocar reglas · código que se lee como el negocio.
**Lo pagas:** más archivos, más curva.

---

## 12. Mapa de la metáfora del castillo

| Estación | Qué es | Capa |
|----------|--------|------|
| 1. Rate Limit | frena la tormenta | borde (infra) |
| 2. Auth / JWT | verifica identidad (= Guard) | borde (infra) |
| 3. Validation | limpia el JSON (= Form Request) | borde (infra) |
| 4. Controller | enruta, no decide | infra (adaptador HTTP) |
| 5. Application | coordina los pasos | **application** |
| 6. Domain Core | las reglas, el corazón | **domain** |
| 7. Infrastructure | la BBDD, enchufada de fuera | infra (adaptador) |

> Seguridad en la muralla. Reglas en el torreón. Datos en la bóveda de fuera.

---

## 13. Mapa de archivos del módulo `leaves`

```
leaves/
  domain/                         ← reglas, TS puro
    errors.ts                       DomainError, ValorInvalido, OperacionNoPermitida
    vacacion.ts                     agregado Vacacion
    ausencia.ts                     agregado Ausencia
    value-objects/
      rango.ts, estado.ts, comentario.ts, modalidad-ausencia.ts
    ports/                          ← interfaces (los "huecos")
      vacacion.repository.ts
      ausencia.repository.ts
      directorio-usuarios.ts
  application/                    ← coordinar pasos (casos de uso)
    tokens.ts                       etiquetas para inyectar los puertos
    errors.ts                       SaldoVacacionesExcedido, FechasSolapadas, ...
    solicitar-vacacion.use-case.ts
    aprobar-vacacion.use-case.ts
    rechazar-vacacion.use-case.ts
  infrastructure/                 ← (PENDIENTE) SQL, controller, module
```
