# Puesta en marcha: Firebase, Neon, Azure y GitHub

Guía paso a paso para dejar FinallyLoseWeight funcionando en producción **por primera vez**.
Calcula entre una y dos horas. Sigue el orden: cada paso usa valores del anterior.

| Pieza | Servicio | Plan | Para qué |
|---|---|---|---|
| Login | Firebase Authentication (proyecto **nuevo**) | Spark (gratis) | Email/contraseña y Google. Solo emite los tokens |
| Web (PWA) | Firebase Hosting | Spark (gratis) | Sirve la app en `https://<project-id>.web.app` |
| API | Azure App Service Linux | F1 (gratis) | .NET 10, West Europe |
| Base de datos | Neon (PostgreSQL) | Free | AWS Europe (Frankfurt) |
| CI/CD | GitHub Actions | Gratis | Tests en cada push y despliegue desde `main` |

> Los nombres de los menús de las consolas cambian con frecuencia. Si no encuentras una opción
> exactamente donde se indica, búscala por su nombre. En esta guía aparecen en español y entre
> paréntesis en inglés.

## Índice

0. [Antes de empezar](#0-antes-de-empezar)
1. [Firebase (autenticación y hosting)](#1-firebase-autenticación-y-hosting)
2. [Neon (PostgreSQL en la UE)](#2-neon-postgresql-en-la-ue)
3. [Azure App Service (la API)](#3-azure-app-service-la-api)
4. [GitHub: secretos y variables](#4-github-secretos-y-variables)
5. [Primer despliegue y prueba de humo](#5-primer-despliegue-y-prueba-de-humo)
6. [Invitar a tus amigos](#6-invitar-a-tus-amigos)
7. [Desarrollo local](#7-desarrollo-local)
8. [Costes aproximados y límites](#8-costes-aproximados-y-límites)
9. [Solución de problemas](#9-solución-de-problemas)
10. [RGPD: checklist del responsable](#10-rgpd-checklist-del-responsable)
11. [Anexo: rotar secretos y dominio propio](#11-anexo-rotar-secretos-y-dominio-propio)

---

## 0. Antes de empezar

**Cuentas**: Google (para Firebase), [Neon](https://console.neon.tech), Azure con una suscripción
activa (la cuenta gratuita sirve; el plan F1 cuesta 0 €) y acceso de administrador al repositorio
de GitHub.

**En tu ordenador** (solo para desarrollo local, §7): .NET SDK 10, Node.js 22, Git y PostgreSQL 16
(o Docker).

**Hoja de valores.** Apunta estos valores a medida que los obtengas, porque se usan en varios sitios.
Ninguno es secreto salvo los marcados con 🔒.

| Valor | Ejemplo | Lo obtienes en | Se usa en |
|---|---|---|---|
| `<project-id>` | `finallyloseweight-a1b2c` | §1.1 | `.firebaserc`, `FIREBASE_PROJECT_ID`, `VITE_FIREBASE_PROJECT_ID`, `Firebase__ProjectId`, `Cors__AllowedOrigins` |
| API key web | `AIzaSy...` | §1.2 | `VITE_FIREBASE_API_KEY` |
| App ID | `1:123456789:web:abc123` | §1.2 | `VITE_FIREBASE_APP_ID` |
| 🔒 Clave de la cuenta de servicio **Admin SDK** (JSON) | `{"type":"service_account",...}` | §1.7 | Azure: `Firebase__ServiceAccountJson` |
| 🔒 Clave de la cuenta de servicio de **despliegue** (JSON) | `{"type":"service_account",...}` | §1.8 | GitHub: `FIREBASE_SERVICE_ACCOUNT` |
| 🔒 Cadena de conexión de Neon (formato Npgsql) | `Host=ep-...;Database=neondb;...` | §2.3 | Azure: `ConnectionStrings__Default` |
| Nombre de la Web App | `flw-api` | §3.2 | `AZURE_WEBAPP_NAME` |
| URL de la API | `https://flw-api-abcd1234.westeurope-01.azurewebsites.net` | §3.2 | `VITE_API_BASE_URL` |
| 🔒 Perfil de publicación (XML) | `<publishData>...` | §3.7 | GitHub: `AZURE_WEBAPP_PUBLISH_PROFILE` |

> ⚠️ Hay **dos claves de cuenta de servicio distintas**. La del Admin SDK va **solo** a Azure (la API la
> usa para borrar usuarios). La de despliegue va **solo** a GitHub (sirve para publicar la web).
> Ninguna se sube nunca al repositorio. El `.gitignore` ya ignora `*-firebase-adminsdk-*.json` y
> `service-account*.json`, pero lo más seguro es guardarlas fuera de la carpeta del repo y borrarlas
> cuando hayas terminado.

---

## 1. Firebase (autenticación y hosting)

Consola: <https://console.firebase.google.com>. Es un **proyecto nuevo**: no reutilices el de FitFusion.

### 1.1 Crear el proyecto

1. Pulsa **Crear un proyecto** (Create a project).
2. Nombre: `FinallyLoseWeight`. Debajo se ve el **ID del proyecto** (`<project-id>`), por ejemplo
   `finallyloseweight-a1b2c`. Puedes editarlo ahora, pero **después no se puede cambiar**. Apúntalo:
   de él sale el dominio `https://<project-id>.web.app`.
3. Si te ofrece la asistencia de IA (Gemini en Firebase), puedes desactivarla: no hace falta.
4. **Google Analytics: desactívalo**. No hace falta y así no hay más datos personales de por medio.
5. Pulsa **Crear proyecto** y espera a que termine.
6. Pulsa ⚙️ › **Configuración del proyecto** (Project settings) › **General** y pon
   **Nombre público** (Public-facing name) = `FinallyLoseWeight`. Es lo que verá la gente en la
   pantalla de Google al iniciar sesión.

No hace falta activar la facturación: todo funciona en el plan **Spark** (gratis).

### 1.2 Registrar la app web

1. ⚙️ › **Configuración del proyecto** › **General** › sección **Tus apps** (Your apps) › icono
   **Web** (`</>`).
2. Apodo: `FinallyLoseWeight web`.
3. Marca **Configurar también Firebase Hosting para esta app** (Also set up Firebase Hosting).
   Así se crea el sitio `<project-id>.web.app`.
4. **Registrar app**. Verás un bloque `firebaseConfig`. Apunta:
   - `apiKey` → `VITE_FIREBASE_API_KEY`
   - `projectId` → `VITE_FIREBASE_PROJECT_ID`
   - `appId` → `VITE_FIREBASE_APP_ID`
   - `authDomain`: **no** uses el que aparece (`<project-id>.firebaseapp.com`). Mira el §1.5.
5. Ignora los pasos de «instalar el SDK» y «Firebase CLI»: el repo ya lo tiene todo.
   Pulsa **Ir a la consola** (Continue to console).
6. Comprueba en el menú lateral › **Hosting** que aparece el sitio con los dominios
   `<project-id>.web.app` y `<project-id>.firebaseapp.com`. Si Hosting te muestra **Comenzar**
   (Get started), pulsa y avanza con **Siguiente** hasta volver a la consola: no hace falta ejecutar
   nada en tu ordenador.

> La `apiKey` web **no es un secreto**: acaba en el JavaScript que descarga cualquier navegador. La
> seguridad la ponen las reglas de la API (token válido, email verificado e invitado). Si quieres,
> puedes restringirla (§1.11).

### 1.3 Activar los proveedores de inicio de sesión

Menú lateral › **Authentication** (si no lo ves, búscalo en **Todos los productos**) › **Comenzar**
(Get started) › pestaña **Método de inicio de sesión** (Sign-in method):

1. **Correo electrónico/contraseña** (Email/Password) → activa el **primer** interruptor
   (Correo electrónico/contraseña). Deja **desactivado** «Vínculo de correo electrónico (acceso sin
   contraseña)». **Guardar**.
2. **Añadir proveedor nuevo** › **Google** → **Habilitar**, elige el **correo de asistencia del
   proyecto** (tu email) y **Guardar**.

En **Authentication** › **Configuración** (Settings) › **Acciones del usuario** (User actions)
deja activado **Habilitar creación (registro)**: tus amigos se registran ellos mismos y la API solo
deja pasar a los emails invitados (§6).

### 1.4 Dominios autorizados

**Authentication** › **Configuración** (Settings) › **Dominios autorizados** (Authorized domains).
Deben aparecer:

- `localhost` (desarrollo local)
- `<project-id>.firebaseapp.com`
- `<project-id>.web.app`

Firebase los añade solos al crear el proyecto. Si falta alguno, **Añadir dominio**. Si un día usas
un dominio propio, añádelo también (§11).

### 1.5 `authDomain` = `<project-id>.web.app` (importante para iPhone)

En producción, `VITE_FIREBASE_AUTH_DOMAIN` debe ser **`<project-id>.web.app`**, el mismo dominio
desde el que se sirve la app, y **no** `<project-id>.firebaseapp.com`.

**Por qué.** Al entrar con Google, Firebase pasa por la página `/__/auth/handler` del `authDomain` y
usa un iframe oculto de ese dominio para recoger el resultado. Si el `authDomain` es distinto del
dominio de la app, para el navegador ese iframe es de *terceros*. Safari (y por tanto cualquier
navegador de iOS, además de la PWA instalada) bloquea el almacenamiento de terceros. El resultado es
que vuelves de Google y sigues sin sesión, o entras en un bucle de login. Firebase Hosting sirve
`/__/auth/*` en **todos** los dominios del sitio, así que con `authDomain = <project-id>.web.app`
todo queda en el mismo origen y funciona. Es la «opción 1» que recomienda Google en
*Best practices for using signInWithRedirect*.

Para que Google acepte ese dominio hay que autorizar su URL de vuelta:

1. Abre <https://console.cloud.google.com> y selecciona arriba el **mismo proyecto** (mismo ID).
2. Menú › **APIs y servicios** › **Credenciales** (APIs & Services › Credentials). En consolas
   recientes también está en **Google Auth Platform** › **Clientes** (Clients).
3. En **IDs de clientes de OAuth 2.0** abre **Web client (auto created by Google Service)**.
4. En **URIs de redireccionamiento autorizados** (Authorized redirect URIs) pulsa **Añadir URI** y
   pon exactamente:

   ```
   https://<project-id>.web.app/__/auth/handler
   ```

   Deja la que ya había (`https://<project-id>.firebaseapp.com/__/auth/handler`).
5. **Guardar**. El cambio puede tardar desde unos minutos hasta un par de horas en aplicarse.

Consecuencia práctica: comparte siempre el enlace `https://<project-id>.web.app`. La app también
responde en `firebaseapp.com`, pero ahí el login con Google puede fallar en Safari.

### 1.6 Plantillas de correo en español

**Authentication** › pestaña **Plantillas** (Templates):

1. Abajo, junto a **Idioma de la plantilla** (Template language), pulsa el lápiz ✏️ y elige
   **Español**. **Guardar**. Cambia el idioma de todos los correos (verificación, restablecer
   contraseña, cambio de email) y de la página que se abre al pulsar el enlace.
2. En **Verificación de la dirección de correo electrónico** (Email address verification) pulsa ✏️ y
   pon **Nombre del remitente** = `FinallyLoseWeight`. Repite en **Restablecimiento de contraseña**.

Los correos salen de `noreply@<project-id>.firebaseapp.com` y es habitual que caigan en **spam** la
primera vez. Avisa a tus amigos de que lo revisen.

### 1.7 Clave del Admin SDK para la API (va a Azure)

La API usa el Admin SDK **solo** para dos cosas: borrar el usuario de Firebase cuando alguien borra su
cuenta (`DELETE /api/me`) y, al darse de alta (`PUT /api/me`), comprobar que ese usuario sigue
existiendo (un token sigue valiendo hasta una hora después de borrar la cuenta). Fuera de
`Development`, la API **no arranca** si falta esta clave.

1. ⚙️ › **Configuración del proyecto** › pestaña **Cuentas de servicio** (Service accounts).
2. Con **Firebase Admin SDK** seleccionado, pulsa **Generar nueva clave privada** (Generate new
   private key) › **Generar clave**. Se descarga un `.json`.
3. Guárdalo **fuera del repo**. Lo pegarás en Azure como `Firebase__ServiceAccountJson` (§3.4). Para
   evitar problemas con los saltos de línea, pégalo en **una sola línea**. Puedes compactarlo con
   Node, que ya necesitas para la web:

   ```bash
   node -e "process.stdout.write(JSON.stringify(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))))" ~/Descargas/<project-id>-firebase-adminsdk-xxxxx.json
   ```

   No uses webs para «formatear JSON»: es una clave privada.
4. Cuando la hayas pegado en Azure, **borra el fichero**.

> **Opcional, más restrictivo.** La cuenta `firebase-adminsdk-…` tiene permisos amplios sobre el
> proyecto. Si prefieres el mínimo imprescindible, crea en Google Cloud (**IAM y administración** ›
> **Cuentas de servicio**) una cuenta `flw-api-auth` con **solo** el rol **Administrador de Firebase
> Authentication** (Firebase Authentication Admin), genera su clave JSON y usa esa en su lugar.

### 1.8 Cuenta de servicio de despliegue (secreto `FIREBASE_SERVICE_ACCOUNT` de GitHub)

El workflow `deploy-web.yml` publica la web con esta cuenta. Se crea a mano para que el secreto se
llame exactamente `FIREBASE_SERVICE_ACCOUNT` y tenga solo los permisos necesarios:

1. <https://console.cloud.google.com> (mismo proyecto) › **IAM y administración** › **Cuentas de
   servicio** (IAM & Admin › Service accounts) › **+ Crear cuenta de servicio**.
2. Nombre: `github-deploy-hosting`. Descripción: «Despliegue de Firebase Hosting desde GitHub
   Actions». **Crear y continuar**.
3. Roles (añade los dos):
   - **Administrador de Firebase Hosting** (Firebase Hosting Admin)
   - **Visualizador de claves de API** (API Keys Viewer). El CLI de Firebase lo necesita al desplegar.

   **Continuar** › **Listo**.
4. Abre la cuenta recién creada › pestaña **Claves** (Keys) › **Agregar clave** › **Crear clave
   nueva** › **JSON** › **Crear**. Se descarga el `.json`.
5. Copia **todo** su contenido en el secreto de GitHub `FIREBASE_SERVICE_ACCOUNT` (§4) y **borra el
   fichero**.

No hacen falta los roles «Firebase Authentication Admin» ni «Cloud Run Viewer» que menciona la
documentación de la action: sirven para canales de *preview* y para *rewrites* a Cloud Run, y aquí
no se usan.

> **Alternativa: `firebase init hosting:github`.** Hace lo mismo de forma automática, pero crea el
> secreto con **otro nombre** (`FIREBASE_SERVICE_ACCOUNT_<PROJECT_ID>`) y añade dos workflows propios
> (`firebase-hosting-merge.yml` y `firebase-hosting-pull-request.yml`) que duplicarían los despliegues.
> Si lo usas, borra esos dos ficheros y cambia el nombre del secreto en `deploy-web.yml`. El camino
> manual de arriba es más limpio.

> Si Google Cloud dice que la creación de claves está deshabilitada por una *política de
> organización* (`iam.disableServiceAccountKeyCreation`), es que el proyecto cuelga de una
> organización de Google Workspace. Con una cuenta personal de Gmail no pasa.

### 1.9 `.firebaserc`

En la raíz del repo, sustituye el marcador por tu ID:

```json
{ "projects": { "default": "<project-id>" } }
```

El despliegue desde GitHub no lo necesita (usa la variable `FIREBASE_PROJECT_ID`), pero así el CLI
de Firebase en tu ordenador apunta al proyecto correcto.

### 1.10 Cabeceras de Firebase Hosting (`firebase.json`) y por qué no hay una CSP estricta

`firebase.json` (en la raíz) publica `web/dist`, sirve `/index.html` en cualquier ruta que no sea un
fichero (es una SPA) y añade estas cabeceras:

| Ruta | Cabeceras | Motivo |
|---|---|---|
| Todo **salvo** `/__/*` | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (sin cámara, micro, geolocalización, pagos ni USB), `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'` | Endurecimiento básico y anti-*clickjacking* |
| `/`, rutas de la app, `/index.html`, `/sw.js`, `/registerSW.js`, `/manifest.webmanifest` | `Cache-Control: no-cache` | El navegador revalida en cada visita, así que un despliegue nuevo se nota enseguida |
| `/assets/**` | `Cache-Control: public, max-age=31536000, immutable` | Ficheros con *hash* en el nombre: se pueden cachear un año |

Detalles:

- **`/__/*` queda fuera a propósito.** Ahí Firebase sirve `/__/auth/handler` y `/__/auth/iframe`, que
  el SDK de Auth abre en un iframe. Si se les aplicara `X-Frame-Options: DENY` o un `frame-ancestors`,
  el login con Google dejaría de funcionar. Por eso las reglas usan una expresión regular
  (`^/([^_].*|_([^_].*)?|__([^/].*)?)?$`) que excluye **solo** las rutas que empiezan por `/__/`:
  cualquier otra (también `/_x` o `/__x`, que sirven la app por la regla `**` → `/index.html`) lleva
  las cabeceras anti-*clickjacking*. Está comprobado con el emulador de Hosting.
- **No se envía una `Content-Security-Policy` completa.** Firebase Auth y el login de Google cargan
  scripts e iframes de `apis.google.com`, `accounts.google.com` y `www.gstatic.com`, además de
  `/__/auth/`, y llaman a `identitytoolkit.googleapis.com`, `securetoken.googleapis.com` y a la API
  (cuyo dominio depende de Azure). Una CSP a la que le falte un origen **rompe el login sin dar
  pistas**, sobre todo en la PWA de iOS, donde no hay consola a mano. Solo se envía la directiva
  `frame-ancestors 'none'`. Si algún día quieres endurecerla, pruébala antes como
  `Content-Security-Policy-Report-Only` y revisa la consola en iPhone, Android y escritorio.
- **No añadas `Cross-Origin-Opener-Policy: same-origin`**: rompe `signInWithPopup`.
- **HSTS**: en `*.web.app` lo gestiona Firebase (y `.app` ya obliga a usar HTTPS).

### 1.11 (Opcional) Restringir la API key web

Google Cloud › **APIs y servicios** › **Credenciales** › **Claves de API** › la clave **Browser key
(auto created by Firebase)**:

- **Restricciones de aplicación**: *Sitios web*, con `https://<project-id>.web.app/*`,
  `https://<project-id>.firebaseapp.com/*` y `http://localhost:5173/*`.
- **Restricciones de API**: *Identity Toolkit API* y *Token Service API*.

Si después falla el login, quita las restricciones de API y prueba otra vez. Es una mejora menor
porque la clave es pública de todas formas.

---

## 2. Neon (PostgreSQL en la UE)

Consola: <https://console.neon.tech>.

### 2.1 Crear el proyecto

1. **New Project**.
2. **Project name**: `finallyloseweight`.
3. **Postgres version**: la que salga por defecto (16 o superior; los tests usan la 16).
4. **Cloud provider**: **AWS**. **Region**: **AWS Europe (Frankfurt)** (`aws-eu-central-1`). La
   región **no se puede cambiar después**.
5. **Create project**. Se crea con la rama `main`, la base de datos `neondb` y el rol
   `neondb_owner`. Sirven tal cual.

### 2.2 Ajustar el tamaño de cómputo

En el plan Free tienes **100 CU-hora al mes**, unas 400 horas encendida con 0,25 CU. La base de datos
se apaga sola a los 5 minutos sin uso y vuelve en cuanto llega una consulta. Para que el cupo cunda:

**Branches** › `main` › pestaña **Computes** › **Edit**: fija el tamaño en **0.25 CU** (mínimo y
máximo 0,25) y guarda. Para este uso sobra.

### 2.3 Cadena de conexión → formato Npgsql

1. En el panel del proyecto pulsa **Connect**.
2. Branch `main`, database `neondb`, role `neondb_owner`. **Desactiva «Connection pooling»**: la API
   aplica las migraciones al arrancar, y Neon recomienda conexión **directa** para migraciones. Con
   tan pocos usuarios, el pool propio de Npgsql es suficiente.
3. Copia la cadena (pulsa en mostrar la contraseña). Tiene este aspecto:

   ```
   postgresql://neondb_owner:npg_AbCdEf123456@ep-cool-name-a1b2c3d4.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

   Comprueba que el host **no** contiene `-pooler`.
4. Conviértela al formato de .NET (Npgsql):

   | Parte de la URL | Clave Npgsql | Ejemplo |
   |---|---|---|
   | entre `@` y `/` | `Host` | `ep-cool-name-a1b2c3d4.eu-central-1.aws.neon.tech` |
   | tras la última `/` (sin `?…`) | `Database` | `neondb` |
   | entre `//` y `:` | `Username` | `neondb_owner` |
   | entre `:` y `@` | `Password` | `npg_AbCdEf123456` |
   | `sslmode=require` | `SSL Mode` | **`VerifyFull`** (más estricto que `require`, ver abajo) |
   | `channel_binding=require` | `Channel Binding` | `Require` |

   Resultado (este es el valor de `ConnectionStrings__Default`):

   ```
   Host=ep-cool-name-a1b2c3d4.eu-central-1.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=npg_AbCdEf123456;SSL Mode=VerifyFull;Channel Binding=Require
   ```

   - Si la contraseña tuviera `;` o `=`, rodéala de comillas simples: `Password='...'`.
   - **Por qué `VerifyFull`**: la API manda datos de salud de Azure (West Europe) a Neon (Frankfurt)
     por Internet. En Npgsql, `SSL Mode=Require` cifra pero **acepta cualquier certificado**, así que
     no protege de un intermediario. `VerifyFull` comprueba que el certificado es válido y es del
     host de Neon (Neon usa certificados públicos, que ya están en el almacén del sistema de App
     Service). `Channel Binding=Require` ata además el login (SCRAM) a esa conexión TLS. Es lo que
     recomienda Neon y no cuesta nada.
   - Solo si la API no arranca con un error de certificado o de *SSL handshake* en el Log stream
     (§3.5), cambia temporalmente a `SSL Mode=Require` para comprobar si es eso, y vuelve a
     `VerifyFull` en cuanto lo resuelvas.
5. Guárdala como 🔒 secreto: contiene la contraseña.

No hace falta crear tablas: la API aplica las migraciones de EF Core al arrancar
(`Database__MigrateOnStartup`, `true` por defecto).

### 2.4 Contrato de encargo (DPA)

Neon actúa como **encargado del tratamiento** y guarda datos de salud (peso y comidas). Descarga y
guarda su **Data Processing Addendum (DPA)**, que encontrarás en la sección legal de su web y forma
parte de sus condiciones. Revisa también su lista de subencargados (AWS, entre otros). Los datos se
quedan en Frankfurt (UE). Más en §10.

---

## 3. Azure App Service (la API)

Portal: <https://portal.azure.com>. Si usas la cuenta gratuita de Azure, ten en cuenta que a los 30
días tendrás que pasarla a **pago por uso** (Pay-As-You-Go) para que no se deshabilite. Con F1 sigues
pagando 0 €. Te conviene crear una alerta de presupuesto (**Cost Management** › **Presupuestos**,
por ejemplo de 1 €) para enterarte si algo empieza a costar dinero.

### 3.1 Grupo de recursos

**Grupos de recursos** (Resource groups) › **+ Crear**: nombre `rg-finallyloseweight`, región
**West Europe**. **Revisar y crear** › **Crear**.

### 3.2 Web App y plan F1

**+ Crear un recurso** › **Aplicación web** (Web App) › **Crear**.

Pestaña **Datos básicos** (Basics):

| Campo | Valor |
|---|---|
| Suscripción / Grupo de recursos | la tuya / `rg-finallyloseweight` |
| Nombre | `flw-api` (o el que quieras). Será `AZURE_WEBAPP_NAME` |
| Nombre de host predeterminado único y seguro (Secure unique default hostname) | Déjalo **activado** (opción por defecto). El dominio será del estilo `flw-api-abcd1234.westeurope-01.azurewebsites.net` |
| Publicar | **Código** |
| Pila del entorno en tiempo de ejecución (Runtime stack) | **.NET 10 (LTS)** |
| Sistema operativo | **Linux** |
| Región | **West Europe** |
| Plan de Linux | **Crear nuevo**: `asp-finallyloseweight` |
| Plan de precios | **Free F1** (en *Explorar planes de precios* › *Dev/Test*) |

Pestaña **Implementación** (Deployment):

- **Implementación continua**: **Deshabilitar**. Ya hay workflows propios en el repo. Si la activas,
  Azure añade otro workflow al repositorio.
- **Autenticación básica** (Basic authentication): **Habilitar**. Es necesaria para descargar el
  perfil de publicación (§3.7).

Pestaña **Redes**: acceso público **activado**. Pestaña **Supervisión**: Application Insights **No**
(no hace falta y así hay un sitio menos con datos). **Revisar y crear** › **Crear**.

Cuando termine, abre el recurso › **Información general** (Overview) y copia el **Dominio
predeterminado** (Default domain). La **URL de la API** es `https://` + ese dominio, **sin barra
final y sin `/api`**. Ese es el valor de `VITE_API_BASE_URL`.

### 3.3 Configuración general

Web App › **Configuración** › **Configuración** (Settings › Configuration) › pestaña
**Configuración general** (General settings):

| Opción | Valor |
|---|---|
| Pila / versión | .NET 10 (ya debería estar) |
| **Solo HTTPS** (HTTPS Only) | **Activado** |
| Versión mínima de TLS de entrada | 1.2 |
| **Credenciales de publicación de autenticación básica de SCM** (SCM Basic Auth Publishing Credentials) | **Activado** (si no, no se puede desplegar con el perfil de publicación) |
| Credenciales de publicación de autenticación básica de FTP | **Desactivado** |
| Estado de FTP | Deshabilitado |
| Afinidad ARR | Desactivado (la API no usa sesión) |
| Always On | No disponible en F1 (§3.8) |

**Guardar** › **Continuar**.

> **CORS de App Service: no lo uses.** En **API** › **CORS** del portal **no** pongas ningún origen.
> La API gestiona CORS ella misma con `Cors__AllowedOrigins`, y si activas el CORS de la plataforma,
> este tiene prioridad y anula el de la API.

### 3.4 Variables de entorno (configuración de la API)

Web App › **Configuración** › **Variables de entorno** (Settings › Environment variables) › pestaña
**Configuración de la aplicación** (App settings) › **+ Agregar** para cada una. Deja sin marcar
*Configuración de ranura de implementación*. En Linux, los `:` de la configuración de .NET se
escriben como `__` (doble guion bajo).

| Nombre | Valor | Notas |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | |
| `ConnectionStrings__Default` | `Host=…;Port=5432;Database=neondb;Username=neondb_owner;Password=…;SSL Mode=VerifyFull;Channel Binding=Require` | 🔒 §2.3 |
| `Firebase__ProjectId` | `<project-id>` | Audiencia y emisor de los tokens |
| `Firebase__ServiceAccountJson` | contenido del JSON del Admin SDK **en una línea** | 🔒 §1.7. Es el contenido, no una ruta a un fichero |
| `Access__AllowedEmails` | `tu@gmail.com,amigo1@gmail.com` | Invitados, separados por comas (§6). No distingue mayúsculas |
| `Cors__AllowedOrigins` | `https://<project-id>.web.app,https://<project-id>.firebaseapp.com` | Sin barra final |
| `Privacy__CurrentVersion` | `1` | Versión vigente del aviso de privacidad. Debe coincidir con `PRIVACY_NOTICE_VERSION` de la web; súbelas juntas si cambias el aviso (§10) |

Opcionales (si no los pones, se usan estos valores por defecto):

| Nombre | Por defecto | Para qué |
|---|---|---|
| `Security__ReauthMaxAgeMinutes` | `5` | Antigüedad máxima del login para poder borrar la cuenta |
| `RateLimit__PermitsPerMinute` | `120` | Peticiones por minuto y usuario |
| `Database__MigrateOnStartup` | `true` | Aplica las migraciones al arrancar |

Al terminar pulsa **Aplicar** (Apply) abajo y **Confirmar**. La app se reinicia con cada cambio de
estas variables.

> ¿Prefieres la terminal? Con Azure CLI (o en **Cloud Shell**, el icono `>_` del portal):
>
> ```bash
> az webapp config appsettings set -g rg-finallyloseweight -n flw-api --settings \
>   ASPNETCORE_ENVIRONMENT=Production \
>   Firebase__ProjectId=<project-id> \
>   Access__AllowedEmails="tu@gmail.com" \
>   Cors__AllowedOrigins="https://<project-id>.web.app,https://<project-id>.firebaseapp.com" \
>   Privacy__CurrentVersion=1
> ```
>
> Los dos valores 🔒 (`ConnectionStrings__Default` y `Firebase__ServiceAccountJson`) es mejor pegarlos
> en el portal, para que no queden en el historial de la terminal.

### 3.5 Ver los logs

Web App › **Supervisión** › **Registros de App Service** (Monitoring › App Service logs) ›
**Registro de aplicaciones** (Application logging): **Sistema de archivos**, cuota 35 MB, retención
3 días › **Guardar**. Desde entonces, en **Supervisión** › **Secuencia de registro** (Log stream)
ves en directo lo que escribe la API. Si falta configuración, el error sale ahí al arrancar, por
ejemplo `Falta la cadena de conexión 'ConnectionStrings:Default'` o `Falta Firebase:ServiceAccountJson`.

### 3.6 Health check (`/health`): opcional, poco útil en F1

La API expone dos comprobaciones (docs/API.md, «Salud»):

- `GET /health`, sin autenticación ni límite de peticiones: solo dice que la API está viva. **No
  consulta la base de datos**, así que nadie (ni un bot, ni un monitor externo) puede mantener Neon
  despierto llamándolo. Como la API aplica las migraciones al arrancar, un 200 después de un
  despliegue también indica que la base de datos respondió al arrancar. Es lo que comprueba el
  workflow de despliegue.
- `GET /health/db`: comprueba la conexión con la base de datos. Pide el token de un invitado, como el
  resto de la API, así que no sirve para monitores externos.

App Service puede llamar a `/health` cada minuto: **Supervisión** › **Comprobación de estado**
(Monitoring › Health check) › **Habilitar**, ruta `/health` › **Guardar**.

> En F1 aporta poco: hay una sola instancia y App Service no la sustituye aunque esté «enferma», así
> que solo ganarías una métrica. No despierta a Neon, porque no toca la base de datos. Lo que **no**
> debes hacer es apuntar *pings* periódicos (para evitar el arranque en frío, por ejemplo) a
> `/health/db` o a cualquier ruta de `/api`: mantendrían la base de datos despierta las 24 horas, unas
> 180 CU-hora al mes frente a las 100 del plan gratuito, y cuando se agotan **Neon suspende la base
> de datos hasta el mes siguiente**.

### 3.7 Perfil de publicación (secreto `AZURE_WEBAPP_PUBLISH_PROFILE`)

1. Comprueba que **Credenciales de publicación de autenticación básica de SCM** está **Activado**
   (§3.3). Si no lo está, el botón aparece en gris.
2. Web App › **Información general** › **Descargar perfil de publicación** (Download publish profile).
   Puede estar dentro del menú **…**. Se descarga `flw-api.PublishSettings`.
3. Ábrelo con un editor de texto y copia **todo** su contenido (es XML) en el secreto de GitHub
   `AZURE_WEBAPP_PUBLISH_PROFILE` (§4). Después **borra el fichero**.

Si alguna vez pulsas **Restablecer perfil de publicación** (Reset publish profile), el anterior deja
de valer: descarga el nuevo y actualiza el secreto.

### 3.8 Límites de F1 y cómo pasar a B1

F1 es gratis, pero tiene límites:

- **Arranque en frío**: tras unos 20 minutos sin peticiones, la app se descarga. La primera petición
  siguiente tarda entre 10 y 30 segundos. Si Neon también estaba dormido, suma alrededor de un segundo.
- **60 minutos de CPU al día** (y 3 minutos por cada 5 minutos). Si se agotan, la app se para hasta
  el día siguiente. Con unos pocos usuarios no deberías acercarte.
- 1 GB de RAM, 1 GB de disco, **165 MB/día** de tráfico de salida, una sola instancia, sin *Always On*,
  sin *deployment slots* y sin certificado para dominio propio.

**Pasar a B1** (unos 12-13 €/mes en West Europe; consulta la calculadora de precios de Azure):

1. Abre el **plan** `asp-finallyloseweight` (no la Web App) › **Configuración** › **Escalar
   verticalmente (plan de App Service)** (Scale up).
2. Elige **Basic B1** › **Seleccionar** / **Aplicar**. La app se reinicia y no pierde la configuración.
3. Web App › **Configuración** › **Configuración general** › **Always On**: **Activado** › **Guardar**.
   Se acabaron los arranques en frío de la API.

Puedes volver a F1 de la misma forma (antes desactiva Always On).

---

## 4. GitHub: secretos y variables

Repositorio › **Settings** › **Secrets and variables** › **Actions**.

**Pestaña Secrets** › **New repository secret**:

| Nombre | Valor | De dónde sale |
|---|---|---|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Contenido completo del `.PublishSettings` (XML) | §3.7 |
| `FIREBASE_SERVICE_ACCOUNT` | Contenido completo del JSON de la cuenta **de despliegue** | §1.8 |

**Pestaña Variables** › **New repository variable**. No son secretos: los valores `VITE_*` acaban
dentro del JavaScript público de la web.

| Nombre | Ejemplo | Notas |
|---|---|---|
| `AZURE_WEBAPP_NAME` | `flw-api` | El **nombre** de la Web App, no su URL |
| `FIREBASE_PROJECT_ID` | `finallyloseweight-a1b2c` | Proyecto al que se despliega la web |
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` | §1.2 |
| `VITE_FIREBASE_AUTH_DOMAIN` | `finallyloseweight-a1b2c.web.app` | **`<project-id>.web.app`**, no `firebaseapp.com` (§1.5) |
| `VITE_FIREBASE_PROJECT_ID` | `finallyloseweight-a1b2c` | Igual que `FIREBASE_PROJECT_ID` |
| `VITE_FIREBASE_APP_ID` | `1:123456789:web:abc123` | §1.2 |
| `VITE_API_BASE_URL` | `https://flw-api-abcd1234.westeurope-01.azurewebsites.net` | `https://`, **sin barra final y sin `/api`** (§3.2) |

Nunca pongas en GitHub la clave del **Admin SDK** (`Firebase__ServiceAccountJson`) ni la cadena de
conexión: van solo en Azure.

**Recomendado:**

- **Settings** › **Environments**: el entorno `production` se crea solo en el primer despliegue.
  Ábrelo › **Deployment branches and tags** › **Selected branches and tags** › añade `main`. Así
  nada que no venga de `main` llega a producción.
- **Settings** › **Actions** › **General** › **Workflow permissions**: **Read repository contents and
  packages permissions**. Los workflows ya piden solo `contents: read`.
- **Settings** › **Advanced Security** (o *Code security*): activa **Dependabot alerts** y
  **Dependabot security updates**. Las actualizaciones semanales ya están en
  `.github/dependabot.yml`.

### Qué hace cada workflow

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `ci.yml` | Cada push (salvo ramas de Dependabot) y cada pull request | API: restore, build y tests contra PostgreSQL 16. Web: `npm ci`, typecheck, lint, tests y build |
| `deploy-api.yml` | Push a `main` que toque `api/**`, o a mano | Tests de la API → `dotnet publish` → despliegue en App Service → comprueba `/health` (hasta unos 5 min, por el arranque en frío) |
| `deploy-web.yml` | Push a `main` que toque `web/**`, `firebase.json` o `.firebaserc`, o a mano | Tests de la web → comprueba las variables → `npm run build` con las `VITE_*` → despliegue en Firebase Hosting (canal `live`) |

Si un test falla, no se despliega. Los despliegues manuales (**Actions** › el workflow ›
**Run workflow**) solo despliegan desde `main`.

---

## 5. Primer despliegue y prueba de humo

1. Con todo lo anterior configurado, haz *merge* a `main` (o push). Se lanzan **CI**, **Deploy API**
   y **Deploy web**. Si alguno ya había fallado porque faltaba configuración, relánzalo en
   **Actions** › el workflow › **Run workflow** (rama `main`). El paso **Check configuration** indica
   qué variable o secreto falta.
2. **API.** Cuando *Deploy API* esté en verde, abre `https://<tu-api>/health`: debe responder
   `Healthy`. La primera vez tarda más porque se crean las tablas. En Neon › **Tables** verás las de
   la app y `__EFMigrationsHistory`.

   En la **Secuencia de registro** (§3.5) de ese primer arranque verás una línea `fail:` que **es
   normal** y no indica ningún fallo:

   ```text
   fail: Microsoft.EntityFrameworkCore.Database.Command[20102]
         Failed executing DbCommand (…) SELECT migration_id, product_version FROM "__EFMigrationsHistory" …
   info: Microsoft.EntityFrameworkCore.Migrations[20402]
         Applying migration '20261014142959_InitialCreate'.
   ```

   EF Core comprueba si ya existe la tabla de migraciones intentando leerla. En una base de datos vacía
   todavía no existe, así que la consulta falla, EF la crea y aplica las migraciones. Lo que importa es
   la línea `Applying migration` y que `/health` responda. En los siguientes arranques ya no aparece.

   Desde la terminal:

   ```bash
   curl -i https://<tu-api>/health          # 200 Healthy
   curl -i https://<tu-api>/api/me          # 401 (falta el token): correcto
   # CORS: debe devolver Access-Control-Allow-Origin con tu dominio
   curl -i -X OPTIONS https://<tu-api>/api/me \
     -H "Origin: https://<project-id>.web.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: authorization"
   ```

3. **Web.** Cuando *Deploy web* esté en verde, abre `https://<project-id>.web.app`.
4. **Prueba de humo** (con tu email ya en `Access__AllowedEmails`):
   - [ ] Aparece la pantalla de inicio de sesión. Si sale «Falta configurar la app»,
         revisa las variables `VITE_*` (§4) y vuelve a lanzar *Deploy web*.
   - [ ] **Regístrate** con email y contraseña → llega el correo de verificación (revisa el spam) →
         pulsa el enlace → vuelve a la app.
   - [ ] **Alta**: alias y aceptación de la privacidad → pantalla **Hoy**.
   - [ ] Apunta peso, una comida, pasos y una sesión de cardio. Revisa **Historial** y **Progreso**.
   - [ ] Cierra sesión y entra **con Google**, en el ordenador y en el móvil.
   - [ ] En iPhone: Safari › Compartir › **Añadir a pantalla de inicio**. Abre la app instalada y
         entra con Google desde ella (no comparte la sesión con Safari).
   - [ ] Con un email **no invitado**, la app muestra «Solo por invitación» (403 `not_invited`).
   - [ ] **Perfil** › **Descargar mis datos** descarga un JSON.
   - [ ] Con una cuenta de prueba: **Perfil** › **Borrar mi cuenta**. Desaparece de Firebase ›
         Authentication › Usuarios y sus datos de la base de datos.
   - [ ] En las DevTools del navegador (Red › documento) la respuesta lleva `X-Frame-Options: DENY` y
         `Cache-Control: no-cache`.

---

## 6. Invitar a tus amigos

1. Portal de Azure › Web App › **Configuración** › **Variables de entorno** › `Access__AllowedEmails`
   › añade su email separado por coma (`tu@gmail.com,ana@gmail.com,luis@outlook.es`) › **Aplicar** ›
   **Confirmar**. La app se reinicia (unos segundos; en F1 la siguiente petición tarda algo más).
2. Mándales el enlace `https://<project-id>.web.app` y diles que:
   - se registren con **ese mismo email**, o que entren con Google si es su Gmail;
   - verifiquen el email (si no les llega, que miren el spam). Con Google ya está verificado;
   - en iPhone instalen la app desde **Safari** (Compartir › Añadir a pantalla de inicio) e inicien
     sesión **dentro** de la app instalada. En Android, menú › **Instalar app**.

**Quitar a alguien**: borra su email de la lista. Deja de poder usar la app (403 `not_invited`), pero
**sigue pudiendo exportar y borrar su cuenta**, como exige el RGPD. **No borres usuarios desde la
consola de Firebase**: sus datos quedarían huérfanos en la base de datos y ya no podrían entrar para
borrarlos. Pídeles que borren la cuenta desde **Perfil**.

---

## 7. Desarrollo local

Usa el **proyecto real de Firebase** para iniciar sesión (no hay emulador) y una base de datos local.

### 7.1 PostgreSQL

Con Docker:

```bash
docker run --name flw-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
# otro día: docker start flw-postgres   ·   pararlo: docker stop flw-postgres
```

Sin Docker, instala PostgreSQL 16 (Postgres.app en macOS, el instalador de EDB en Windows,
`apt install postgresql` en Linux) con usuario `postgres` y contraseña `postgres` en el puerto 5432,
o ajusta la cadena de conexión.

### 7.2 API

`appsettings.Development.json` ya apunta a `Host=localhost;Port=5432;Database=flw_dev;Username=postgres;Password=postgres`
y permite CORS desde `http://localhost:5173` (`npm run dev`) y `http://localhost:4173` (`npm run preview`).
Lo que es tuyo va en **user-secrets**, que se guardan
fuera del repo:

```bash
cd api/src/FinallyLoseWeight.Api
dotnet user-secrets init        # solo la primera vez; añade un UserSecretsId al .csproj (se puede commitear)
dotnet user-secrets set "Firebase:ProjectId" "<project-id>"
dotnet user-secrets set "Access:AllowedEmails" "tu@gmail.com"
# Opcional: solo si tu PostgreSQL o tus orígenes no coinciden con appsettings.Development.json
dotnet user-secrets set "ConnectionStrings:Default" "Host=localhost;Port=5432;Database=flw_dev;Username=postgres;Password=postgres"
dotnet user-secrets set "Cors:AllowedOrigins" "http://localhost:5173,http://localhost:4173"
cd -

dotnet run --project api/src/FinallyLoseWeight.Api     # http://localhost:5100
```

- La base de datos `flw_dev` y sus tablas se crean solas al arrancar (migraciones). En ese primer
  arranque el log muestra `fail: …Database.Command[20102] … FROM "__EFMigrationsHistory"`: es normal
  (§9, «Un `fail:` de `__EFMigrationsHistory`…»).
- En `Development` no hace falta `Firebase:ServiceAccountJson`. Sin ella, `DELETE /api/me` borra tus
  datos pero **no** el usuario de Firebase, y el alta (`PUT /api/me`) no comprueba que el usuario siga
  existiendo; ambas cosas se avisan en el log.
- `http://localhost:5100/openapi/v1.json` publica el documento OpenAPI (solo en Development).
- Nueva migración: `dotnet ef migrations add <Nombre> --project api/src/FinallyLoseWeight.Api`.

### 7.3 Web

```bash
cd web
cp .env.example .env.local      # .env.local no se sube al repo
```

Rellena `.env.local`:

```dotenv
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_API_BASE_URL=http://localhost:5100
```

En local vale cualquiera de los dos dominios como `VITE_FIREBASE_AUTH_DOMAIN`. En
`VITE_API_BASE_URL` pon el puerto que muestre `dotnet run`.

```bash
npm ci
npm run dev        # http://localhost:5173
```

En local, el login con Google usa una ventana emergente y funciona en Chrome, Edge y Firefox de
escritorio. `localhost` ya es un dominio autorizado (§1.4). Para probar la PWA compilada:
`npm run build && npm run preview` (`http://localhost:4173`, que ya está en `Cors:AllowedOrigins` de
`appsettings.Development.json`).

### 7.4 Tests (lo mismo que ejecuta la CI)

```bash
# API: necesita PostgreSQL. Cada test crea y borra su propia base de datos.
# Si tu servidor no es localhost/postgres/postgres:
#   export FLW_TEST_CONNECTION="Host=localhost;Port=5432;Username=postgres;Password=postgres"
dotnet test api/FinallyLoseWeight.slnx

# Web
cd web && npm run typecheck && npm run lint && npm test && npm run build
```

---

## 8. Costes aproximados y límites

| Servicio | Plan | Coste/mes | Límites relevantes |
|---|---|---|---|
| Azure App Service | F1 | **0 €** | Arranque en frío, 60 min de CPU/día, 165 MB/día de salida, 1 GB de RAM (§3.8) |
| Neon | Free | **0 €** | 100 CU-hora/mes (unas 400 h a 0,25 CU), 1 GB de datos, 5 GB/mes de salida, historial de restauración de 6 h. Si se agota el cómputo, la BD se suspende hasta el mes siguiente |
| Firebase | Spark | **0 €** | Hosting: 10 GB de almacenamiento y 360 MB/día de transferencia. Auth con email y Google sin coste para este uso |
| GitHub Actions | Free | **0 €** | Ilimitado en repos públicos; 2.000 min/mes en privados (cada CI tarda unos pocos minutos) |
| **Total** | | **0 €** | |

Cuánto costaría crecer:

- **Azure B1** (sin arranque en frío, Always On): unos 12-13 €/mes.
- **Neon Launch**: pago por uso sin mínimo mensual (alrededor de 0,11 $ por CU-hora); para este uso,
  pocos euros al mes.
- **Firebase Blaze**: solo si superas los límites de Spark, cosa improbable con unos pocos usuarios.

Consulta siempre los precios actuales en la web de cada proveedor.

---

## 9. Solución de problemas

**Error de CORS en la consola del navegador** («blocked by CORS policy»)

- Comprueba antes que la API está viva (`/health`). Si la API falla al arrancar o devuelve un 500, el
  navegador **también** lo muestra como error de CORS.
- `Cors__AllowedOrigins` debe contener el origen exacto desde el que abres la app:
  `https://<project-id>.web.app` (`https`, sin barra final, separados por comas).
- El CORS de App Service (portal › **API** › **CORS**) debe estar **vacío** (§3.3).
- En local: `http://localhost:5173` (y `http://localhost:4173` para `npm run preview`) deben estar en
  `Cors:AllowedOrigins` (ya lo están en `appsettings.Development.json`).

**403 `not_invited`**: el email de la cuenta de Firebase no está en `Access__AllowedEmails`. Si entra
con Google, es su Gmail. Añádelo (§6) y espera unos segundos a que se reinicie la app.

**403 `email_not_verified`**: falta pulsar el enlace del correo de verificación (revisa el spam).
Después, la app debe refrescar el token: pulsa «Ya lo he verificado» o cierra sesión y
vuelve a entrar. Con Google el email ya viene verificado.

**403 `profile_required`**: el usuario no ha terminado el alta (alias y consentimiento), o borró su
perfil desde otro dispositivo. La app vuelve a consultar el perfil (`GET /api/me`) y le lleva a la
pantalla de alta.

**401 `reauth_required` al borrar la cuenta**: por seguridad, el borrado exige haber iniciado sesión
hace menos de 5 minutos. La app vuelve a pedir la contraseña o el login de Google.

**El login con Google no funciona en iPhone (sobre todo en la PWA instalada)**

- `VITE_FIREBASE_AUTH_DOMAIN` debe ser `<project-id>.web.app` (§1.5). Después de cambiar la variable,
  vuelve a lanzar *Deploy web*.
- La URI `https://<project-id>.web.app/__/auth/handler` debe estar en el cliente OAuth. El error
  `redirect_uri_mismatch` significa justo que falta.
- `auth/unauthorized-domain`: añade el dominio en Authentication › Configuración › Dominios
  autorizados.
- Abre la app desde `web.app`, no desde `firebaseapp.com`.
- La PWA instalada en iOS no comparte la sesión con Safari: hay que iniciar sesión dentro de la app.
- Si aun así falla, entra con email y contraseña: funciona siempre.

**La primera petición tarda mucho (F1)**: es el arranque en frío de App Service (10-30 s tras unos
20 min sin uso), a veces sumado al de Neon (alrededor de un segundo). Es normal en F1. La solución es
B1 con Always On (§3.8), **no** un *ping* externo (§3.6).

**`403 - This web app is stopped` / «Site Disabled»**: has agotado la cuota diaria de F1 (60 min de
CPU). Se restablece al día siguiente. Si pasa a menudo, sube a B1.

**Un `fail:` de `__EFMigrationsHistory` en el log del primer arranque**
(`Failed executing DbCommand … SELECT migration_id, product_version FROM "__EFMigrationsHistory"`): es
normal con una base de datos vacía. EF Core intenta leer su tabla de migraciones para saber si existe y,
como aún no existe, esa consulta falla. Justo después la crea y aplica las migraciones
(`Applying migration '…_InitialCreate'`). Si después la API responde en `/health`, no hay que hacer nada.
Solo es un problema si el log sigue con una excepción y la API no arranca (siguiente apartado).

**La API no arranca después de desplegar** (503, `/health` no responde y *Deploy API* falla en
*Smoke test*): mira **Secuencia de registro** (§3.5). Causas típicas:
`Falta la cadena de conexión 'ConnectionStrings:Default'`, `Falta Firebase:ServiceAccountJson`, un
JSON de la cuenta de servicio mal pegado (pégalo compactado en una línea, §1.7) o una contraseña de
Neon mal copiada. Si App Service no encontrara el punto de entrada, pon en **Configuración general** ›
**Comando de inicio** `dotnet FinallyLoseWeight.Api.dll`.

**`database is locked`**: era un problema de SQLite. Aquí la base de datos es PostgreSQL y **no
aplica**. Si ves errores de base de datos, es por otra cosa (conexión, credenciales, cupo de Neon).

**Neon tarda o da errores de conexión**

- La base de datos se duerme a los 5 minutos sin uso y la primera consulta la despierta
  (normalmente menos de un segundo). La API reintenta automáticamente los fallos transitorios.
- Si da *timeout* a menudo, añade `;Timeout=30` a la cadena de conexión.
- Si **todas** las peticiones fallan: en Neon › **Billing/Usage**, mira si has agotado las CU-hora
  del mes (la BD queda suspendida hasta el mes siguiente). ¿Activaste el Health check (§3.6) o algún
  *ping* externo?

**Fallos en GitHub Actions**

- *Check configuration* en rojo: falta la variable o el secreto que dice el mensaje (§4).
- `azure/webapps-deploy` devuelve 401 o *Unauthorized*: la autenticación básica de SCM está
  desactivada o se restableció el perfil de publicación. Actívala (§3.3), descarga el perfil y
  actualiza el secreto.
- Firebase devuelve 403 o *permission denied*: a la cuenta de despliegue le falta algún rol (§1.8),
  o `FIREBASE_PROJECT_ID` no es el proyecto correcto.

**No veo la nueva versión de la web**: la PWA guarda la app en caché y muestra un aviso de «nueva
versión disponible». Púlsalo, o cierra la app del todo y vuelve a abrirla. `index.html` y `sw.js` se
sirven con `no-cache`, así que el aviso llega en la siguiente visita.

---

## 10. RGPD: checklist del responsable

> Esto **no es asesoramiento legal**. Es una lista práctica para un proyecto pequeño entre amigos con
> datos de salud. Si tienes dudas, consulta a un profesional o la web de la AEPD.

Tú eres el **responsable del tratamiento**: decides para qué y cómo se tratan los datos. Peso y
comidas son **datos de salud** (art. 9 RGPD). No te apoyes en la «excepción doméstica» aunque sea
entre amigos.

- [ ] **Aviso de privacidad** en la app (pantalla de privacidad) con: quién eres y cómo contactarte;
      qué datos se tratan (email en Firebase; alias, peso, comidas, pasos y cardio en la BD); para qué
      (llevar tu diario); base legal (**consentimiento explícito**, art. 9.2.a, que se recoge en el
      alta); encargados (Google/Firebase, Microsoft/Azure, Neon/AWS); dónde están los datos; cuánto
      tiempo (hasta que borres la cuenta); derechos (acceso, rectificación, supresión, portabilidad,
      retirar el consentimiento) y que se puede reclamar ante la **AEPD**.
- [ ] **Versión del aviso**: si cambias el texto del aviso (`web/src/screens/info/PrivacyContent.tsx`),
      sube ahí `PRIVACY_NOTICE_VERSION` (p. ej. a `2`) y pon el mismo valor en `Privacy__CurrentVersion`
      (§3.4). La próxima vez que entren, la app pide a quien aceptó una versión anterior que acepte la
      nueva (o, si no quiere, que descargue sus datos y borre la cuenta). Queda registrado `consentAt` y
      `privacyVersion`.
- [ ] **Contratos con los encargados (DPA)**: guarda el de **Neon** (§2.4); el de **Microsoft**
      (*Products and Services DPA*) se aplica a Azure automáticamente; en Firebase revisa y acepta
      los **Data Processing and Security Terms** (Configuración del proyecto › General / Privacidad,
      según la consola).
- [ ] **Datos en la UE**: Neon en Frankfurt y App Service en West Europe. Firebase Authentication
      guarda el email en la infraestructura global de Google, que cubre la transferencia con sus
      cláusulas contractuales tipo y el Marco de Privacidad de Datos UE-EE. UU. Menciónalo en el aviso.
- [ ] **Derechos ya implementados**: exportar (`GET /api/me/export`, **Perfil** › Descargar mis
      datos) y borrar (`DELETE /api/me`, **Perfil** › Borrar mi cuenta). Ambos funcionan aunque
      retires la invitación o el email no esté verificado. Pruébalos (§5).
- [ ] **Minimización**: la BD no guarda el email ni el nombre real (solo un alias), y los logs no
      incluyen el cuerpo de las peticiones. No actives herramientas que registren peticiones completas
      (Application Insights con *payloads*, logs de depuración en producción).
- [ ] **Registro de actividades de tratamiento** (art. 30): como se tratan datos de salud, conviene
      tener uno sencillo (finalidad, categorías de datos, encargados, plazos y medidas de seguridad).
      Este documento y `docs/PLAN.md` te sirven de base.
- [ ] **Seguridad**: secretos solo en Azure y GitHub (nunca en el repo), HTTPS obligatorio, acceso
      solo por invitación y cada usuario ve solo lo suyo (la API lo comprueba en cada consulta). Rota
      las claves si sospechas que se han filtrado (§11).
- [ ] **Copias de seguridad**: Neon Free solo guarda 6 h de historial. Si haces copias propias
      (`pg_dump` con la conexión directa), guárdalas cifradas, en la UE, con un plazo de borrado, y
      tenlo en cuenta cuando alguien borre su cuenta.
- [ ] **Brechas de seguridad**: si hay una brecha que afecte a datos personales, notifícala a la AEPD
      en 72 h (art. 33) y, si el riesgo es alto, a los afectados (art. 34).
- [ ] **Bajas**: cuando alguien deje de usar la app, pídele que borre su cuenta desde **Perfil** y
      después quita su email de la lista (§6).

---

## 11. Anexo: rotar secretos y dominio propio

**Rotar secretos** (si se filtran o, como buena práctica, cada cierto tiempo):

| Secreto | Cómo |
|---|---|
| Clave del Admin SDK | Firebase › Cuentas de servicio › **Generar nueva clave privada** → actualiza `Firebase__ServiceAccountJson` en Azure → Google Cloud › IAM › Cuentas de servicio › `firebase-adminsdk-…` › **Claves** › borra la antigua |
| Clave de despliegue | Google Cloud › Cuentas de servicio › `github-deploy-hosting` › **Claves** › crea una nueva → actualiza `FIREBASE_SERVICE_ACCOUNT` en GitHub → borra la antigua |
| Perfil de publicación | Web App › Información general › **Restablecer perfil de publicación** → descárgalo → actualiza `AZURE_WEBAPP_PUBLISH_PROFILE` |
| Contraseña de Neon | Neon › **Roles** › `neondb_owner` › **Reset password** → actualiza `ConnectionStrings__Default` en Azure |

**Dominio propio** (opcional, por ejemplo `app.midominio.es`):

1. Firebase › **Hosting** › **Añadir dominio personalizado** y sigue los pasos de DNS.
2. Añádelo en Authentication › **Dominios autorizados** (§1.4).
3. Añade `https://app.midominio.es/__/auth/handler` al cliente OAuth (§1.5).
4. Cambia `VITE_FIREBASE_AUTH_DOMAIN` a `app.midominio.es` y vuelve a desplegar la web.
5. Añade `https://app.midominio.es` a `Cors__AllowedOrigins` en Azure.
