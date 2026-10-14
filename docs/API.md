# API contract (v1)

Fuente de verdad compartida por `api/` y `web/`. Si cambias algo aquí, cambia ambos lados.

## Convenciones

- Base: `{API_BASE_URL}/api/...` (p. ej. `https://flw-api.azurewebsites.net/api/me`). `GET /health` va sin `/api`.
- JSON en **camelCase**. Fechas del diario: `"YYYY-MM-DD"` (día local del usuario, lo decide el cliente).
  Instantes: ISO 8601 UTC (`"2026-10-14T08:30:00Z"`). Decimales como números JSON (`72.5`).
- Enums como strings camelCase: `mealType` ∈ `"breakfast" | "lunch" | "dinner" | "snack"`.
- IDs: UUID (v7) como string.
- Todas las rutas `/api/**` requieren `Authorization: Bearer <Firebase ID token>`.
- Errores: `application/problem+json` (RFC 9457). Los errores de dominio llevan una extensión `code`:

| Status | `code` | Cuándo |
|---|---|---|
| 400 | — (ValidationProblem con `errors: { campo: [mensajes] }`, claves camelCase) | Validación |
| 401 | — | Token ausente/ inválido/ caducado |
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
  "createdAt": "2026-10-14T08:30:00Z",
  "updatedAt": "2026-10-14T08:30:00Z"
}
```

### `PUT /api/me` → 201 `Profile` (creado) | 200 `Profile` (actualizado)

```json
{ "displayName": "Adnan", "heightCm": 178, "targetWeightKg": 75.0, "dailyKcalTarget": 2200, "acceptPrivacy": true }
```

- `displayName` 1–40 chars (trim) obligatorio. `heightCm` 100–250, `targetWeightKg` 30–300, `dailyKcalTarget` 800–6000: opcionales/null.
- Al **crear**, `acceptPrivacy` debe ser `true` (si no → 400 en `acceptPrivacy`). El servidor guarda
  `consentAt = now` y `privacyVersion = Privacy:CurrentVersion`.
- Al actualizar, `acceptPrivacy: true` vuelve a sellar consentimiento (útil si cambia la versión); omitido no toca nada.

### `GET /api/me/export` → 200 (descarga)

`Content-Disposition: attachment; filename="finallyloseweight-export-YYYY-MM-DD.json"`

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

- `GET /api/steps?from&to` → 200 `[Steps]`.
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

- `GET /api/cardio?from&to` → 200 `[Cardio]`.
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
  `kcalNet = round((VO2 - 3.5) * weightKg / 1000 * 5 * durationMin)` (redondeo half away from zero).
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

`GET /health` → 200 sin autenticación (incluye comprobación de la BD).
