# FinallyLoseWeight

Diario de fitness (peso, comidas, pasos, cardio) como PWA para un grupo pequeño de usuarios invitados.

- `api/` — ASP.NET Core 10 Minimal APIs, EF Core 10 + Npgsql (PostgreSQL), auth con Firebase ID tokens.
- `web/` — React + Vite + TypeScript PWA (Firebase Auth solo para login; datos siempre vía API).
- `docs/PLAN.md` — plan aprobado. `docs/API.md` — **contrato de la API, fuente de verdad para api/ y web/**.
- `docs/SETUP.md` — alta de Firebase, Neon y Azure.

## Comandos

```bash
# API (requiere Postgres; tests usan FLW_TEST_CONNECTION o localhost:5432 postgres/postgres)
dotnet build api/FinallyLoseWeight.slnx
dotnet test api/FinallyLoseWeight.slnx
dotnet ef migrations add <Name> --project api/src/FinallyLoseWeight.Api

# Web
cd web && npm ci && npm run typecheck && npm run lint && npm test && npm run build
```

## Reglas

- El UID sale **siempre** del token (`sub`); ningún DTO de entrada lleva `userId`. Recursos de otro usuario → 404.
- Código e identificadores en inglés; textos de UI y docs en español.
- Fechas del diario son `DateOnly` / `"YYYY-MM-DD"` en hora local del usuario. En el frontend nunca uses
  `toISOString()` para obtener "hoy" (da la fecha UTC).
- Secretos (cadena de conexión, service account de Firebase) nunca en el repo.
