import { plateformeAfnor } from './afnor'
import { plateformeSimulee } from './simulee'
import type { FluxRecu, Plateforme } from './types'

export function plateforme(code: string, fournisseurSimule?: () => Promise<FluxRecu[]>): Plateforme {
  return code === 'afnor' ? plateformeAfnor() : plateformeSimulee(fournisseurSimule)
}

export function afnorConfiguree(): boolean {
  return Boolean(process.env.PA_API_URL && process.env.PA_API_TOKEN)
}

export * from './cycle'
export * from './types'
