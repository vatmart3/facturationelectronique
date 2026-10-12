import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Icone, type NomIcone } from './Icone'

const BOITE =
  'flex h-[38px] items-center gap-2 rounded-m border bg-surface px-3 transition-[border-color,box-shadow] ' +
  'focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-doux)]'

interface CadreProps {
  id: string
  libelle: string
  aide?: ReactNode
  erreur?: string
  facultatif?: boolean
  className?: string
  children: ReactNode
}

function Cadre({ id, libelle, aide, erreur, facultatif, className, children }: CadreProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-encre">
        {libelle}
        {facultatif && <span className="font-normal text-encre-3"> · facultatif</span>}
      </label>
      {children}
      {erreur ? (
        <p id={`${id}-message`} className="flex items-center gap-1.5 text-[12.5px] text-alerte">
          <Icone nom="alerte" taille={13} />
          {erreur}
        </p>
      ) : (
        aide && (
          <p id={`${id}-message`} className="text-[12.5px] text-encre-3">
            {aide}
          </p>
        )
      )}
    </div>
  )
}

interface ChampProps extends InputHTMLAttributes<HTMLInputElement> {
  libelle: string
  aide?: ReactNode
  erreur?: string
  facultatif?: boolean
  icone?: NomIcone
  suffixe?: string
  chiffres?: boolean
  classeCadre?: string
}

export function Champ({
  libelle,
  aide,
  erreur,
  facultatif,
  icone,
  suffixe,
  chiffres,
  classeCadre,
  id,
  className,
  ...props
}: ChampProps) {
  const idAuto = useId()
  const idChamp = id ?? idAuto
  return (
    <Cadre id={idChamp} libelle={libelle} aide={aide} erreur={erreur} facultatif={facultatif} className={classeCadre}>
      <div className={cn(BOITE, erreur ? 'border-alerte' : 'border-trait-fort')}>
        {icone && <Icone nom={icone} taille={15} className="shrink-0 text-encre-3" />}
        <input
          id={idChamp}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur || aide ? `${idChamp}-message` : undefined}
          className={cn(
            'h-full min-w-0 flex-1 bg-transparent text-[14px] text-encre outline-none placeholder:text-encre-3',
            chiffres && 'font-chiffre tabular-nums',
            className,
          )}
          {...props}
        />
        {suffixe && <span className="shrink-0 font-chiffre text-[12px] text-encre-3">{suffixe}</span>}
      </div>
    </Cadre>
  )
}

interface SelectionProps extends SelectHTMLAttributes<HTMLSelectElement> {
  libelle: string
  aide?: ReactNode
  erreur?: string
  facultatif?: boolean
  options: Array<{ valeur: string; libelle: string }>
  classeCadre?: string
}

export function Selection({ libelle, aide, erreur, facultatif, options, classeCadre, id, className, ...props }: SelectionProps) {
  const idAuto = useId()
  const idChamp = id ?? idAuto
  return (
    <Cadre id={idChamp} libelle={libelle} aide={aide} erreur={erreur} facultatif={facultatif} className={classeCadre}>
      <div className={cn(BOITE, 'relative pr-8', erreur ? 'border-alerte' : 'border-trait-fort')}>
        <select
          id={idChamp}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur || aide ? `${idChamp}-message` : undefined}
          className={cn('h-full w-full min-w-0 appearance-none bg-transparent text-[14px] text-encre outline-none', className)}
          {...props}
        >
          {options.map((o) => (
            <option key={o.valeur} value={o.valeur}>
              {o.libelle}
            </option>
          ))}
        </select>
        <Icone nom="chevrons" taille={14} className="pointer-events-none absolute right-3 text-encre-3" />
      </div>
    </Cadre>
  )
}

interface CaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  libelle: string
  aide?: ReactNode
}

export function Case({ libelle, aide, id, className, ...props }: CaseProps) {
  const idAuto = useId()
  const idChamp = id ?? idAuto
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={idChamp}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded-s border-trait-fort accent-[var(--accent)]"
        aria-describedby={aide ? `${idChamp}-aide` : undefined}
        {...props}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={idChamp} className="text-[13.5px] font-medium">
          {libelle}
        </label>
        {aide && (
          <p id={`${idChamp}-aide`} className="text-[12.5px] text-encre-3">
            {aide}
          </p>
        )}
      </div>
    </div>
  )
}
