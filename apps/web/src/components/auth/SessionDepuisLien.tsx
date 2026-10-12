'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { suiteSure } from '@/lib/auth'
import { creerClientNavigateur } from '@/lib/supabase/navigateur'

const abonner = (rappel: () => void) => {
  window.addEventListener('hashchange', rappel)
  return () => window.removeEventListener('hashchange', rappel)
}
const jetonDansLien = () => window.location.hash.includes('access_token=')

/**
 * Certains liens email de Supabase (email de confirmation renvoyé, modèles par défaut) ouvrent
 * la session dans le fragment de l'adresse (#access_token=…), invisible pour le serveur :
 * la route /auth/callback renvoie alors ici. Ce composant ouvre la session dans le navigateur,
 * puis continue vers la page demandée.
 */
export function SessionDepuisLien() {
  const actif = useSyncExternalStore(abonner, jetonDansLien, () => false)
  const [echec, setEchec] = useState(false)

  useEffect(() => {
    if (!actif) return
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const access_token = fragment.get('access_token')
    const refresh_token = fragment.get('refresh_token')
    const recuperation = fragment.get('type') === 'recovery'
    const suite = recuperation ? '/mot-de-passe/nouveau' : suiteSure(new URLSearchParams(window.location.search).get('suite'))
    if (!access_token || !refresh_token) return
    creerClientNavigateur()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
          setEchec(true)
        } else {
          window.location.replace(suite)
        }
      })
  }, [actif])

  if (!actif || echec) return null
  return (
    <div role="status" className="fixed inset-0 z-50 grid place-items-center bg-fond text-[15px] font-medium text-encre-2">
      Connexion en cours…
    </div>
  )
}
