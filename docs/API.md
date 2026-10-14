# API contract (v1)

Fuente de verdad compartida por `api/` y `web/`. Si cambias algo aquí, cambia ambos lados.

`docs/openapi.json` es este mismo contrato en formato OpenAPI 3.1, **generado desde la API** (no se edita a mano;
incluye el esquema `ProblemCode` con todos los valores de `code`). Así ningún lado puede cambiar solo:

- Los tests de la API (`OpenApiSnapshotTests`) fallan si el fichero no coincide con el código. Tras un cambio
  intencionado, regénéralo con `FLW_UPDATE_OPENAPI=1 dotnet test api/FinallyLoseWeight.slnx --filter OpenApiSnapshotTests`.
- Los tests de la web (`web/src/api/contract.test.ts`) comprueban que `web/src/api/types.ts` coincide con él: nombres
  de propiedades, tipos, nulos, enums, rutas y valores de `code`.

## Convenciones

- Base: `{API_BASE_URL}/api/...` (p. ej. `https://flw-api.azurewebsites.net/api/me`). `GET /health` va sin `/api`.
- JSON en **camelCase**. Fechas del diario: `"YYYY-MM-DD"` (día local del usuario, lo decide el cliente).
  Instantes: ISO 8601 UTC (`"2026-10-14T08:30:00Z"`). Decimales como números JSON (`72.5`).
- Enums como strings camelCase: `mealType` ∈ `"breakfast" | "lunch" | "dinner" | "snack"`. Al leer, el
  servidor no distingue mayúsculas (`"Lunch"` se guarda como `"lunch"`); las respuestas usan siempre camelCase.
- Los números van como números JSON: un número enviado como string (`"kcal": "650"`) → 400 en ese campo.
- Cuerpo ausente, JSON mal formado o que no es un objeto → 400. Si el fallo está en un valor concreto, es un
  ValidationProblem con la clave de ese campo (o `body` cuando no se puede atribuir a ninguno).
- Fechas en la ruta (`/api/weights/{date}`, `/api/steps/{date}`, `/api/days/{date}`): `YYYY-MM-DD` estricto → si no, 400 en `date`.
- Rangos `?from&to`: ambos obligatorios, `from ≤ to` y **ambos extremos incluidos** (la longitud del rango
  cuenta los dos: `from = to` es 1 día). Errores en las claves `from`/`to`.
- IDs: UUID (v7) como string.
- Todas las rutas `/api/**` requieren `Authorization: Bearer <Firebase ID token>`.
- Errores: `application/problem+json` (RFC 9457). Los errores de dominio llevan una extensión `code`:

| Status | `code` | Cuándo |
|---|---|---|
| 400 | — (ValidationProblem con `errors: { campo: [mensajes] }`, claves camelCase) | Validación |
| 401 | — | Token ausente/ inválido/ caducado, o (al crear el perfil) el usuario de Firebase ya no existe o está deshabilitado |
| 401 | `reauth_required` | `DELETE /api/me` con login de hace más de 5 min |
| 403 | `email_not_verified` | Token con `email_verified=false` |
| 403 | `not_invited` | Email no está en la lista de invitados |
| 403 | `profile_required` | Endpoint de datos sin haber completado el alta (`PUT /api/me` con consentimiento) |
| 404 | `not_found` | Recurso inexistente **o de otro usuario** (nunca 403 para esto) |
| 404 | `profile_not_found` | `GET /api/me` antes del alta |
| 422 | `weight_required` | Cálculo de cardio sin peso registrado ≤ fecha y sin `weightKg` en el cuerpo |
| 429 | — | Rate limit (cabecera `Retry-After` en segundos) |

### Orden de comprobaciones de acceso

1. Token válido → si no, 401.
2. `DELETE /api/me` y `GET /api/me/export`: **solo** requieren token válido (RGPD: aunque te quiten la
   invitación o no hayas verificado el email, puedes exportar y borrar). `DELETE` además exige login reciente.
3. Resto: `email_verified` → 403 `email_not_verified`; email en `Access:AllowedEmails` → 403 `not_invited`.
4. Endpoints de datos (todo salvo `/api/me*` y `/api/cardio/machines`): perfil existente → 403 `profile_required`.

## Perfil y cuenta

### `GET /api/me` → 200 `Profile` | 404 `profile_not_found`

```json
{
  "displayName": "Adnan",
  "heightCm": 178,
  "targetWeightKg": 75.0,
  "dailyKcalTarget": 2200,
  "consentAt": "2026-10-14T08:30:00Z",
  "privacyVersion": "1",
  "currentPrivacyVersion": "1",
  "createdAt": "2026-10-14T08:30:00Z",
  "updatedAt": "2026-10-14T08:30:00Z"
}
```

- `privacyVersion`: versión del aviso de privacidad que el usuario aceptó (en `consentAt`).
- `currentPrivacyVersion`: versión vigente (`Privacy:CurrentVersion`). Si es distinta de `privacyVersion`, el
  cliente pide aceptar el aviso de nuevo (`PUT /api/me` con los datos actuales y `acceptPrivacy: true`).

