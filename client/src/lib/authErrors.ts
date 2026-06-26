import type { Translator } from '../i18n/useT'

/** Maps a Firebase auth error code to a translation key with a friendly message. */
const CODE_TO_KEY: Record<string, string> = {
  'auth/email-already-in-use': 'auth.emailInUse',
  'auth/invalid-credential': 'auth.invalidCredentials',
  'auth/wrong-password': 'auth.invalidCredentials',
  'auth/user-not-found': 'auth.invalidCredentials',
  'auth/invalid-email': 'auth.invalidEmail',
  'auth/weak-password': 'auth.weakPassword',
  'auth/user-disabled': 'auth.userDisabled',
  'auth/too-many-requests': 'auth.tooManyRequests',
  'auth/network-request-failed': 'auth.networkError',
  'auth/popup-blocked': 'auth.popupBlocked',
  'auth/account-exists-with-different-credential': 'auth.accountExists',
}

/**
 * Codes that mean the user simply dismissed the sign-in popup themselves.
 * These are not errors and should never surface a message to the user.
 */
const CANCELLED_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
])

function codeOf(err: unknown): string {
  return (err as { code?: string }).code ?? ''
}

/** True when the user voluntarily closed/cancelled the auth popup. */
export function isCancelledByUser(err: unknown): boolean {
  return CANCELLED_CODES.has(codeOf(err))
}

/**
 * Resolves a Firebase auth error into a translated, user-facing message.
 * Returns `null` for user-cancelled popups (nothing should be shown).
 */
export function getAuthErrorMessage(err: unknown, t: Translator): string | null {
  if (isCancelledByUser(err)) return null
  const key = CODE_TO_KEY[codeOf(err)]
  return t((key ?? 'auth.genericError') as Parameters<Translator>[0])
}
