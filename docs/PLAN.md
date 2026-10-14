# FinallyLoseWeight — Plan v1 (aprobado)

> **Aprobado el 14-oct-2026** con todas las opciones recomendadas (⭐) de §12. Lo que cambió al
> implementarlo, y por qué, está en §13. El contrato exacto de la API está en [API.md](API.md).

Diario de fitness como PWA (iPhone + Android) para ti y unos pocos amigos.
Cada usuario registra **peso diario**, **comidas** y **actividad** (pasos y cardio).
Proyecto **nuevo e independiente**: repo nuevo (este), proyecto Firebase nuevo,
recursos Azure nuevos. FitFusion (API y app Android) no se toca.

---

## 1. Punto de partida

- El repo `FinallyLoseWeight` está vacío: `README.md` y un `.gitignore` de Xcode
  (habrá que cambiarlo por uno de .NET + Node).
- Se mantiene el stack que ya conoces (ASP.NET Core + Firebase JWT + EF Core + Azure App Service),
  con dos cambios:
  - **.NET 10 (LTS) en lugar de .NET 8**: el soporte de .NET 8 (y .NET 9) termina el
    **10-nov-2026**, y .NET 10 tiene soporte hasta nov-2028. No tiene sentido empezar un proyecto
    nuevo en una versión a la que le quedan semanas.
  - **Base de datos**: ver §8 (recomiendo PostgreSQL en vez de SQLite).

## 2. Arquitectura

```
 ┌──────────────────────────┐  ID token (Bearer)  ┌───────────────────────────┐      ┌──────────────────┐
 │ PWA React (Firebase      │ ──────────────────► │ API .NET 10               │ ───► │ PostgreSQL (UE)  │
 │ Hosting, *.web.app)      │ ◄────────────────── │ Azure App Service (Linux) │      │ EF Core + Npgsql │
 └────────────┬─────────────┘        JSON         └─────────────┬─────────────┘      └──────────────────┘
              │ login (email/contraseña, Google)                │ Admin SDK (borrar la cuenta y comprobar el usuario en el alta)
              ▼                                                 ▼
        ┌─────────────────────────── Firebase Auth (proyecto nuevo) ───────────────────────────┐
```

- El frontend solo usa Firebase para **autenticarse**. Los datos van siempre a la API.
- La API valida el JWT de Firebase y **saca el UID del token**. El cliente nunca envía `userId`.

## 3. Modelo de datos

Todas las tablas cuelgan de `UserProfile` con `ON DELETE CASCADE`, así que al borrar el perfil
se borra todo lo demás. Los IDs son `Guid` v7 y las fechas del diario son `DateOnly`:
el día local que elige el cliente, para no tener problemas de zona horaria.

| Entidad | Campos | Restricciones |
|---|---|---|
| **UserProfile** | `Uid` (PK, UID Firebase), `DisplayName` (alias), `HeightCm?`, `TargetWeightKg?`, `DailyKcalTarget?`, `ConsentAt`, `PrivacyVersion`, `CreatedAt`, `UpdatedAt` | No se guarda el email (ya lo tiene Firebase) |
| **WeightEntry** | `Id`, `UserId`, `Date`, `WeightKg` (decimal 5,2), `Note?` | Único `(UserId, Date)` → un peso por día |
| **MealEntry** | `Id`, `UserId`, `Date`, `MealType` (Desayuno/Comida/Cena/Snack), `Description`, `Kcal`, `ProteinG?`, `CarbsG?`, `FatG?` | Índice `(UserId, Date)` |
| **DailySteps** | `Id`, `UserId`, `Date`, `Steps` | Único `(UserId, Date)` |
| **CardioSession** | `Id`, `UserId`, `Date`, `Machine` (código, p. ej. `incline-treadmill`), `DurationMin`, `AvgSpeedKmh?`, `InclinePercent?`, `ResistanceLevel?`, `WeightKgUsed`, `KcalGross`, `KcalNet`, `FormulaVersion`, `Note?` | Índice `(UserId, Date)` |

Notas:
- `CardioSession` guarda los parámetros, el peso usado y la versión de la fórmula. Así el
  histórico no cambia si la fórmula se ajusta más adelante.
- Las columnas de parámetros son nullable (velocidad, inclinación, resistencia), así que para
  añadir máquinas no hace falta migrar el esquema.
- De momento, los pasos **no se convierten en kcal**: si caminas en la cinta con el móvil, esos
  pasos ya se cuentan en la sesión de cardio y se sumarían dos veces.

