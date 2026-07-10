// Logo SIM-HANDLING CORPORATION — recréé en vectoriel (net à toute taille).
// Disque sombre + anneau « G » ouvert + monogramme « SH ».

export function Logo({
  className,
  sombreFond = false,
}: {
  className?: string
  /** true = posé sur un fond sombre : le disque devient transparent (le fond fait office de disque). */
  sombreFond?: boolean
}) {
  const disque = sombreFond ? 'transparent' : '#232323'
  const marque = sombreFond ? '#ffffff' : '#ffffff'
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="SIM-HANDLING">
      <circle cx="50" cy="50" r="49" fill={disque} />
      {/* Anneau « G » ouvert (ouverture à droite) avec crochet supérieur */}
      <path
        d="M74 32 A32 32 0 1 0 74 68"
        fill="none"
        stroke={marque}
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <path d="M74 32 L61.5 32" fill="none" stroke={marque} strokeWidth="8.5" strokeLinecap="round" />
      {/* Monogramme SH */}
      <text
        x="49.5"
        y="53"
        textAnchor="middle"
        dominantBaseline="central"
        fill={marque}
        fontFamily="'Plus Jakarta Sans Variable', 'Segoe UI', Arial, sans-serif"
        fontWeight="800"
        fontSize="33"
        letterSpacing="-1.5"
      >
        SH
      </text>
    </svg>
  )
}

/** Lockup complet : logo + « SIM-HANDLING » / « CORPORATION ». */
export function LogoLockup({ sombreFond = true, compact = false }: { sombreFond?: boolean; compact?: boolean }) {
  const couleurPrincipale = sombreFond ? 'text-white' : 'text-slate-900'
  const couleurSecondaire = sombreFond ? 'text-slate-400' : 'text-slate-500'
  return (
    <div className="flex items-center gap-2.5">
      <Logo className={compact ? 'h-9 w-9' : 'h-11 w-11'} sombreFond={sombreFond} />
      <div className="leading-none">
        <div className={`font-extrabold tracking-tight2 ${couleurPrincipale} ${compact ? 'text-[15px]' : 'text-xl'}`}>
          SIM-HANDLING
        </div>
        <div className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] ${couleurSecondaire}`}>
          Corporation
        </div>
      </div>
    </div>
  )
}
