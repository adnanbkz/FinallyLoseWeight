/** Firebase Auth error code (e.g. "auth/invalid-credential") or null. */
export function authErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code
  return null
}

/** Errors that mean "the user closed/cancelled the dialog": show nothing. */
export function isAuthCancellation(error: unknown): boolean {
  const code = authErrorCode(error)
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled'
}

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/invalid-login-credentials': 'Email o contraseña incorrectos.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/user-not-found': 'No hay ninguna cuenta con ese email.',
  'auth/invalid-email': 'El email no es válido.',
  'auth/missing-email': 'Escribe tu email.',
  'auth/missing-password': 'Escribe tu contraseña.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese email. Prueba a iniciar sesión.',
  'auth/weak-password': 'La contraseña es demasiado débil: usa al menos 8 caracteres.',
  'auth/password-does-not-meet-requirements': 'La contraseña no cumple los requisitos de seguridad.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  'auth/network-request-failed': 'No hay conexión. Revisa tu red e inténtalo de nuevo.',
  'auth/user-disabled': 'Esta cuenta está desactivada.',
  'auth/requires-recent-login': 'Por seguridad, vuelve a identificarte.',
  'auth/user-mismatch': 'Has elegido una cuenta distinta a la que tiene la sesión iniciada.',
  'auth/user-token-expired': 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  'auth/account-exists-with-different-credential':
    'Ya existe una cuenta con ese email usando otro método de acceso. Entra con email y contraseña.',
  'auth/credential-already-in-use': 'Esa cuenta ya está vinculada a otro usuario.',
  'auth/popup-blocked': 'El navegador ha bloqueado la ventana emergente. Permite las ventanas emergentes e inténtalo de nuevo.',
  'auth/operation-not-allowed': 'Este método de acceso no está activado. Avisa al administrador de la app.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado para iniciar sesión. Avisa al administrador de la app.',
  'auth/unauthorized-continue-uri': 'Este dominio no está autorizado. Avisa al administrador de la app.',
  'auth/web-storage-unsupported':
    'Tu navegador bloquea el almacenamiento necesario para iniciar sesión. Desactiva el modo privado o el bloqueo de cookies.',
  'auth/expired-action-code': 'El enlace ha caducado. Pide uno nuevo.',
  'auth/invalid-action-code': 'El enlace no es válido o ya se ha usado.',
  'auth/quota-exceeded': 'Se ha alcanzado el límite de envíos. Inténtalo más tarde.',
  'auth/internal-error': 'Ha ocurrido un error inesperado. Inténtalo de nuevo.',
}

/** Friendly Spanish message for a Firebase Auth error. */
export function authErrorMessage(error: unknown): string {
  const code = authErrorCode(error)
  if (code && MESSAGES[code]) return MESSAGES[code]
  return 'No se ha podido completar la operación. Inténtalo de nuevo.'
}
