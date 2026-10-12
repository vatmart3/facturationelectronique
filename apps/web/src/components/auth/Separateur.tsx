export function Separateur({ texte = 'ou' }: { texte?: string }) {
  return (
    <div className="flex items-center gap-3 text-[12.5px] text-encre-3" role="separator">
      <span className="h-px flex-1 bg-trait" />
      {texte}
      <span className="h-px flex-1 bg-trait" />
    </div>
  )
}