## 4. Aislamiento por usuario (cada uno solo ve lo suyo)

1. **JWT de Firebase**: `JwtBearer` con `Authority = https://securetoken.google.com/<projectId>`,
   validando issuer, audience (`<projectId>`), firma y caducidad. El UID se lee del claim `sub`.
2. **Acceso solo por invitación**: con Firebase cualquiera que tenga la URL puede registrarse.
   La API solo acepta emails de una lista blanca en configuración (`Access:AllowedEmails`) y con
   `email_verified = true`. Al resto le devuelve 403.
3. **`ICurrentUser`** (scoped) expone el UID. Todas las consultas filtran por `UserId == uid`.
   Como segunda barrera, EF Core aplica un **global query filter** con ese mismo UID.
4. Los DTOs de entrada **no tienen `UserId`**: el servidor lo pone al insertar.
5. Pedir un recurso de otro usuario devuelve **404** en lugar de 403, para no revelar que existe.
6. **Rate limiting** con el limitador nativo de ASP.NET Core, particionado por UID
   (120 peticiones/min por defecto, configurable con `RateLimit:PermitsPerMinute`; ver §13).
7. **CORS** solo para el dominio de Firebase Hosting, más `localhost` en desarrollo.
8. **Secretos** (cadena de conexión, service account de Firebase) en la configuración de
   App Service o en Key Vault. Nunca en el repo.
9. **Tests de integración** con dos usuarios falsos que comprueban, endpoint por endpoint,
   que A no puede leer, modificar ni borrar lo de B.

## 5. Endpoints

