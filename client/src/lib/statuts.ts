/** Couleurs des badges pilule par statut (cahier des charges §3). */
export const COULEURS_STATUT: Record<string, string> = {
  // Projets / génériques
  'En cours': 'bg-blue-100 text-blue-700',
  'En attente': 'bg-slate-700 text-white',
  'Terminé': 'bg-green-100 text-green-700',
  'Annulé': 'bg-red-100 text-red-700',
  'En pause': 'bg-orange-100 text-orange-700',
  'Livré': 'bg-emerald-100 text-emerald-600',
  'Planifié': 'bg-slate-200 text-slate-600',
  'Démarré': 'bg-indigo-100 text-indigo-700',
  'Arrêté': 'bg-rose-200 text-rose-800',
  // Devis
  'brouillon': 'bg-slate-200 text-slate-600',
  'envoyé': 'bg-blue-100 text-blue-700',
  'accepté': 'bg-green-100 text-green-700',
  'refusé': 'bg-red-100 text-red-700',
  // Factures
  'envoyée': 'bg-blue-100 text-blue-700',
  'partiellement payée': 'bg-amber-100 text-amber-700',
  'payée': 'bg-green-100 text-green-700',
  'en retard': 'bg-red-100 text-red-700',
  // Employés
  'actif': 'bg-green-100 text-green-700',
  'congé': 'bg-amber-100 text-amber-700',
  'parti': 'bg-slate-200 text-slate-600',
  // Matériels
  'bon': 'bg-green-100 text-green-700',
  'moyen': 'bg-amber-100 text-amber-700',
  'panne': 'bg-red-100 text-red-700',
  // Stock
  'entree': 'bg-green-100 text-green-700',
  'sortie': 'bg-orange-100 text-orange-700',
  'inventaire': 'bg-slate-200 text-slate-600',
  // Maintenance
  'préventive': 'bg-blue-100 text-blue-700',
  'curative': 'bg-orange-100 text-orange-700',
  'planifiée': 'bg-slate-200 text-slate-600',
  'réalisée': 'bg-green-100 text-green-700',
  // Paiements
  'encaissement': 'bg-green-100 text-green-700',
  'decaissement': 'bg-orange-100 text-orange-700',
  // Types facture / client
  'acompte': 'bg-indigo-100 text-indigo-700',
  'situation': 'bg-blue-100 text-blue-700',
  'solde': 'bg-emerald-100 text-emerald-600',
  'particulier': 'bg-slate-200 text-slate-600',
  'entreprise': 'bg-blue-100 text-blue-700',
  'administration': 'bg-purple-100 text-purple-700',
}

export const STATUTS_PROJET = ['Démarré', 'Planifié', 'En cours', 'Arrêté', 'Livré', 'En pause', 'Terminé', 'Annulé']
export const STATUTS_CHANTIER = ['En attente', 'En cours', 'Terminé']
export const CATEGORIES_DEPENSE = ['matériaux', "main-d'œuvre", 'sous-traitance', 'carburant', 'location', 'divers']
export const MODES_PAIEMENT = ['espèces', 'virement', 'chèque', 'mobile money']

/** Couleur de la barre de progression selon le contexte. */
export function couleurProgression(avancement: number, statut?: string): string {
  if (statut === 'Annulé' || statut === 'Arrêté') return 'bg-red-500'
  if (avancement >= 100 || statut === 'Terminé' || statut === 'Livré') return 'bg-green-500'
  return 'bg-primaire'
}
