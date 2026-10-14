# FinallyLoseWeight

[![CI](https://github.com/adnanbkz/FinallyLoseWeight/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/adnanbkz/FinallyLoseWeight/actions/workflows/ci.yml)

> Mira tu progreso y sigue adelante.

Diario de fitness para un grupo pequeño de amigos invitados. Es una **PWA** que se instala en iPhone
y Android. Cada persona apunta su peso diario, sus comidas, sus pasos y sus sesiones de cardio, y
**solo ve sus propios datos**.

- **Peso diario** con gráfica y media móvil de 7 días.
- **Comidas** con kcal y macros opcionales (proteína, hidratos y grasa), frente a tu objetivo diario.
- **Pasos** del día.
- **Cardio en cinta inclinada**: calcula las kcal con las fórmulas del ACSM. El balance usa las kcal
  **netas** (sin el gasto en reposo). Se pueden añadir más máquinas sin tocar el frontend.
- **Acceso solo por invitación** (lista de emails), con login por email/contraseña o Google.
- **RGPD**: consentimiento explícito en el alta, exportación de todos tus datos en JSON y borrado de
  la cuenta. Datos en la UE.

## Arquitectura

```
┌───────────────────┐         ┌──────────────────────────────┐           ┌────────────────────────┐
│ Móvil / navegador │ HTTPS   │ Firebase Hosting (*.web.app) │  despliega│ GitHub Actions         │
│ PWA instalada     │────────►│ PWA: React + Vite + TS       │◄──────────│ ci.yml: build + tests  │
└────┬─────────┬────┘         └──────────────────────────────┘           │ deploy-web.yml         │
     │         │                                                         │ deploy-api.yml         │
     │         │ JSON +                                                  └────────────┬───────────┘
     │         │ Bearer                                                               │
     │         │ <ID token>   ┌──────────────────────────────┐                        │
     │         │              │ API .NET 10 (Minimal APIs)   │  despliega             │
     │         └─────────────►│ Azure App Service Linux      │◄───────────────────────┘
     │                        │ West Europe                  │
     │                        └───┬───────────────────────┬──┘
     │ login: email/              │ Admin SDK             │
     │ contraseña, Google         │ (borrar cuenta)       │ EF Core + Npgsql
     ▼                            ▼                       ▼
┌──────────────────────────────────────┐              ┌────────────────────────┐
│ Firebase Authentication              │              │ PostgreSQL (Neon)      │
│ (proyecto nuevo, solo login)         │              │ AWS Frankfurt (UE)     │
└──────────────────────────────────────┘              └────────────────────────┘
```

- El frontend usa Firebase **solo para autenticarse**. Los datos van siempre a la API.
- La API valida el token de Firebase y **saca el UID del token**: el cliente nunca envía `userId`, y
  pedir un recurso de otro usuario devuelve 404.
- Solo entran los emails de `Access:AllowedEmails`, y además con el email verificado.

## Estructura del repo

```
FinallyLoseWeight/
├─ api/
│  ├─ FinallyLoseWeight.slnx
│  ├─ src/FinallyLoseWeight.Api/          # .NET 10, Minimal APIs, EF Core 10 + Npgsql, auth Firebase
│  └─ tests/FinallyLoseWeight.Api.Tests/  # xUnit + WebApplicationFactory contra PostgreSQL real
├─ web/                                   # PWA: React + Vite + TypeScript (vite-plugin-pwa)
├─ docs/
│  ├─ PLAN.md                             # plan aprobado (decisiones y motivos)
│  ├─ API.md                              # contrato de la API: fuente de verdad para api/ y web/
│  ├─ openapi.json                        # el mismo contrato en OpenAPI, generado por la API (tests de ambos lados)
│  └─ SETUP.md                            # paso a paso: Firebase, Neon, Azure, GitHub y desarrollo local
├─ .github/
│  ├─ workflows/ci.yml                    # build + tests en cada push y PR
│  ├─ workflows/deploy-api.yml            # tests → App Service (push a main en api/**)
│  ├─ workflows/deploy-web.yml            # tests → Firebase Hosting (push a main en web/**)
│  └─ dependabot.yml                      # actualizaciones semanales agrupadas
├─ firebase.json                          # Hosting: web/dist, SPA, caché y cabeceras de seguridad
└─ .firebaserc                            # ID del proyecto de Firebase (cámbialo por el tuyo)
```

## Arranque rápido (desarrollo local)

Necesitas .NET SDK 10, Node.js 22, PostgreSQL 16 (o Docker) y un proyecto de Firebase con
Authentication activado. El detalle está en [docs/SETUP.md §7](docs/SETUP.md#7-desarrollo-local).

```bash
# 1. Base de datos
docker run --name flw-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16

# 2. API (http://localhost:5100). Crea la BD flw_dev y aplica las migraciones al arrancar.
cd api/src/FinallyLoseWeight.Api
dotnet user-secrets init
dotnet user-secrets set "Firebase:ProjectId" "<project-id>"
dotnet user-secrets set "Access:AllowedEmails" "tu@gmail.com"
cd ../../..
dotnet run --project api/src/FinallyLoseWeight.Api

# 3. Web (http://localhost:5173), en otra terminal
cd web
cp .env.example .env.local   # rellena VITE_FIREBASE_* y VITE_API_BASE_URL=http://localhost:5100
npm ci
npm run dev
```

## Comandos

| | Comando |
|---|---|
| Compilar la API | `dotnet build api/FinallyLoseWeight.slnx` |
| Tests de la API (necesitan PostgreSQL; `FLW_TEST_CONNECTION` para otro servidor) | `dotnet test api/FinallyLoseWeight.slnx` |
| Nueva migración | `dotnet ef migrations add <Nombre> --project api/src/FinallyLoseWeight.Api` |
| Regenerar `docs/openapi.json` tras cambiar el contrato | `FLW_UPDATE_OPENAPI=1 dotnet test api/FinallyLoseWeight.slnx --filter OpenApiSnapshotTests` |
| Web: comprobar todo | `cd web && npm run typecheck && npm run lint && npm test && npm run build` |
| Web: servir la build | `cd web && npm run preview` |

## Despliegue

Todo se despliega desde `main` con GitHub Actions y **solo si pasan los tests**:

- `api/**` → **Deploy API** → Azure App Service (F1, West Europe) y comprobación de `/health`.
- `web/**`, `firebase.json` → **Deploy web** → Firebase Hosting (`https://<project-id>.web.app`).

La primera vez hay que crear los recursos y configurar los secretos y variables de GitHub. Sigue
[docs/SETUP.md](docs/SETUP.md). Coste en el plan gratuito: **0 €/mes**.

## Documentación

- [docs/PLAN.md](docs/PLAN.md): plan aprobado (arquitectura, modelo de datos, RGPD, alternativas).
- [docs/API.md](docs/API.md): contrato de la API (rutas, formatos, códigos de error).
- [docs/SETUP.md](docs/SETUP.md): puesta en marcha, desarrollo local, costes, solución de problemas y
  checklist de RGPD.
