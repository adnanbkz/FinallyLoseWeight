/**
 * Version of the notice below. When you change its text, raise it here AND set the same value in the API
 * setting `Privacy:CurrentVersion` (docs/SETUP.md): users who accepted an older version are then asked to
 * accept the new one before they can keep using the app.
 */
export const PRIVACY_NOTICE_VERSION = '1'

/** Plain-language privacy notice (Spanish). Shared by /privacidad, the onboarding and the re-consent screen. */
export function PrivacySummary() {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
      <li>
        Guardamos lo que tú apuntas: <strong>peso, comidas, pasos y sesiones de cardio</strong>, además de tu alias y tus
        objetivos.
      </li>
      <li>Solo se usa para mostrarte tu diario y tus gráficas. Nadie más puede ver tus datos.</li>
      <li>Los datos se guardan en servidores de la Unión Europea.</li>
      <li>Puedes descargar todos tus datos o borrar tu cuenta cuando quieras desde Perfil.</li>
    </ul>
  )
}

export function PrivacyContent() {
  return (
    <div className="flex flex-col gap-5 text-slate-700 dark:text-slate-300 [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-slate-50 [&_p]:leading-relaxed">
      <p>
        FinallyLoseWeight es un diario personal para un grupo pequeño de personas invitadas. Este aviso explica, sin letra
        pequeña, qué datos guardamos y qué puedes hacer con ellos.
      </p>
      <section>
        <h2>Qué guardamos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tu alias, altura, peso objetivo y objetivo diario de calorías.</li>
          <li>Tus registros: peso diario, comidas (descripción, calorías y macros), pasos y sesiones de cardio.</li>
          <li>La fecha en la que diste tu consentimiento y la versión de este aviso que aceptaste.</li>
        </ul>
        <p className="mt-2">
          Tu email y tu contraseña los gestiona Firebase Authentication (Google) para que puedas iniciar sesión. Nuestra base
          de datos no guarda tu email ni tu nombre real.
        </p>
      </section>
      <section>
        <h2>Para qué</h2>
        <p>
          Solo para mostrarte tu diario, tus totales y tus gráficas. No hay publicidad, no se venden datos y no se comparten con
          nadie. Cada persona ve únicamente sus propios datos.
        </p>
      </section>
      <section>
        <h2>Datos de salud y consentimiento</h2>
        <p>
          El peso y la alimentación son datos de salud, una categoría especial según el RGPD. Por eso solo los tratamos con tu
          consentimiento explícito, que das al crear tu perfil. Puedes retirarlo en cualquier momento borrando tu cuenta.
        </p>
      </section>
      <section>
        <h2>Dónde se guardan</h2>
        <p>
          La API y la base de datos están alojadas en la Unión Europea. El inicio de sesión lo presta Google (Firebase) con sus
          garantías contractuales. La app no guarda tus datos de salud en la caché del móvil.
        </p>
      </section>
      <section>
        <h2>Tus derechos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Descargar tus datos</strong> en un fichero JSON (Perfil → Descargar mis datos).
          </li>
          <li>
            <strong>Borrar tu cuenta</strong> y todos tus datos de forma definitiva (Perfil → Borrar mi cuenta).
          </li>
          <li>Corregir cualquier registro desde la propia app.</li>
        </ul>
      </section>
      <section>
        <h2>Contacto</h2>
        <p>
          El responsable es la persona que administra la app y que te invitó. Escríbele para cualquier duda o para ejercer tus
          derechos.
        </p>
      </section>
    </div>
  )
}
