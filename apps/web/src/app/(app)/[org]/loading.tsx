/** Affiché instantanément pendant le chargement d'une page : la navigation ne paraît jamais figée. */
export default function Chargement() {
  return (
    <div role="status" aria-label="Chargement de la page" className="flex animate-pulse flex-col gap-[22px] motion-reduce:animate-none">
      <div className="flex items-center gap-3.5 rounded-l border border-trait bg-surface px-5 py-4 shadow-douce">
        <span className="size-11 rounded-[11px] bg-survol" />
        <span className="flex flex-col gap-2">
          <span className="h-2.5 w-16 rounded-full bg-survol" />
          <span className="h-5 w-48 rounded-full bg-survol" />
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-[104px] rounded-l border border-trait bg-surface shadow-douce" />
        ))}
      </div>
      <span className="h-72 rounded-l border border-trait bg-surface shadow-douce" />
      <span className="sr-only">Chargement…</span>
    </div>
  )
}
