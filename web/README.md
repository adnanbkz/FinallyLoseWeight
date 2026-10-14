# FinallyLoseWeight · web (PWA)

React 19 + Vite 8 + TypeScript + Tailwind CSS 4 + TanStack Query 5 + React Router 8 + Recharts 3,
con `vite-plugin-pwa` (Workbox). Firebase se usa **solo para iniciar sesión** (`@firebase/app` +
`@firebase/auth`); todos los datos van a la API (`docs/API.md`).

## Comandos

```bash
npm ci            # instala exactamente lo del package-lock.json
npm run dev       # servidor de desarrollo (http://localhost:5173)
npm run typecheck # TypeScript estricto
npm run lint      # ESLint (flat config, typescript-eslint, react-hooks)
npm test          # Vitest (una pasada, sin modo watch)
npm run build     # tsc -b && vite build → web/dist
npm run preview   # sirve web/dist en http://localhost:4173
npm run icons     # regenera los PNG de public/ desde scripts/icons/*.svg
```

## Configuración

Copia `.env.example` a `.env.local` y rellena las variables `VITE_*` (son públicas: acaban en el
JavaScript del navegador). Sin ellas la web compila igualmente y, al abrirla, muestra una pantalla
de «Falta configurar la app» en lugar de fallar.

- `VITE_FIREBASE_AUTH_DOMAIN`: en producción usa **el mismo dominio donde se sirve la app**
  (p. ej. `tu-proyecto.web.app`). Así el login con Google por redirección funciona en Safari/iOS y
  en la PWA instalada. Ese dominio debe estar en *Authentication → Settings → Authorized domains*.
- `VITE_API_BASE_URL`: origen de la API sin `/api` ni barra final. La API debe permitir ese origen
  en `Cors:AllowedOrigins`.

## Notas de la PWA

- El service worker solo precachea la app (HTML, JS, CSS, iconos). **Nunca** guarda respuestas de
  la API (datos de salud) y las peticiones a la API usan `cache: 'no-store'`.
- `/__/*` (manejador de Firebase Auth en Firebase Hosting) queda fuera del *fallback* de navegación.
- Cuando hay una versión nueva aparece el aviso «Nueva versión disponible» → «Actualizar».
- En iPhone no hay botón de instalar: la pantalla «Cómo instalar» explica Compartir → Añadir a
  pantalla de inicio. En Android se usa `beforeinstallprompt` cuando el navegador lo ofrece.

## Estructura

```
src/
  api/        tipos del contrato, cliente fetch (token + reintento 401), errores, hooks de TanStack Query
  auth/       Firebase Auth (persistencia IndexedDB), proveedor de sesión, acciones y mensajes de error
  components/ UI reutilizable (botones, campos, hojas modales, toasts) y layout (cabecera, pestañas)
  lib/        fechas locales (nunca toISOString para «hoy»), números con coma decimal, plataforma
  pwa/        aviso de actualización y prompt de instalación
  screens/    login, verificación, invitación, alta, Hoy, Historial, Progreso, Perfil, Privacidad, Instalar
```