### `PUT /api/me` → 201 `Profile` (creado) | 200 `Profile` (actualizado)

```json
{ "displayName": "Adnan", "heightCm": 178, "targetWeightKg": 75.0, "dailyKcalTarget": 2200, "acceptPrivacy": true }
```

- `displayName` 1–40 chars (trim) obligatorio. `heightCm` 100–250, `targetWeightKg` 30–300, `dailyKcalTarget` 800–6000: opcionales/null.
- **Reemplaza todos los campos editables**: un campo opcional omitido o `null` se guarda como `null`. Envía
  siempre el perfil completo, no solo lo que cambia.
- Al **crear**, `acceptPrivacy` debe ser `true` (si no → 400 en `acceptPrivacy`). El servidor guarda
  `consentAt = now` y `privacyVersion = Privacy:CurrentVersion`. Además comprueba con el Admin SDK que el
  usuario de Firebase sigue existiendo y no está deshabilitado (un token sigue siendo válido hasta 1 h después
  de `DELETE /api/me`) → si no, 401 y no se guarda nada.
- Al actualizar, `acceptPrivacy: true` vuelve a sellar el consentimiento con la versión vigente (es lo que
  hace el cliente cuando `privacyVersion ≠ currentPrivacyVersion`); omitido o `false` no toca `consentAt` ni `privacyVersion`.

### `GET /api/me/export` → 200 (descarga)

`Content-Disposition: attachment; filename="finallyloseweight-export-YYYY-MM-DD.json"` (fecha **UTC** del
servidor; la web pone al fichero la fecha local del usuario).

```json
{ "exportedAt": "…", "profile": Profile | null, "weights": [Weight], "meals": [Meal], "steps": [Steps], "cardio": [Cardio] }
```

### `DELETE /api/me` → 204

- Requiere claim `auth_time` con antigüedad ≤ `Security:ReauthMaxAgeMinutes` (5) → si no, 401 `reauth_required`.
- Borra **todas** las filas del usuario en una transacción y después el usuario de Firebase (Admin SDK).
  Idempotente: si el usuario de Firebase ya no existe, también es 204.

## Peso

- `GET /api/weights?from=YYYY-MM-DD&to=YYYY-MM-DD` → 200 `[Weight]` ordenado por fecha asc.
  `from` y `to` obligatorios, `from ≤ to`, rango ≤ 1100 días → si no, 400.
- `PUT /api/weights/{date}` cuerpo `{ "weightKg": 72.5, "note": "en ayunas" }` → 200 `Weight` (crea o reemplaza).
  `weightKg` 20–400; `note` ≤ 200 chars u omitido/null.
- `DELETE /api/weights/{date}` → 204 | 404.

`Weight`: `{ "date": "2026-10-14", "weightKg": 72.5, "note": null }`

## Comidas

- `GET /api/meals?from&to` (mismas reglas de rango) → 200 `[Meal]` ordenado por fecha y `createdAt`.
- `POST /api/meals` → 201 `Meal` (+ `Location`).
- `PUT /api/meals/{id}` → 200 `Meal` | 404.
- `DELETE /api/meals/{id}` → 204 | 404.

Cuerpo (POST/PUT):

```json
{ "date": "2026-10-14", "mealType": "lunch", "description": "Pollo con arroz", "kcal": 650, "proteinG": 45, "carbsG": 70, "fatG": 15 }
```

`description` 1–200 (trim), `kcal` entero 0–5000, macros opcionales 0–1000 (decimales).

`Meal`: el cuerpo + `"id"` y `"createdAt"`.

## Pasos

- `GET /api/steps?from&to` → 200 `[Steps]` ordenado por fecha asc.
- `PUT /api/steps/{date}` cuerpo `{ "steps": 8500 }` (entero 0–150000) → 200 `Steps`.
- `DELETE /api/steps/{date}` → 204 | 404.

`Steps`: `{ "date": "2026-10-14", "steps": 8500 }`

## Cardio

### `GET /api/cardio/machines` → 200 `[Machine]` (requiere invitado; no requiere perfil)

```json
[
  {
    "id": "incline-treadmill",
    "name": "Cinta inclinada",
    "fields": [
      { "key": "inclinePercent", "label": "Pendiente",       "unit": "%",    "min": 0,   "max": 40,  "step": 0.5, "required": true },
      { "key": "durationMin",    "label": "Tiempo",          "unit": "min",  "min": 1,   "max": 600, "step": 1,   "required": true },
      { "key": "avgSpeedKmh",    "label": "Velocidad media", "unit": "km/h", "min": 0.5, "max": 25,  "step": 0.1, "required": true }
    ]
  }
]
```

