/** Utilitaires d'authentification sans dépendance serveur (testables). */

/** N'accepte qu'un chemin interne, pour éviter les redirections ouvertes. */
export function suiteSure(valeur: unknown, defaut = '/'): string {
  if (typeof valeur !== 'string' || valeur.length === 0 || valeur.length > 512) return defaut
  if (!valeur.startsWith('/') || valeur.startsWith('//') || valeur.includes('\\')) return defaut
  if (/[\u0000-\u001f]/.test(valeur)) return defaut
  return valeur
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  email_not_confirmed: 'Confirmez d’abord votre adresse email grâce au lien reçu.',
  user_already_exists: 'Un compte existe déjà avec cet email. Connectez-vous ou utilisez un lien de connexion.',
  email_exists: 'Un compte existe déjà avec cet email. Connectez-vous ou utilisez un lien de connexion.',
  weak_password: 'Mot de passe trop faible : 10 caractères minimum, avec lettres et chiffres.',
  over_email_send_rate_limit: 'Trop d’emails envoyés. Réessayez dans quelques minutes.',
  over_request_rate_limit: 'Trop de tentatives. Réessayez dans quelques minutes.',
  otp_expired: 'Ce lien a expiré. Demandez-en un nouveau.',
  same_password: 'Le nouveau mot de passe doit être différent de l’ancien.',
  signup_disabled: 'Les inscriptions sont temporairement fermées.',
  validation_failed: 'Les informations saisies ne sont pas valides.',
}

export function traduireErreurAuth(code: string | undefined): string {
  return (code && MESSAGES[code]) ?? 'Une erreur est survenue. Réessayez dans un instant.'
}

export function emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254
}

/** Règle de mot de passe affichée et vérifiée avant l'appel à Supabase. */
export function motDePasseValide(mdp: string): boolean {
  return mdp.length >= 10 && mdp.length <= 72 && /[A-Za-z]/.test(mdp) && /\d/.test(mdp)
}
