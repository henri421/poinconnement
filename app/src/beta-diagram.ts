/**
 * Schema des trois positions de poteau et de leur coefficient beta.
 *
 * Le §6.4.3(6) de l'EN 1992-1-1:2004 donne trois valeurs simplifiees de beta —
 * 1,15 a l'interieur, 1,4 en rive, 1,5 en angle. Le choix de la position n'est
 * donc pas un detail de saisie : c'est lui qui fixe le coefficient. On le
 * montre, en vue en plan, plutot que de le laisser deviner d'une liste
 * deroulante.
 *
 * Le schema est REDESSINE, et non repris de la planche de la norme : les trois
 * positions et leurs trois valeurs sont des faits qui s'expliquent, la figure
 * publiee, elle, est protegee.
 *
 * Convention du trace, celle du noyau (`geometry/control-perimeter`) : les
 * bords libres sont a gauche et en bas, le poteau affleure le ou les bords, et
 * le perimetre de controle est le contour a 2d de l'aire chargee, ecrete aux
 * bords libres.
 *
 * Module PUR : il rend une chaine SVG, ne touche a aucun document.
 */

import { coefficientBetaSimplifie, type PositionPoteau } from '../../src/index';

/** Repere du dessin, en unites de viewBox. */
const LARGEUR = 640;
const HAUTEUR = 400;

/** Bords de la dalle : les deux premiers sont LIBRES. */
const BORD_GAUCHE = 60;
const BORD_BAS = 300;
const BORD_DROIT = 620;
const BORD_HAUT = 30;

/** Cote du poteau dessine, et distance 2d du perimetre de controle. */
const COTE = 40;
const DEUX_D = 34;

interface Etiquette {
  x: number;
  y: number;
}

interface Cas {
  position: PositionPoteau;
  nom: string;
  /** Coin superieur gauche du poteau, en coordonnees SVG (y vers le bas). */
  poteau: { x: number; y: number };
  /** Trace du perimetre de controle, deja ecrete aux bords libres. */
  perimetre: string;
  etiquette: Etiquette;
}

/**
 * Les trois cas, places dans le meme coin de dalle : un poteau interieur, un
 * poteau de rive affleurant le bord gauche, un poteau d'angle affleurant les
 * deux bords. Les traces sont ecrits une fois pour toutes plutot que calcules :
 * ce sont trois dessins fixes, pas une geometrie a resoudre.
 */
function casDeFigure(): Cas[] {
  const angleX = BORD_GAUCHE;
  const angleHaut = BORD_BAS - COTE;
  const riveHaut = 90;
  const interieurX = 300;
  const interieurHaut = 170;

  return [
    {
      position: 'interieur',
      nom: 'poteau interieur',
      poteau: { x: interieurX, y: interieurHaut },
      // Contour ferme : quatre cotes decales et quatre quarts de cercle.
      perimetre: [
        `M ${interieurX} ${interieurHaut - DEUX_D}`,
        `H ${interieurX + COTE}`,
        `A ${DEUX_D} ${DEUX_D} 0 0 1 ${interieurX + COTE + DEUX_D} ${interieurHaut}`,
        `V ${interieurHaut + COTE}`,
        `A ${DEUX_D} ${DEUX_D} 0 0 1 ${interieurX + COTE} ${interieurHaut + COTE + DEUX_D}`,
        `H ${interieurX}`,
        `A ${DEUX_D} ${DEUX_D} 0 0 1 ${interieurX - DEUX_D} ${interieurHaut + COTE}`,
        `V ${interieurHaut}`,
        `A ${DEUX_D} ${DEUX_D} 0 0 1 ${interieurX} ${interieurHaut - DEUX_D}`,
        'Z',
      ].join(' '),
      etiquette: { x: interieurX + COTE + DEUX_D + 18, y: interieurHaut + 10 },
    },
    {
      position: 'rive',
      nom: 'poteau de rive',
      poteau: { x: BORD_GAUCHE, y: riveHaut },
      // Contour ouvert : il s'arrete perpendiculairement au bord libre gauche.
      perimetre: [
        `M ${BORD_GAUCHE} ${riveHaut - DEUX_D}`,
        `H ${BORD_GAUCHE + COTE}`,
        `A ${DEUX_D} ${DEUX_D} 0 0 1 ${BORD_GAUCHE + COTE + DEUX_D} ${riveHaut}`,
        `V ${riveHaut + COTE}`,
        `A ${DEUX_D} ${DEUX_D} 0 0 1 ${BORD_GAUCHE + COTE} ${riveHaut + COTE + DEUX_D}`,
        `H ${BORD_GAUCHE}`,
      ].join(' '),
      etiquette: { x: BORD_GAUCHE + COTE + DEUX_D + 18, y: riveHaut + 10 },
    },
    {
      position: 'angle',
      nom: "poteau d'angle",
      poteau: { x: angleX, y: angleHaut },
      // Contour ouvert aux DEUX bords libres : il ne reste qu'un quart de tour.
      perimetre: [
        `M ${angleX} ${angleHaut - DEUX_D}`,
        `H ${angleX + COTE}`,
        `A ${DEUX_D} ${DEUX_D} 0 0 1 ${angleX + COTE + DEUX_D} ${angleHaut}`,
        `V ${BORD_BAS}`,
      ].join(' '),
      etiquette: { x: angleX + COTE + DEUX_D + 18, y: angleHaut + 10 },
    },
  ];
}

