// src/app/config/seo-pages.config.ts
import { environment } from '../../environments/environment';
import { SeoConfig } from '../services/seo.service';

const SITE_URL = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/+$/, '');
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/img/seo/og-groupe-abc-default.jpg`;

/* ========= FR ========= */

export const SEO_FR_HOME: SeoConfig = {
  lang: 'fr',
  locale: 'fr_FR',
  title: 'Groupe ABC – Expertise immobilière nationale certifiée',
  description:
    'Groupe ABC, réseau d’experts immobiliers certifiés, réalise des expertises immobilières de valeur vénale et locative pour investisseurs, entreprises, banques, collectivités et particuliers en France et Outre-mer.',
  type: 'website',
  canonical: `${SITE_URL}/`,
  image: DEFAULT_OG_IMAGE,
  imageAlt: 'Groupe ABC – Expertise immobilière sur tout le territoire',
};

export const SEO_FR_ABOUT: SeoConfig = {
  lang: 'fr',
  locale: 'fr_FR',
  title: 'Réseau national d’experts immobiliers agréés – Groupe ABC',
  description:
    'Le Groupe ABC fédère des experts immobiliers agréés, indépendants et certifiés, présents sur l’ensemble du territoire pour accompagner vos enjeux de valorisation, arbitrage, financement et contentieux.',
  type: 'website',
  canonical: `${SITE_URL}/expert-immobilier-reseau-national`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_FR_SERVICES: SeoConfig = {
  lang: 'fr',
  locale: 'fr_FR',
  title: 'Services d’expertise immobilière – Valeur vénale et locative',
  description:
    'Expertise de valeur vénale, locative, droit au bail, indemnités d’éviction et expropriation : le Groupe ABC intervient en amiable et judiciaire pour sécuriser vos décisions immobilières.',
  type: 'website',
  canonical: `${SITE_URL}/expertise-immobiliere-services`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_FR_METHODS: SeoConfig = {
  lang: 'fr',
  locale: 'fr_FR',
  title: 'Méthodes d’évaluation immobilière – Approches et calculs de valeur',
  description:
    'Comparaison, rendement, flux actualisés (DCF), bilan promoteur… Découvrez les principales méthodes utilisées par le Groupe ABC pour déterminer une valeur immobilière objective et argumentée.',
  type: 'website',
  canonical: `${SITE_URL}/methodes-evaluation-immobiliere`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_FR_TEAM: SeoConfig = {
  lang: 'fr',
  locale: 'fr_FR',
  title: 'Équipe d’experts immobiliers agréés – Compétences et déontologie',
  description:
    'Une équipe d’experts immobiliers agréés, pluridisciplinaires et expérimentés, intervenant en France et Outre-mer dans le respect des normes, de l’éthique professionnelle et de la déontologie.',
  type: 'website',
  canonical: `${SITE_URL}/experts-immobiliers-agrees`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_FR_NEWS_LIST: SeoConfig = {
  lang: 'fr',
  locale: 'fr_FR',
  title: 'Actualités de l’expertise immobilière – Marché, valeur et réglementation',
  description:
    'Suivez les actualités du marché immobilier, de la réglementation, des normes d’expertise et des pratiques d’évaluation avec le Groupe ABC.',
  type: 'website',
  canonical: `${SITE_URL}/actualites-expertise-immobiliere`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_FR_CONTACT: SeoConfig = {
  lang: 'fr',
  locale: 'fr_FR',
  title: 'Contact – Expertise immobilière certifiée en France et Outre-mer',
  description:
    'Vous avez un besoin d’expertise immobilière ? Contactez le Groupe ABC pour une intervention rapide et structurée partout en France et Outre-mer.',
  type: 'website',
  canonical: `${SITE_URL}/contact-expert-immobilier`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_FR_LEGAL: SeoConfig = {
  lang: 'fr',
  locale: 'fr_FR',
  title: 'Mentions légales – Groupe ABC',
  description:
    'Mentions légales du site du Groupe ABC, réseau national d’experts immobiliers.',
  type: 'website',
  canonical: `${SITE_URL}/mentions-legales`,
  image: DEFAULT_OG_IMAGE,
};

/* ========= EN ========= */

export const SEO_EN_HOME: SeoConfig = {
  lang: 'en',
  locale: 'en_US',
  title: 'Groupe ABC – National real estate valuation experts',
  description:
    'Groupe ABC is a network of chartered real estate valuers providing market and rental value assessments for investors, corporates, banks and public entities across France and overseas territories.',
  type: 'website',
  canonical: `${SITE_URL}/en`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_EN_ABOUT: SeoConfig = {
  lang: 'en',
  locale: 'en_US',
  title: 'National network of chartered real estate valuation experts – Groupe ABC',
  description:
    'Groupe ABC brings together independent chartered valuers covering the whole French territory to support your valuation, arbitration, financing and litigation matters.',
  type: 'website',
  canonical: `${SITE_URL}/en/expert-network-chartered-valuers`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_EN_SERVICES: SeoConfig = {
  lang: 'en',
  locale: 'en_US',
  title: 'Real estate valuation services – Market & rental value',
  description:
    'Market value, rental value, leasehold interests, eviction and expropriation compensation: Groupe ABC provides independent valuation services for your real estate decisions.',
  type: 'website',
  canonical: `${SITE_URL}/en/real-estate-valuation-services`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_EN_METHODS: SeoConfig = {
  lang: 'en',
  locale: 'en_US',
  title: 'Valuation methods & assets – Approaches & calculations',
  description:
    'Comparable, income and discounted cash-flow approaches, as well as developer’s residual: discover the main valuation methods used by Groupe ABC.',
  type: 'website',
  canonical: `${SITE_URL}/en/valuation-methods-assets`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_EN_TEAM: SeoConfig = {
  lang: 'en',
  locale: 'en_US',
  title: 'Chartered valuers team – Skills & ethics',
  description:
    'A team of experienced chartered valuers covering France and overseas territories, working in compliance with standards, ethics and professional codes of conduct.',
  type: 'website',
  canonical: `${SITE_URL}/en/chartered-valuers-team`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_EN_NEWS_LIST: SeoConfig = {
  lang: 'en',
  locale: 'en_US',
  title: 'Real estate valuation news – Market, value & regulation',
  description:
    'Follow key insights on the French real estate market, valuation standards and case law with Groupe ABC.',
  type: 'website',
  canonical: `${SITE_URL}/en/real-estate-valuation-news`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_EN_CONTACT: SeoConfig = {
  lang: 'en',
  locale: 'en_US',
  title: 'Contact chartered valuers — Certified real estate valuation',
  description:
    'Get in touch with Groupe ABC for independent and certified real estate valuation assignments in France and overseas territories.',
  type: 'website',
  canonical: `${SITE_URL}/en/contact-chartered-valuers`,
  image: DEFAULT_OG_IMAGE,
};

export const SEO_EN_LEGAL: SeoConfig = {
  lang: 'en',
  locale: 'en_US',
  title: 'Legal notice – Groupe ABC',
  description:
    'Legal notice of the Groupe ABC website, national network of chartered valuers.',
  type: 'website',
  canonical: `${SITE_URL}/en/legal-notice`,
  image: DEFAULT_OG_IMAGE,
};
