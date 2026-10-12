'use client'

import { Bouton } from '@/components/ui/Bouton'

export function BoutonImprimer() {
  return (
    <Bouton taille="s" variante="secondaire" onClick={() => window.print()}>
      Imprimer
    </Bouton>
  )
}