/** Nombre a la francaise : la virgule decimale, comme sur une note de calcul. */
function virgule(valeur: number): string {
  return String(valeur).replace('.', ',');
}

/** Echappement du texte insere dans le SVG. */
function texte(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Un cas : son perimetre en pointilles, son poteau, son nom et son beta. */
function groupeDuCas(cas: Cas, courante: PositionPoteau): string {
  const estCourante = cas.position === courante;
  const classe = estCourante ? 'position position-courante' : 'position position-retrait';
  const beta = virgule(coefficientBetaSimplifie(cas.position));

  return [
    `<g class="${classe}" data-position="${cas.position}">`,
    `<path data-role="perimetre" class="perimetre" d="${cas.perimetre}" />`,
    `<rect data-role="poteau" class="poteau" x="${cas.poteau.x}" y="${cas.poteau.y}"`,
    ` width="${COTE}" height="${COTE}" />`,
    `<text data-role="nom" class="nom" x="${cas.etiquette.x}" y="${cas.etiquette.y}">`,
    `${texte(cas.nom)}</text>`,
    `<text data-role="beta" class="beta" x="${cas.etiquette.x}" y="${cas.etiquette.y + 22}">`,
    `${texte(`β = ${beta}`)}</text>`,
    '</g>',
  ].join('');
}

/**
 * Conditions du §6.4.3(6), sans lesquelles ces trois nombres ne valent rien.
 *
 * Elles sont ECRITES SOUS LE SCHEMA, et non renvoyees a une documentation : un
 * utilisateur qui prend 1,15 hors de ces conditions se trompe en silence.
 */
const CONDITIONS = [
  "§6.4.3(6) — ces trois valeurs ne valent que si la stabilite laterale de la structure",
  "ne depend pas d'un effet de cadre entre dalles et poteaux, ET si les portees adjacentes",
  "ne different pas de plus de 25 %. Hors de ces conditions, β se calcule par W1",
  '(§6.4.3(3) a (5)), calcul hors du domaine de cet outil : imposez alors votre valeur.',
];

/**
 * Vue en plan d'un coin de dalle portant les trois positions de poteau, chacune
 * avec son perimetre de controle et son coefficient beta. La position
 * `courante` est mise en evidence ; les deux autres restent visibles, en
 * retrait, pour que la comparaison soit possible.
 */
export function schemaDesPositions(courante: PositionPoteau): string {
  const cas = casDeFigure().map((un) => groupeDuCas(un, courante));

  const conditions = CONDITIONS.map(
    (ligne, index) =>
      `<text class="conditions" x="${BORD_GAUCHE}" y="${BORD_BAS + 34 + index * 17}">` +
      `${texte(ligne)}</text>`,
  ).join('');

  return [
    `<svg viewBox="0 0 ${LARGEUR} ${HAUTEUR}" class="schema-positions" role="img"`,
    ' aria-label="Les trois positions de poteau et leur coefficient beta simplifie">',
    '<g class="dalle">',
    `<rect class="dalle-fond" x="${BORD_GAUCHE}" y="${BORD_HAUT}"`,
    ` width="${BORD_DROIT - BORD_GAUCHE}" height="${BORD_BAS - BORD_HAUT}" />`,
    `<path class="bord-libre" d="M ${BORD_GAUCHE} ${BORD_HAUT} V ${BORD_BAS}`,
    ` H ${BORD_DROIT}" />`,
    `<text class="bord-libre-nom" x="${BORD_GAUCHE + 6}" y="${BORD_HAUT + 18}">`,
    'bords libres de la dalle</text>',
    '</g>',
    ...cas,
    conditions,
    '</svg>',
  ].join('');
}