`key` coincide con la propiedad del cuerpo de `POST /api/cardio`. Claves posibles: `durationMin`,
`avgSpeedKmh`, `inclinePercent`, `resistanceLevel`. El frontend pinta el formulario a partir de esto.

### Cuerpo de cálculo/guardado

```json
{ "date": "2026-10-14", "machine": "incline-treadmill", "durationMin": 30, "avgSpeedKmh": 4.8, "inclinePercent": 12, "resistanceLevel": null, "weightKg": null, "note": null }
```

- `machine` debe existir en el catálogo (si no → 400 en `machine`).
- Campos `required` de la máquina obligatorios y dentro de `[min, max]` (si no → 400 en ese campo).
  Campos que la máquina no usa se ignoran (se guardan null).
- `weightKg` opcional (20–400). Peso usado: `weightKg` si viene; si no, el último `Weight` con fecha ≤ `date`;
  si no hay → 422 `weight_required`.
- `note` ≤ 200 u omitido.

### `POST /api/cardio/estimate` → 200 (no guarda nada)

```json
{ "kcalGross": 302, "kcalNet": 265, "weightKgUsed": 70.0, "weightSource": "entry", "formula": "acsm-walking", "formulaVersion": "acsm-v1" }
```

`weightSource` ∈ `"entry" | "provided"`; `formula` ∈ `"acsm-walking" | "acsm-running"`.

### CRUD

- `GET /api/cardio?from&to` (mismas reglas de rango) → 200 `[Cardio]` ordenado por fecha y `createdAt`.
- `POST /api/cardio` → 201 `Cardio` (+ `Location`). El servidor recalcula; ignora cualquier kcal del cliente.
- `PUT /api/cardio/{id}` → 200 `Cardio` (recalcula) | 404.
- `DELETE /api/cardio/{id}` → 204 | 404.

`Cardio`:

```json
{
  "id": "…", "date": "2026-10-14", "machine": "incline-treadmill", "machineName": "Cinta inclinada",
  "durationMin": 30, "avgSpeedKmh": 4.8, "inclinePercent": 12, "resistanceLevel": null,
  "weightKgUsed": 70.0, "kcalGross": 302, "kcalNet": 265, "formulaVersion": "acsm-v1",
  "note": null, "createdAt": "…"
}
```

### Fórmula `acsm-v1` (cinta)

- `S = avgSpeedKmh * 1000 / 60` (m/min), `G = inclinePercent / 100`.
- `avgSpeedKmh < 7` → caminar: `VO2 = 0.1*S + 1.8*S*G + 3.5`; si no → correr: `VO2 = 0.2*S + 0.9*S*G + 3.5`.
- `kcalGross = round(VO2 * weightKg / 1000 * 5 * durationMin)`;
  `kcalNet = round((VO2 - 3.5) * weightKg / 1000 * 5 * durationMin)` (redondeo half away from zero sobre el
  valor exacto: p. ej. 60 kg, 5 km/h, 8 %, 30 min da exactamente 214,5 → 215 / 183).
- Ejemplo: 70 kg, 4.8 km/h, 12 %, 30 min → 302 / 265.

## Resúmenes

### `GET /api/days/{date}` → 200

```json
{
  "date": "2026-10-14",
  "weight": Weight | null,
  "meals": [Meal],
  "steps": 8500 | null,
  "cardio": [Cardio],
  "totals": { "kcalIn": 1850, "proteinG": 120, "carbsG": 180, "fatG": 60, "kcalCardioGross": 302, "kcalCardioNet": 265 },
  "dailyKcalTarget": 2200 | null
}
```

`totals` siempre presente (0 si no hay registros; macros suman solo los no-null).

### `GET /api/stats?from&to` → 200 (rango ≤ 366 días)

```json
{
  "from": "2026-09-15", "to": "2026-10-14",
  "days": [
    { "date": "2026-09-15", "weightKg": 74.1, "weightTrendKg": 74.3, "kcalIn": 1900, "kcalCardioNet": 265, "steps": 9000 }
  ]
}
```

- Un elemento por día del rango (inclusive), en orden.
- `weightKg`: peso de ese día o null. `weightTrendKg`: media de los pesos registrados en `[date-6, date]`
  (incluye días anteriores a `from`), redondeada a 2 decimales; null si no hay ninguno.
- `kcalIn`: suma de comidas del día, **null si no hay comidas** (no registrado ≠ 0). `kcalCardioNet`: suma, 0 si no hay.
  `steps`: valor o null.

## Salud

- `GET /health` → 200 `Healthy` (texto) sin autenticación ni rate limit. Solo indica que la API está viva:
  **no** consulta la BD, para que nadie pueda mantener Neon despierto llamándolo. Como la API aplica las
  migraciones al arrancar, un 200 después de un despliegue también indica que la BD respondió al arrancar.
- `GET /health/db` → 200 `Healthy` | 503 `Unhealthy`: comprueba la conexión con la BD. Requiere token de un
  invitado (mismas reglas y rate limit que `/api/cardio/machines`).
