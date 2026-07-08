import { ENTITES } from './entites'
import type { ChampDef } from './crud'

function schemaProp(def: ChampDef): any {
  switch (def.type) {
    case 'number':
      return { type: 'number', description: def.label }
    case 'boolean':
      return { type: 'boolean', description: def.label }
    case 'date':
      return { type: 'string', format: 'date', description: def.label }
    case 'enum':
      return { type: 'string', enum: def.valeurs, description: def.label }
    default:
      return { type: 'string', description: def.label }
  }
}

export function construireOpenApi() {
  const schemas: Record<string, any> = {}
  const paths: Record<string, any> = {}

  for (const e of ENTITES) {
    const props: Record<string, any> = { id: { type: 'string', readOnly: true } }
    const requis: string[] = []
    for (const [nom, def] of Object.entries(e.champs)) {
      props[nom] = schemaProp(def)
      if (def.requis) requis.push(nom)
    }
    schemas[e.titre] = { type: 'object', properties: props, ...(requis.length ? { required: requis } : {}) }
    const ref = { $ref: `#/components/schemas/${e.titre}` }
    const tag = e.titre

    paths[`/api/${e.nom}`] = {
      get: {
        tags: [tag],
        summary: `Liste des ${e.nom}`,
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Recherche texte' },
          ...(e.filtres ?? []).map((f) => ({ name: f, in: 'query', schema: { type: 'string' } })),
        ],
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: ref } } } } },
      },
      post: {
        tags: [tag],
        summary: `Créer un(e) ${e.titre}`,
        requestBody: { content: { 'application/json': { schema: ref } } },
        responses: { '201': { description: 'Créé' }, '400': { description: 'Données invalides' }, '403': { description: 'Droits insuffisants' } },
      },
    }
    paths[`/api/${e.nom}/{id}`] = {
      get: {
        tags: [tag],
        summary: `Détail d'un(e) ${e.titre}`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Introuvable' } },
      },
      put: {
        tags: [tag],
        summary: `Modifier un(e) ${e.titre}`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: ref } } },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        tags: [tag],
        summary: `Supprimer un(e) ${e.titre} (suppression douce)`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Supprimé' } },
      },
    }
  }

  // Endpoints spéciaux (auth, planification, stats, exports)
  Object.assign(paths, {
    '/api/auth/connexion': {
      post: {
        tags: ['Authentification'],
        summary: 'Connexion (retourne accessToken + refreshToken)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { email: { type: 'string' }, motDePasse: { type: 'string' } },
                required: ['email', 'motDePasse'],
              },
            },
          },
        },
        responses: { '200': { description: 'Connecté' }, '401': { description: 'Identifiants invalides' } },
      },
    },
    '/api/auth/rafraichir': { post: { tags: ['Authentification'], summary: 'Rafraîchir le jeton d’accès', responses: { '200': { description: 'OK' } } } },
    '/api/auth/deconnexion': { post: { tags: ['Authentification'], summary: 'Déconnexion', responses: { '200': { description: 'OK' } } } },
    '/api/auth/moi': { get: { tags: ['Authentification'], summary: 'Profil courant', responses: { '200': { description: 'OK' } } } },
    '/api/chantiers/{id}/planifier': {
      post: {
        tags: ['Planification'],
        summary: 'Calculer / recalculer le planning CPM du chantier',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Planning calculé' }, '422': { description: 'Cycle de dépendances ou aucune tâche' } },
      },
    },
    '/api/chantiers/{id}/planning': {
      get: { tags: ['Planification'], summary: 'Planning complet (lots + tâches + dépendances)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } },
    },
    '/api/chantiers/{id}/alertes': {
      get: { tags: ['Planification'], summary: 'Alertes du chantier (retards, dépassements, surcharges)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } },
    },
    '/api/chantiers/{id}/baselines': {
      post: { tags: ['Planification'], summary: 'Créer une baseline (snapshot du planning)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Créée' } } },
      get: { tags: ['Planification'], summary: 'Lister les baselines', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } },
    },
    '/api/baselines/{id}/comparaison': {
      get: { tags: ['Planification'], summary: 'Comparaison prévu / actuel (glissements)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } },
    },
    '/api/planification/apercu': { get: { tags: ['Planification'], summary: 'Vue d’ensemble planification (compteurs + chantiers)', responses: { '200': { description: 'OK' } } } },
    '/api/planification/gantt': { get: { tags: ['Planification'], summary: 'Données Gantt (un chantier ou tous)', parameters: [{ name: 'chantierId', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/api/taches-transversales': { get: { tags: ['Planification'], summary: 'Toutes les tâches (tous chantiers)', responses: { '200': { description: 'OK' } } } },
    '/api/taches/{id}/avancement': { patch: { tags: ['Planification'], summary: 'Mise à jour rapide de l’avancement', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/api/pointages': { get: { tags: ['Ressources'], summary: 'Pointage d’une journée sur un chantier', parameters: [{ name: 'chantierId', in: 'query', schema: { type: 'string' } }, { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { '200': { description: 'OK' } } } },
    '/api/pointages/journee': { post: { tags: ['Ressources'], summary: 'Enregistrer le pointage d’une journée', responses: { '200': { description: 'OK' } } } },
    '/api/devis/{id}/dupliquer': { post: { tags: ['Finance'], summary: 'Dupliquer un devis (nouvelle version)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Créé' } } } },
    '/api/devis/{id}/convertir-contrat': { post: { tags: ['Finance'], summary: 'Convertir un devis en contrat (+ projet optionnel)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Créé' } } } },
    '/api/devis/{id}/creer-facture': { post: { tags: ['Finance'], summary: 'Créer une facture depuis un devis', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Créée' } } } },
    '/api/devis/{id}/lignes': { put: { tags: ['Finance'], summary: 'Remplacer les lignes d’un devis', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/api/clients/{id}/historique': { get: { tags: ['Gestion'], summary: 'Historique complet d’un client', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/api/stats/tableau-de-bord': { get: { tags: ['Statistiques'], summary: 'KPI + graphiques du tableau de bord', responses: { '200': { description: 'OK' } } } },
    '/api/stats/analyse': { get: { tags: ['Statistiques'], summary: 'Analyse statistique avancée', responses: { '200': { description: 'OK' } } } },
    '/api/exports/devis/{id}/pdf': { get: { tags: ['Exports'], summary: 'Devis en PDF', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'PDF' } } } },
    '/api/exports/factures/{id}/pdf': { get: { tags: ['Exports'], summary: 'Facture en PDF', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'PDF' } } } },
    '/api/exports/chantiers/{id}/planning-pdf': { get: { tags: ['Exports'], summary: 'Planning Gantt en PDF', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'PDF' } } } },
    '/api/exports/chantiers/{id}/planning-xlsx': { get: { tags: ['Exports'], summary: 'Planning en Excel', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Excel' } } } },
    '/api/exports/finance-xlsx': { get: { tags: ['Exports'], summary: 'États financiers en Excel', responses: { '200': { description: 'Excel' } } } },
    '/api/exports/stock-xlsx': { get: { tags: ['Exports'], summary: 'État du stock en Excel', responses: { '200': { description: 'Excel' } } } },
  })

  return {
    openapi: '3.0.3',
    info: {
      title: 'SIM-BAT — API de gestion BTP',
      version: '1.0.0',
      description:
        "API REST de l'application SIM-BAT : clients, projets, chantiers, planification CPM/Gantt, ressources, stocks, maintenance, finance (devis, factures, dépenses, paiements) et statistiques. Authentification JWT (Bearer). Rôles : ADMIN, CHEF_PROJET, CONDUCTEUR, COMPTABLE, MAGASINIER, LECTURE.",
    },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas,
    },
    security: [{ bearerAuth: [] }],
    paths,
  }
}
