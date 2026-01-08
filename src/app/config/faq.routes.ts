// src/app/config/faq.routes.ts
import type { Lang, SeoRouteKey } from './seo.routes';

export type FaqItem = {
  q: string;
  a: string;
};

type FaqByLang = {
  fr: FaqItem[];
  en?: FaqItem[]; // pour plus tard si tu traduis en EN
};

/**
 * FAQs "en dur" par page (clé = SeoRouteKey).
 * Tu peux les enrichir / modifier ici sans toucher au reste de l’appli.
 */
const FAQ_ROUTE_CONFIG: Record<SeoRouteKey, FaqByLang> = {
  /* =========================
   * PAGE D’ACCUEIL  ('home' -> / )
   * ========================= */
  home: {
    fr: [
      {
        q: 'Qu’est-ce qu’une expertise immobilière certifiée ?',
        a: `Une expertise immobilière certifiée consiste à déterminer la valeur vénale ou locative d’un bien immobilier à partir de méthodes reconnues : approche par comparaison, rendement ou coût de remplacement.
L’expertise est réalisée par un expert agréé selon la Charte de l’expertise en évaluation immobilière et les standards RICS.
Contrairement à une simple estimation, elle a une valeur juridique et financière opposable.`,
      },
      {
        q: 'Dans quels cas demander une expertise immobilière ?',
        a: `Une expertise est indispensable dans de nombreuses situations :
• succession ou partage de patrimoine,
• divorce ou donation,
• financement bancaire ou garantie hypothécaire,
• litige locatif, expropriation ou arbitrage patrimonial.
Elle permet d’obtenir un rapport objectif et documenté, reconnu par les banques, notaires, tribunaux et assurances.`,
      },
      {
        q: 'Quelle est la différence entre valeur vénale et valeur locative ?',
        a: `La valeur vénale représente le prix auquel un bien pourrait être vendu dans des conditions normales de marché.
La valeur locative, quant à elle, correspond au montant du loyer annuel estimé selon les caractéristiques du bien et le marché local.
Ces deux notions sont essentielles pour la gestion patrimoniale, l’investissement immobilier ou la fixation de loyers commerciaux.`,
      },
      {
        q: 'Comment se déroule une expertise immobilière ?',
        a: `L’expert procède d’abord à une analyse du bien (surface, nature, état, localisation, contraintes réglementaires).
Il étudie ensuite les références du marché, applique des méthodes de calcul normalisées (comparaison, rendement, DCF, sol et construction) et rédige un rapport d’expertise motivé, détaillant sa méthodologie et sa conclusion chiffrée.
Ce rapport constitue un document officiel pouvant être produit en cas de litige ou de procédure judiciaire.`,
      },
      {
        q: 'Pourquoi faire appel à un expert agréé plutôt qu’à une agence immobilière ?',
        a: `L’expert immobilier agréé agit en toute indépendance et engage sa responsabilité professionnelle.
Ses rapports sont encadrés par la Charte de l’expertise et peuvent être utilisés à des fins juridiques, fiscales ou comptables.
Une agence immobilière propose une estimation indicative à vocation commerciale, tandis que l’expert certifié délivre une analyse technique et opposable à forte valeur probante.`,
      },
      {
        q: 'L’expertise immobilière est-elle reconnue par les banques et les tribunaux ?',
        a: `Oui. Une expertise immobilière réalisée par un expert agréé RICS ou membre de l’IFEI est systématiquement reconnue par les établissements financiers, les juridictions civiles et les administrations fiscales.
Elle constitue un gage de fiabilité et de neutralité dans toute démarche patrimoniale, successorale ou judiciaire.`,
      },
    ],
  },

  /* =========================
   * PAGE “QUI SOMMES-NOUS”  ('about' -> /expert-immobilier-reseau-national)
   * ========================= */
  about: {
    fr: [
      {
        q: 'Quelle est la vocation du réseau d’experts ?',
        a: `Le réseau d’experts a pour mission d’assurer des évaluations immobilières indépendantes et rigoureuses, réalisées selon la Charte de l’expertise en évaluation immobilière et les standards RICS.
Il fédère des experts reconnus pour leur neutralité, leur technicité et leur respect des normes déontologiques applicables à la profession.`,
      },
      {
        q: 'Comment s’organise le réseau sur le territoire ?',
        a: `Le réseau repose sur plusieurs pôles régionaux couvrant la France métropolitaine et les territoires d’Outre-mer.
Cette implantation permet une parfaite connaissance des marchés locaux et garantit une réactivité optimale dans la réalisation des missions d’expertise.`,
      },
      {
        q: 'Quelles sont les qualifications des experts membres ?',
        a: `Les experts sont agréés par les principaux organismes de référence : RICS, IFEI, CEIF ou CNEJI.
Chacun justifie d’une expérience significative dans le domaine de l’évaluation immobilière et d’une formation continue assurant la mise à jour permanente de leurs compétences techniques et juridiques.`,
      },
      {
        q: 'Comment le réseau garantit-il l’indépendance de ses expertises ?',
        a: `Chaque expert exerce dans un cadre déontologique strict qui garantit l’absence de tout conflit d’intérêt.
Les rapports produits reposent exclusivement sur des données objectives et des méthodes validées, sans aucune influence commerciale ou patrimoniale.`,
      },
      {
        q: 'Quelles sont les valeurs fondatrices du réseau ?',
        a: `Les trois piliers du réseau sont l’indépendance, la rigueur méthodologique et la transparence.
Ces valeurs guident l’ensemble des missions et constituent la garantie d’une expertise impartiale et fiable, reconnue par les acteurs institutionnels, les juridictions et les établissements bancaires.`,
      },
      {
        q: 'Quels types de missions sont confiés aux experts du réseau ?',
        a: `Les experts interviennent dans tous les contextes nécessitant une évaluation immobilière certifiée : succession, divorce, arbitrage, financement, expropriation ou litige locatif.
Leur champ d’action couvre aussi bien les biens résidentiels que tertiaires, industriels ou commerciaux.`,
      },
    ],
  },

  /* =========================
   * PAGE “NOS SERVICES”  ('services' -> /expertise-immobiliere-services)
   * ========================= */
  services: {
    fr: [
      {
        q: 'Quels types de biens peuvent faire l’objet d’une expertise immobilière ?',
        a: `L’expertise peut concerner tous types de biens bâtis et non bâtis : logements, immeubles de bureaux, locaux commerciaux, entrepôts, terrains nus ou constructibles, actifs industriels ou propriétés spécifiques.
L’expert adapte sa méthodologie selon la nature du bien et son usage.`,
      },
      {
        q: 'Quelles sont les principales méthodes d’évaluation utilisées ?',
        a: `Plusieurs méthodes reconnues sont employées selon le contexte :
• Méthode par comparaison, basée sur les références du marché,
• Méthode par capitalisation du revenu (rendement),
• Méthode du coût de remplacement net,
• Méthode du Discounted Cash Flow (DCF) pour les actifs à revenus,
• Bilan promoteur pour les opérations de promotion immobilière.
Chaque rapport précise les hypothèses retenues et les calculs effectués.`,
      },
      {
        q: 'Dans quels contextes réaliser une expertise immobilière ?',
        a: `Une expertise est souvent requise dans les cas suivants :
• succession ou donation,
• divorce ou partage,
• financement bancaire ou garantie hypothécaire,
• litige locatif ou révision de loyer,
• cession ou arbitrage d’actifs immobiliers,
• expropriation ou procédure judiciaire.
Elle permet d’obtenir une valeur certifiée et opposable, reconnue par les tiers.`,
      },
      {
        q: 'Quelle est la différence entre expertise amiable et judiciaire ?',
        a: `L’expertise amiable est réalisée à la demande d’un particulier, d’une entreprise ou d’une institution pour connaître la valeur d’un bien dans un cadre volontaire.
L’expertise judiciaire est ordonnée par un tribunal dans le cadre d’une procédure et réalisée par un expert inscrit sur une liste de cour d’appel.
Les deux obéissent à la même rigueur méthodologique.`,
      },
      {
        q: 'Quelle est la durée de validité d’un rapport d’expertise immobilière ?',
        a: `Un rapport reste valable tant que les conditions économiques et physiques du bien n’ont pas évolué de manière significative.
En général, une mise à jour est recommandée tous les 12 à 24 mois pour garantir la pertinence de la valeur, notamment sur les marchés en forte variation.`,
      },
      {
        q: 'Un expert immobilier peut-il intervenir sur plusieurs régions ?',
        a: `Oui. Les experts du réseau interviennent sur l’ensemble du territoire national et en Outre-mer.
Lorsqu’un dossier nécessite une connaissance spécifique du marché local, un expert régional agréé est mandaté pour garantir la fiabilité de l’évaluation.`,
      },
    ],
  },

  /* =========================
   * PAGE “BIENS & MÉTHODES”  ('methods' -> /methodes-evaluation-immobiliere)
   * ========================= */
  methods: {
    fr: [
      {
        q: 'Quelles sont les principales méthodes utilisées pour évaluer un bien immobilier ?',
        a: `L’expert applique plusieurs approches reconnues selon la nature du bien et le contexte :
• Méthode par comparaison directe : analyse des transactions récentes sur des biens similaires,
• Méthode par capitalisation du revenu (rendement locatif),
• Méthode du coût de remplacement net, adaptée aux bâtiments spécifiques,
• Méthode du Discounted Cash Flow (DCF) pour les actifs générant des flux financiers,
• Bilan promoteur, utilisé dans les opérations de promotion ou restructuration.
Chaque méthode est justifiée et pondérée dans le rapport final.`,
      },
      {
        q: 'Quelle méthode privilégier selon le type de bien ?',
        a: `Pour un bien résidentiel, la méthode par comparaison est la plus utilisée.
Pour un immeuble de rapport ou un local commercial, la méthode du rendement ou du DCF est privilégiée.
Pour les terrains ou biens atypiques, la méthode Sol + Construction ou Bilan Promoteur est plus adaptée.
L’expert choisit la ou les méthodes les plus pertinentes selon le dossier.`,
      },
      {
        q: 'Comment l’expert garantit-il la fiabilité de la valeur calculée ?',
        a: `La fiabilité repose sur la pertinence des données utilisées (références de marché, indices, ratios professionnels) et la cohérence entre les approches appliquées.
Chaque rapport est documenté, argumenté et conforme aux exigences de la Charte de l’expertise et aux standards RICS / TEGoVA.`,
      },
      {
        q: 'Quelle est la différence entre valeur vénale et valeur d’investissement ?',
        a: `La valeur vénale correspond au prix estimé en cas de vente dans des conditions normales de marché.
La valeur d’investissement est la valeur déterminée selon le rendement attendu pour un investisseur donné, en tenant compte de son horizon et de son profil de risque.
Ces notions diffèrent mais peuvent être calculées conjointement dans le cadre d’un rapport global.`,
      },
      {
        q: 'Les méthodes d’évaluation sont-elles normalisées ?',
        a: `Oui. Les méthodes appliquées par les experts agréés reposent sur des normes professionnelles reconnues :
• Charte de l’expertise en évaluation immobilière (édition 2024),
• Normes RICS – Red Book,
• Standards TEGoVA – EVS (European Valuation Standards).
Ces référentiels garantissent la transparence et la comparabilité des rapports.`,
      },
      {
        q: 'Pourquoi faire appel à un expert agréé pour une évaluation complexe ?',
        a: `Un expert agréé dispose des compétences techniques, juridiques et financières nécessaires pour analyser des biens à forte valeur ou à usages multiples (bureaux, commerces, entrepôts, hôtels…).
Il maîtrise les modèles de valorisation avancés (DCF, ratios, bilans promoteurs) et engage sa responsabilité sur la fiabilité de la valeur produite.`,
      },
    ],
  },

  /* =========================
   * PAGE “ÉQUIPE”  ('team' -> /experts-immobiliers-agrees)
   * ========================= */
  team: {
    fr: [
      {
        q: 'Quelles sont les compétences requises pour devenir expert immobilier agréé ?',
        a: `Un expert agréé possède une double compétence technique et financière.
Il maîtrise les principes de l’évaluation, le droit immobilier, l’urbanisme, la fiscalité et les techniques de construction.
La plupart sont diplômés de formations spécialisées et justifient d’une expérience professionnelle significative dans le domaine de l’évaluation ou de la gestion immobilière.`,
      },
      {
        q: 'Les experts suivent-ils une formation continue ?',
        a: `Oui. Les experts du réseau s’engagent à suivre une formation continue annuelle pour maintenir un haut niveau d’exigence.
Ils participent régulièrement à des séminaires, formations RICS ou modules dispensés par l’IFEI ou le CEIF, afin d’intégrer les évolutions réglementaires, fiscales et techniques.`,
      },
      {
        q: 'Comment garantir l’indépendance et l’impartialité d’un expert ?',
        a: `Chaque expert respecte un code de déontologie strict garantissant son indépendance vis-à-vis des donneurs d’ordre.
Aucune relation commerciale ou patrimoniale ne peut influencer la valeur déterminée.
Les rapports sont documentés, motivés et opposables, conformément à la Charte de l’expertise.`,
      },
      {
        q: 'Quelle est la différence entre un expert immobilier et un agent immobilier ?',
        a: `L’agent immobilier évalue un bien à des fins commerciales pour accompagner une transaction.
L’expert immobilier agréé, quant à lui, réalise une analyse technique et financière approfondie, encadrée par des normes professionnelles.
Ses rapports ont une valeur juridique et fiscale reconnue par les tribunaux et les établissements financiers.`,
      },
      {
        q: 'Les experts sont-ils reconnus par des organismes officiels ?',
        a: `Oui. Les experts du réseau sont membres ou agréés par les organismes de référence :
• RICS (Royal Institution of Chartered Surveyors),
• IFEI (Institut Français de l’Expertise Immobilière),
• CEIF,
• CNEJI.
Ces affiliations garantissent la crédibilité, la compétence et la conformité des pratiques à l’échelle nationale et internationale.`,
      },
      {
        q: 'Les experts peuvent-ils intervenir en tant qu’experts judiciaires ?',
        a: `Certains membres du réseau sont inscrits sur la liste des experts judiciaires près les Cours d’appel.
Ils sont habilités à intervenir dans le cadre de procédures contentieuses à la demande d’un juge, conformément au décret du 23 décembre 2004 relatif à l’expertise judiciaire.`,
      },
    ],
  },

  /* =========================
   * PAGE “ACTUALITÉS”  ('news-list' -> /actualites-expertise-immobiliere)
   * (pas de FAQ fournie pour l’instant)
   * ========================= */
  'news-list': {
    fr: [],
  },

  /* =========================
   * PAGE “CONTACT”  ('contact' -> /contact-expert-immobilier)
   * (pas de FAQ fournie pour l’instant)
   * ========================= */
  contact: {
    fr: [],
  },

  /* =========================
   * PAGE “MENTIONS LÉGALES”  ('legal' -> /mentions-legales)
   * (aucune FAQ nécessaire)
   * ========================= */
  legal: {
    fr: [],
  },
};

/**
 * Helper central : récupère la liste de FAQs pour une route + langue.
 * - Si pas de contenu en EN, on retombe automatiquement sur le FR.
 */
export function getFaqForRoute(route: SeoRouteKey, lang: Lang): FaqItem[] {
  const cfg = FAQ_ROUTE_CONFIG[route];
  if (!cfg) return [];

  if (lang === 'en') {
    const en = cfg.en ?? [];
    return en.length ? en : cfg.fr ?? [];
  }

  return cfg.fr ?? [];
}
