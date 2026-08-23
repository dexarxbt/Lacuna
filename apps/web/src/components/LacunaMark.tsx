type LacunaMarkProps = {
  className?: string
  labelled?: boolean
}

export function LacunaMark({ className, labelled = false }: LacunaMarkProps) {
  return (
    <svg
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? 'Lacuna' : undefined}
      className={className}
      fill="none"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4 5h9v4H8v14h5v4H4V5Z" fill="currentColor" />
      <path d="M28 5h-9v4h5v14h-5v4h9V5Z" fill="currentColor" />
      <path d="M13 13h6v6h-6z" fill="currentColor" opacity=".26" />
    </svg>
  )
}
