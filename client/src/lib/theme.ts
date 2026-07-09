// Gestion du thème clair / sombre (persisté, avec repli sur la préférence système)
const CLE = 'simbat_theme'

export type Theme = 'clair' | 'sombre'

export function themeInitial(): Theme {
  const stocke = localStorage.getItem(CLE)
  if (stocke === 'clair' || stocke === 'sombre') return stocke
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair'
}

export function appliquerTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'sombre')
  localStorage.setItem(CLE, theme)
}