Todos van bajo `/api` y requieren autenticación, salvo `/health`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/me` | Mi perfil (404 si aún no he completado el alta) |
| PUT | `/api/me` | Crear/actualizar perfil. En el alta incluye el consentimiento explícito |
| GET | `/api/me/export` | Descarga JSON con todos mis datos (RGPD art. 15/20) |
| DELETE | `/api/me` | Borra todos mis datos y mi usuario de Firebase (ver §7) |
| GET | `/api/weights?from=&to=` | Pesos en un rango |
| PUT | `/api/weights/{date}` | Crear o reemplazar el peso de ese día (idempotente) |
| DELETE | `/api/weights/{date}` | |
| GET | `/api/meals?from=&to=` | |
| POST | `/api/meals` | |
| PUT | `/api/meals/{id}` | |
| DELETE | `/api/meals/{id}` | |
| GET | `/api/steps?from=&to=` | |
| PUT | `/api/steps/{date}` | Crear o reemplazar los pasos del día |
| DELETE | `/api/steps/{date}` | |
| GET | `/api/cardio/machines` | Catálogo de máquinas y campos que pide cada una (alimenta el desplegable) |
| POST | `/api/cardio/estimate` | Calcula las kcal sin guardar (vista previa en el formulario) |
| GET | `/api/cardio?from=&to=` | |
| POST | `/api/cardio` | Guarda la sesión. El servidor **recalcula** las kcal y no se fía de lo que mande el cliente |
| PUT | `/api/cardio/{id}` | |
| DELETE | `/api/cardio/{id}` | |
| GET | `/api/days/{date}` | Resumen del día: peso, comidas y total de kcal, pasos, cardio, objetivo |
| GET | `/api/stats?from=&to=` | Series para gráficas: peso + media móvil de 7 días, kcal ingeridas, kcal de cardio, pasos |
| GET | `/health` | Healthcheck (sin auth). No consulta la BD |
| GET | `/health/db` | Comprueba la conexión con la BD (requiere token de un invitado; ver §13) |

Validación de rangos:
- peso 20–400 kg
- pasos 0–150 000
- velocidad 0,5–25 km/h
- pendiente 0–40 %
- duración 1–600 min
- kcal por comida 0–5000

## 6. Cardio configurable: cálculo

**Diseño extensible.** Cada máquina es una clase `ICardioCalculator` con un descriptor:
`id`, nombre y lista de campos (`key`, etiqueta, unidad, min, max, paso).
`GET /api/cardio/machines` devuelve ese catálogo y el frontend **genera el formulario
dinámicamente**. Para añadir elíptica, bici o escaladora basta con una clase nueva en el
backend y registrarla; el frontend no cambia.

**v1: solo «Cinta inclinada»**, que pide **pendiente (%)**, **tiempo (min)** y
**velocidad media (km/h)**.

Fórmulas metabólicas del ACSM (S = velocidad en m/min, G = pendiente en tanto por uno):

- Caminando (< 7 km/h): `VO₂ = 0,1·S + 1,8·S·G + 3,5` (ml/kg/min)
- Corriendo (≥ 7 km/h): `VO₂ = 0,2·S + 0,9·S·G + 3,5` (ml/kg/min)
- `kcal/min = VO₂ · peso_kg / 1000 · 5` (≈ 5 kcal por litro de O₂)
- **Brutas** = con el 3,5 de reposo (lo que suele mostrar la máquina).
  **Netas** = restando el reposo. El balance diario usa las **netas**, porque el gasto en
  reposo ya forma parte de tu gasto basal.
- El peso es el último `WeightEntry` con fecha ≤ la de la sesión. Si no hay ninguno,
  el formulario lo pide.

Ejemplo (70 kg, 4,8 km/h = 80 m/min, 12 %, 30 min):
`VO₂ = 8 + 17,28 + 3,5 = 28,78` → 10,1 kcal/min → **≈ 302 kcal brutas / ≈ 265 netas**.

Habrá tests unitarios con valores conocidos para cada ecuación y los casos límite.

## 7. RGPD (lo básico)

- **Datos de salud**: el peso y las comidas son una categoría especial (art. 9). En el alta se
  pide **consentimiento explícito** (checkbox) y se guardan `ConsentAt` y `PrivacyVersion`.
  También habrá una página de privacidad corta. No conviene apoyarse en la «excepción doméstica»
  aunque sea entre amigos. Esto no es asesoramiento legal.
- **Borrar la cuenta** (`DELETE /api/me`):
  1. Exige un login reciente (claim `auth_time` de menos de 5 min). Si no lo es, responde
     401 con `reauth_required` y el cliente vuelve a pedir la contraseña.
  2. Borra todas las filas del usuario **en una transacción**.
  3. Después borra el usuario de Firebase con el Admin SDK.
  4. Es idempotente: si falla a mitad, se puede repetir. Se borra primero la BD porque, si se
     borrara antes el usuario de Firebase, ya no podría autenticarse para reintentar y quedarían
     datos huérfanos.
- **Exportar** mis datos en JSON (`GET /api/me/export`).
- **Minimización**: no se guarda el email ni nombres reales (solo un alias), y los logs no
  incluyen cuerpos de petición.
- **Datos en la UE**: App Service en West Europe y la BD en una región de la UE. Firebase Auth
  guarda el email en infraestructura de Google, con las garantías contractuales de Google.

**Gemini**: **no entra en la v1**, y el cálculo de cardio es determinista, sin IA. Si se añade
más adelante (p. ej. estimar las kcal de una comida a partir del texto), la API key irá solo en
el servidor, habrá una tabla `AiUsage(UserId, Date, Calls)` con un límite diario configurable
por usuario además del rate limiter, y esos datos también se borrarán al borrar la cuenta.

## 8. ¿SQLite en Azure aguanta varios usuarios?

**El problema no es la carga.** Diez usuarios escribiendo unas pocas filas al día no son nada
para SQLite. **El problema es dónde está el fichero**:

- En App Service Linux, el almacenamiento persistente (`/home`) es un **recurso compartido de
  red (CIFS/SMB)**. SQLite desaconseja usarse sobre sistemas de ficheros de red porque los
  bloqueos no son fiables, y hay muchos casos documentados de `database is locked` en App Service.
- No se puede escalar a más de una instancia, ni usar deployment slots con la misma BD: dos
  procesos escribiendo en el mismo fichero acaban en bloqueos o corrupción.
- Si se guarda en el disco local, se pierde con cada reinicio o redespliegue.
- Las copias de seguridad corren de tu cuenta, y la copia de App Service no es consistente para
  un SQLite que se está escribiendo.

**Conclusión**: funcionaría en la práctica con una sola instancia, pero es frágil y estos datos
no se pueden perder. **Recomiendo cambiar de base de datos.**

| Opción | Coste | Pros | Contras |
|---|---|---|---|
| **PostgreSQL en Neon (free, región UE)** ⭐ | 0 € (100 CU-h/mes, 0,5 GB, sobra para este uso) | Gestionada, backups, se apaga sola cuando no se usa y vuelve en poco tiempo; EF Core + Npgsql muy maduro; `pg_dump` portable si un día quieres moverla a Azure | Otro proveedor fuera de Azure (firmar su DPA); el free tier tiene límites |
| Azure SQL Database (oferta gratuita serverless) | 0 € (100 000 vCore-s/mes, 32 GB) | Dentro de Azure; EF Core de primera | Tras la autopausa tarda del orden de **un minuto** en despertar (mal para abrir la app y apuntar el peso), y con varios usuarios a distintas horas el cupo de vCore-s puede no llegar |
| Azure Database for PostgreSQL Flexible (B1ms) | Gratis 12 meses en cuentas nuevas, luego unos 12–15 €/mes | Todo en Azure, siempre encendida | De pago |
| SQLite en App Service | 0 € | Lo más simple | Lo explicado arriba |

**Recomendación**: PostgreSQL en Neon. Si algún día prefieres tenerlo todo en Azure, el cambio
es un `pg_dump`/`pg_restore` y cambiar la cadena de conexión, sin tocar código.

App Service: **F1 (gratis)** tiene arranque en frío tras ~20 min sin uso (varios segundos la
primera petición). **B1 (unos 13 €/mes)** tiene *Always On*. Se puede empezar en F1 y subir de plan.

## 9. Frontend: opciones de stack

| | **A. React + Vite + TS + vite-plugin-pwa** ⭐ | B. Blazor WebAssembly PWA (.NET 10) | C. SvelteKit (adapter-static) + vite-pwa |
|---|---|---|---|
| **Pros** | Ecosistema enorme (TanStack Query, react-hook-form + zod, Recharts); `vite-plugin-pwa` genera el manifest y el service worker (Workbox); bundle pequeño; SDK oficial de Firebase JS; la opción con más documentación y ejemplos | Todo en C#: se comparten DTOs y la calculadora de cardio con el backend; plantilla PWA incluida | Bundles mínimos, la más rápida en móviles; menos código para formularios y reactividad |
| **Contras** | Hay que elegir varias librerías; DTOs en TS separados de C# (mitigable generando el cliente desde OpenAPI) | Descarga inicial de varios MB y arranque lento en móvil; Firebase Auth no tiene SDK para Blazor (hay que hacer interop con JS); menos librerías de UI y gráficas para móvil | Ecosistema y comunidad más pequeños; menos componentes hechos |

**Recomendación: A**, con Tailwind para la UI y Recharts para la gráfica de peso.

**Hosting del frontend: Firebase Hosting** (gratis, CDN, HTTPS). Además, permite que el
`authDomain` de Firebase Auth sea el mismo dominio que la app. Eso evita los fallos conocidos
del login con Google por redirección en Safari/iOS (que bloquea el almacenamiento de terceros),
sobre todo con la PWA instalada. El coste es configurar CORS en la API, que es trivial.

Detalles específicos de PWA en iOS que se tendrán en cuenta:
- iOS no muestra un botón de «instalar». Habrá una pantalla con instrucciones
  (Compartir → *Añadir a pantalla de inicio*). En Android se usa `beforeinstallprompt`.
- La PWA instalada en iOS no comparte almacenamiento con Safari, así que hay que iniciar sesión
  dentro de la app instalada.
- `apple-touch-icon`, `viewport-fit=cover` y *safe areas* para el notch.
- `inputmode="decimal"` y aceptar coma decimal («72,5»).
- Login con **email/contraseña + Google**. *Sign in with Apple* exige cuenta de Apple Developer
  (99 $/año), así que queda fuera por ahora.

Pantallas de la v1:
1. **Hoy**: añadir rápido peso, comida, pasos y cardio; totales del día.
2. **Historial**: lista por días.
3. **Progreso**: gráfica de peso con media móvil de 7 días; kcal ingeridas frente al objetivo.
4. **Perfil**: datos, exportar, borrar la cuenta.
5. **Login, alta (consentimiento) y cómo instalar.**

## 10. Estructura del repo

```
FinallyLoseWeight/
├─ api/
│  ├─ src/FinallyLoseWeight.Api/          # .NET 10, Minimal APIs, EF Core + Npgsql, OpenAPI
│  └─ tests/FinallyLoseWeight.Api.Tests/  # xUnit, WebApplicationFactory, PostgreSQL real (ver §13)
├─ web/                                    # React + Vite + TS (PWA)
├─ docs/
│  ├─ PLAN.md                              # este documento
│  ├─ API.md                               # contrato de la API (fuente de verdad para api/ y web/)
│  ├─ openapi.json                         # el mismo contrato en OpenAPI, generado por la API
│  └─ SETUP.md                             # paso a paso: Firebase, Neon y Azure
└─ .github/workflows/                      # CI (build + tests), deploy de la API y del frontend
```

## 11. Fases

0. **Infra (la haces tú, con la guía `SETUP.md` que te preparo)**: proyecto Firebase nuevo
   (Auth con email + Google; Hosting), BD en Neon (UE), App Service Linux (.NET 10, West Europe).
1. **API**: auth, lista de invitados, perfil, peso, comidas, pasos, cardio y calculadora,
   export, borrado de cuenta, rate limit. Tests de aislamiento entre usuarios y de la calculadora.
2. **PWA**: pantallas de §9, manifest, iconos, service worker (el *app shell* funciona sin conexión).
3. **CI/CD y despliegue**: GitHub Actions → App Service y Firebase Hosting; invitar a los amigos.

Para más adelante:
- más máquinas de cardio
- cola de registros sin conexión
- recordatorios push (iOS 16.4+ con la PWA instalada)
- Gemini con cuotas
- cálculo de TDEE y objetivo automático

## 12. Decisiones (aprobadas el 14-oct-2026)

Se aprobaron todas las opciones recomendadas:

1. **Base de datos**: **PostgreSQL en Neon** (región UE), con EF Core 10 + Npgsql.
2. **Frontend**: **React + Vite + TypeScript** (PWA en Firebase Hosting).
3. **Acceso solo por invitación**: **sí**, con la lista `Access:AllowedEmails`.
4. **Login**: **email/contraseña + Google**.
5. **Nombre de la app**: **«FinallyLoseWeight»**.
6. **Kcal de cardio en el balance**: **netas**.
7. **App Service**: **F1** (gratis) para empezar; se puede subir a B1 sin tocar código.

También se confirmó: **.NET 10**, un **proyecto de Firebase nuevo** solo para autenticación y
**sin Gemini en la v1**.

## 13. Cambios respecto al plan durante la implementación

Son cambios pequeños y deliberados. Cada uno está documentado también donde se usa.

1. **Tests contra un PostgreSQL externo en vez de Testcontainers** (§10). Los tests de integración usan
   un PostgreSQL 16 real, pero no lo arrancan ellos: se conectan al servidor de `FLW_TEST_CONNECTION`
   (por defecto `localhost:5432`, `postgres`/`postgres`). En la CI es un *service container* de GitHub
   Actions. Cada clase de tests crea su propia base de datos con un nombre único y la borra al acabar.
   El motivo es que el entorno donde se desarrolló no tiene Docker. Además, así los tests funcionan igual
   con un PostgreSQL instalado o en Docker, y siguen probando contra el mismo motor que producción. Ver
   README «Comandos» y SETUP §7.4.
2. **Rate limit de 120 peticiones/min por usuario en vez de unas 60** (§4.6). Abrir una pantalla hace
   varias peticiones seguidas, y el formulario de cardio pide la estimación de kcal mientras escribes
   (con *debounce*). Con 120 hay margen para un uso normal intenso y se sigue frenando un abuso. Se
   cambia sin desplegar con `RateLimit__PermitsPerMinute` (SETUP §3.4).
3. **`GET /health/db` además de `/health`** (§5). `/health` es anónimo y **no** consulta la base de
   datos, para que ningún monitor externo mantenga Neon despierto y gaste las horas gratis.
   `/health/db` sí comprueba la conexión, pero exige el token de un invitado y cuenta para el rate
   limit. Ver API.md «Salud» y SETUP §3.6.
4. **El Admin SDK también se usa en el alta** (§2, §7). Un ID token sigue siendo válido hasta 1 hora
   después de borrar o deshabilitar la cuenta de Firebase. Por eso `PUT /api/me`, al **crear** el
   perfil, comprueba con el Admin SDK que el usuario sigue existiendo y no está deshabilitado. Si no,
   responde 401 y no guarda nada. Así no se recrean datos de una cuenta recién borrada. Ver API.md
   «Perfil y cuenta».
5. **Contrato verificable** (§9: era el «contra» de React, «DTOs en TS separados de C#»). Además de API.md,
   la API genera `docs/openapi.json`. Los tests de la API fallan si ese fichero no coincide con el
   código, y los de la web comprueban que `web/src/api/types.ts` coincide con él (nombres, tipos,
   nulos, enums, rutas y códigos de error). Ver API.md, al principio.
