/**
 * Mise en forme du resultat de poinconnement : verdict, grandeurs, trace en
 * plan, avertissements.
 *
 * Module PUR : il rend des chaines. Aucun calcul de resistance ne s'y trouve —
 * toutes les valeurs viennent du noyau, et les seules longueurs calculees ici
 * sont celles du DESSIN, qui ne participe a aucune verification.
 */

import {
  perimetreDeControle,
  type PositionPoteau,
  type Poteau,
  type ResultatPoinconnement,
  type Verdict,
} from '../../src/index';

/** Une grandeur du calcul, telle qu'elle se lit dans le tableau. */
export interface LigneResultat {
  symbole: string;
  libelle: string;
  valeur: string;
}

/** Echappement de tout texte insere dans du HTML ou du SVG. */
export function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Nombre affiche a la francaise, virgule decimale comprise.
 *
 * Un NaN ou un infini ne doit JAMAIS atteindre l'ecran : il s'y lit comme une
 * valeur alors qu'il signale une absence de valeur. On rend un tiret.
 */
export function nombreFr(valeur: number, decimales: number): string {
  if (!Number.isFinite(valeur)) {
    return '—';
  }
  return valeur.toFixed(decimales).replace('.', ',');
}

/**
 * Avertissement obligatoire sur les poteaux de rive et d'angle.
 *
 * Le perimetre de controle est construit ici par offset a 2d ecrete au bord
 * libre. L'EN 1992-1-1 prevoit, pour ces deux positions, de retenir un
 * perimetre PLUS COURT lorsque sa figure en donne un — disposition qui n'est
 * PAS implementee. Ne pas l'appliquer surestime `u1`, donc SOUS-ESTIME `v_Ed` :
 * l'erreur va dans le sens defavorable. Elle doit se lire a cote du resultat,
 * pas dans une documentation que personne n'ouvre.
 */
export function avertissementPerimetre(position: PositionPoteau): string | null {
  if (position === 'interieur') {
    return null;
  }
  const nom = position === 'rive' ? 'de rive' : "d'angle";
  return (
    `Poteau ${nom} : le perimetre de controle retenu ici est l'offset a 2d ecrete au bord ` +
    "libre. L'EN 1992-1-1 prevoit, pour cette position, de retenir un perimetre PLUS COURT " +
    "lorsque sa figure en donne un ; cette disposition n'est pas implementee. Ne pas " +
    "l'appliquer surestime u1, donc sous-estime v_Ed : le resultat ci-dessous peut etre " +
    'NON CONSERVATIF. A verifier a la main, en particulier sur un poteau allonge.'
  );
}

/**
 * Titre du verdict.
 *
 * Les trois doivent se lire differemment : « dalle trop mince » n'est pas
 * « il manque des armatures », puisque aucune armature n'y remedie.
 */
export function titreDuVerdict(verdict: Verdict): string {
  switch (verdict) {
    case 'aucune-armature-requise':
      return 'Aucune armature de poinconnement requise';
    case 'dalle-trop-mince':
      return "Dalle trop mince : ecrasement du beton au nu du poteau";
    case 'armatures-necessaires':
      return 'Armatures de poinconnement a prevoir';
  }
}

/** Classe du verdict, pour que les trois se distinguent aussi a l'oeil. */
export function classeDuVerdict(verdict: Verdict): string {
  switch (verdict) {
    case 'aucune-armature-requise':
      return 'verdict-sans-armatures';
    case 'dalle-trop-mince':
      return 'verdict-impossible';
    case 'armatures-necessaires':
      return 'verdict-armatures';
  }
}

/** Toutes les grandeurs du calcul, dans l'ordre ou on les relit. */
export function lignesDuResultat(resultat: ResultatPoinconnement): LigneResultat[] {
  const lignes: LigneResultat[] = [
    { symbole: 'd', libelle: 'hauteur utile moyenne (d_y + d_z)/2', valeur: `${nombreFr(resultat.d, 1)} mm` },
    { symbole: 'β', libelle: "coefficient d'excentrement", valeur: nombreFr(resultat.beta, 3) },
    { symbole: 'u0', libelle: 'perimetre au nu du poteau', valeur: `${nombreFr(resultat.u0, 0)} mm` },
    { symbole: 'u1', libelle: 'perimetre de controle de base, a 2d', valeur: `${nombreFr(resultat.u1, 0)} mm` },
    { symbole: 'v_Ed(u0)', libelle: 'contrainte sollicitante au nu', valeur: `${nombreFr(resultat.v_Ed_u0, 3)} MPa` },
    { symbole: 'v_Ed(u1)', libelle: 'contrainte sollicitante sur u1', valeur: `${nombreFr(resultat.v_Ed_u1, 3)} MPa` },
    { symbole: 'v_Rd,c', libelle: 'resistance sans armatures, eq. (6.47)', valeur: `${nombreFr(resultat.v_Rd_c, 3)} MPa` },
    { symbole: 'v_Rd,max', libelle: 'ecrasement admissible au nu, §6.4.5(3)', valeur: `${nombreFr(resultat.v_Rd_max, 3)} MPa` },
  ];

  if (resultat.A_sw_requis !== undefined) {
    lignes.push({
      symbole: 'A_sw',
      libelle: "aire d'armatures par cours satisfaisant l'eq. (6.52)",
      valeur: `${nombreFr(resultat.A_sw_requis, 0)} mm2`,
    });
  }
  if (resultat.u_out_ef !== undefined) {
    lignes.push({
      symbole: 'u_out,ef',
      libelle: 'perimetre au-dela duquel les armatures sont inutiles',
      valeur: `${nombreFr(resultat.u_out_ef, 0)} mm`,
    });
  }
  return lignes;
}

/**
 * Note eventuelle sur `u0`, quand la valeur normative est plus courte que le
 * contour dessine.
 *
 * En rive et en angle, le §6.4.5(3) plafonne `u0` a `c2 + 3d` (rive) ou `3d`
 * (angle). Quand ce plafond mord, le nombre affiche n'est plus la longueur du
 * trait dessine : il faut le dire, sous peine de laisser croire a une erreur de
 * dessin ou, pire, a une erreur de calcul.
 */
export function noteSurU0(poteau: Poteau, resultat: ResultatPoinconnement): string | null {
  if (poteau.position === 'interieur' || poteau.forme !== 'rectangulaire') {
    return null;
  }
  const contourDessine = perimetreDeControle(poteau, 0);
  if (resultat.u0 >= contourDessine - 1e-9) {
    return null;
  }
  return (
    `u0 retenu = ${nombreFr(resultat.u0, 0)} mm : c'est la valeur du §6.4.5(3), plus courte ` +
    `que le contour du poteau en contact avec la dalle (${nombreFr(contourDessine, 0)} mm) ` +
    'que montre le trace. Le calcul retient la plus petite des deux.'
  );
}

/** Message d'erreur lisible, quelle que soit la nature de ce qui a ete leve. */
export function messageDErreur(erreur: unknown): string {
  const detail =
    erreur instanceof Error && erreur.message !== ''
      ? erreur.message
      : "cause inconnue. Verifiez les valeurs saisies.";
  return `Calcul impossible : ${detail}`;
}

// ---------------------------------------------------------------------------
// Trace en plan
// ---------------------------------------------------------------------------

/** Rectangle du modele (mm), axes y vers le haut, convention du noyau. */
interface Boite {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Geometrie du poteau dans le repere du noyau, prete a dessiner. */
type Forme =
  | { type: 'rectangle'; boite: Boite }
  | { type: 'disque'; cx: number; cy: number; r: number };

/** Cote strictement positif, ou refus : un trace sur une cote nulle n'a aucun sens. */
function coteValide(valeur: number | undefined, nom: string): number {
  if (valeur === undefined || !Number.isFinite(valeur) || valeur <= 0) {
    throw new Error(`Le trace demande ${nom} strictement positif (mm).`);
  }
  return valeur;
}

/**
 * Aire chargee placee comme le fait le noyau : centree a l'origine a
 * l'interieur, affleurant x = 0 en rive, le coin (0, 0) en angle.
 */
function formeDuPoteau(poteau: Poteau): Forme {
  if (poteau.forme === 'rectangulaire') {
    const c1 = coteValide(poteau.c1, 'c1');
    const c2 = coteValide(poteau.c2, 'c2');
    switch (poteau.position) {
      case 'interieur':
        return { type: 'rectangle', boite: { xMin: -c1 / 2, xMax: c1 / 2, yMin: -c2 / 2, yMax: c2 / 2 } };
      case 'rive':
        return { type: 'rectangle', boite: { xMin: 0, xMax: c1, yMin: -c2 / 2, yMax: c2 / 2 } };
      case 'angle':
        return { type: 'rectangle', boite: { xMin: 0, xMax: c1, yMin: 0, yMax: c2 } };
    }
  }
  const r = coteValide(poteau.D, 'D') / 2;
  switch (poteau.position) {
    case 'interieur':
      return { type: 'disque', cx: 0, cy: 0, r };
    case 'rive':
      return { type: 'disque', cx: r, cy: 0, r };
    case 'angle':
      return { type: 'disque', cx: r, cy: r, r };
  }
}

/** Boite englobante de la forme dilatee de `a`. */
function boiteDilatee(forme: Forme, a: number): Boite {
  if (forme.type === 'rectangle') {
    const { boite } = forme;
    return {
      xMin: boite.xMin - a,
      xMax: boite.xMax + a,
      yMin: boite.yMin - a,
      yMax: boite.yMax + a,
    };
  }
  return {
    xMin: forme.cx - forme.r - a,
    xMax: forme.cx + forme.r + a,
    yMin: forme.cy - forme.r - a,
    yMax: forme.cy + forme.r + a,
  };
}

/** Coordonnee courte, pour un SVG lisible et sans flottant a rallonge. */
function co(valeur: number): string {
  return String(Number(valeur.toFixed(2)));
}

/**
 * Rectangle arrondi de rayon `a` autour de la boite, en coordonnees SVG
 * (Y vers le bas). C'est exactement le contour a distance `a` d'un rectangle :
 * un cote decale par cote, un quart de cercle par sommet.
 */
function contourDilate(boite: Boite, a: number): string {
  // Passage au repere SVG : le haut du dessin est y = yMax.
  const gauche = boite.xMin;
  const droite = boite.xMax;
  const haut = -boite.yMax;
  const bas = -boite.yMin;

  // A distance nulle, le contour est le rectangle lui-meme : les quarts de
  // cercle y seraient de rayon nul, ce que SVG traite en segment degenere.
  if (a === 0) {
    return [
      `M ${co(gauche)} ${co(haut)}`,
      `H ${co(droite)}`,
      `V ${co(bas)}`,
      `H ${co(gauche)}`,
      'Z',
    ].join(' ');
  }

  const r = `${co(a)} ${co(a)} 0 0 1`;

  return [
    `M ${co(gauche)} ${co(haut - a)}`,
    `H ${co(droite)}`,
    `A ${r} ${co(droite + a)} ${co(haut)}`,
    `V ${co(bas)}`,
    `A ${r} ${co(droite)} ${co(bas + a)}`,
    `H ${co(gauche)}`,
    `A ${r} ${co(gauche - a)} ${co(bas)}`,
    `V ${co(haut)}`,
    `A ${r} ${co(gauche)} ${co(haut - a)}`,
    'Z',
  ].join(' ');
}

/** Element SVG du contour a distance `a`, avec son role et sa classe. */
function elementDuContour(forme: Forme, a: number, role: string, classe: string): string {
  const attributs = `data-role="${role}" class="${classe}" clip-path="url(#dalle-utile)"`;
  if (forme.type === 'rectangle') {
    return `<path ${attributs} d="${contourDilate(forme.boite, a)}" />`;
  }
  return (
    `<circle ${attributs} cx="${co(forme.cx)}" cy="${co(-forme.cy)}" ` +
    `r="${co(forme.r + a)}" />`
  );
}

/** Le poteau lui-meme, plein, non ecrete : c'est le repere du lecteur. */
function elementDuPoteau(forme: Forme): string {
  if (forme.type === 'rectangle') {
    const { boite } = forme;
    return (
      `<rect data-role="poteau" class="poteau" x="${co(boite.xMin)}" y="${co(-boite.yMax)}" ` +
      `width="${co(boite.xMax - boite.xMin)}" height="${co(boite.yMax - boite.yMin)}" />`
    );
  }
  return (
    `<circle data-role="poteau" class="poteau" cx="${co(forme.cx)}" cy="${co(-forme.cy)}" ` +
    `r="${co(forme.r)}" />`
  );
}

/** Partie de la vue occupee par la dalle, selon la position du poteau. */
function boiteDeLaDalle(position: PositionPoteau, vue: Boite): Boite {
  switch (position) {
    case 'interieur':
      return vue;
    case 'rive':
      return { ...vue, xMin: 0 };
    case 'angle':
      return { ...vue, xMin: 0, yMin: 0 };
  }
}

/** Traits des bords libres : un en rive, deux en angle, aucun a l'interieur. */
function bordsLibres(position: PositionPoteau, dalle: Boite): string[] {
  const vertical =
    `<line data-role="bord-libre" class="bord-libre" x1="0" y1="${co(-dalle.yMax)}" ` +
    `x2="0" y2="${co(-dalle.yMin)}" />`;
  const horizontal =
    `<line data-role="bord-libre" class="bord-libre" x1="${co(dalle.xMin)}" y1="0" ` +
    `x2="${co(dalle.xMax)}" y2="0" />`;

  switch (position) {
    case 'interieur':
      return [];
    case 'rive':
      return [vertical];
    case 'angle':
      return [vertical, horizontal];
  }
}

/**
 * Vue en plan A L'ECHELLE du poteau, de son perimetre au nu et de son perimetre
 * de controle a 2d, ecretes aux bords libres.
 *
 * L'ecretage est confie a un `clipPath` pose sur la dalle : le dessin applique
 * ainsi la MEME definition que le noyau — le contour decale, coupe au bord
 * libre — sans reimplementer sa geometrie, donc sans risque d'en diverger.
 *
 * Aucun texte n'est place dans ce SVG : il est a l'echelle du modele, en
 * millimetres, ou une police n'aurait pas de taille lisible. Les valeurs se
 * lisent dans le tableau qui l'accompagne.
 */
export function schemaDuPoteau(poteau: Poteau, d: number): string {
  if (!Number.isFinite(d) || d <= 0) {
    throw new Error('Le trace demande une hauteur utile d strictement positive (mm).');
  }
  const forme = formeDuPoteau(poteau);
  const a = 2 * d;

  const contour = boiteDilatee(forme, a);
  const marge = 0.08 * Math.max(contour.xMax - contour.xMin, contour.yMax - contour.yMin);
  // Au-dela d'un bord libre il n'y a pas de dalle, et le contour y est ecrete :
  // etendre la vue de ce cote ne montrerait qu'un vide, et retrecirait d'autant
  // le dessin utile. On n'en garde qu'un liseré, pour que le bord se lise.
  const bordLibreEnX = poteau.position !== 'interieur';
  const bordLibreEnY = poteau.position === 'angle';
  const vue: Boite = {
    xMin: bordLibreEnX ? -marge : contour.xMin - marge,
    xMax: contour.xMax + marge,
    yMin: bordLibreEnY ? -marge : contour.yMin - marge,
    yMax: contour.yMax + marge,
  };
  const dalle = boiteDeLaDalle(poteau.position, vue);

  const rectangleDalle =
    `x="${co(dalle.xMin)}" y="${co(-dalle.yMax)}" ` +
    `width="${co(dalle.xMax - dalle.xMin)}" height="${co(dalle.yMax - dalle.yMin)}"`;

  return [
    `<svg viewBox="${co(vue.xMin)} ${co(-vue.yMax)} ${co(vue.xMax - vue.xMin)} `,
    `${co(vue.yMax - vue.yMin)}" class="schema-poteau" role="img"`,
    ' aria-label="Trace en plan du poteau et de ses perimetres de controle">',
    `<defs><clipPath id="dalle-utile"><rect ${rectangleDalle} /></clipPath></defs>`,
    `<rect data-role="dalle" class="dalle" ${rectangleDalle} />`,
    elementDuContour(forme, a, 'perimetre-u1', 'perimetre-u1'),
    elementDuContour(forme, 0, 'perimetre-u0', 'perimetre-u0'),
    elementDuPoteau(forme),
    ...bordsLibres(poteau.position, dalle),
    '</svg>',
  ].join('');
}

// ---------------------------------------------------------------------------
// Bloc de resultat
// ---------------------------------------------------------------------------

function tableauDesGrandeurs(resultat: ResultatPoinconnement): string {
  const lignes = lignesDuResultat(resultat)
    .map(
      (ligne) =>
        `<tr><th scope="row">${echapper(ligne.symbole)}</th>` +
        `<td class="libelle">${echapper(ligne.libelle)}</td>` +
        `<td class="valeur">${echapper(ligne.valeur)}</td></tr>`,
    )
    .join('');
  return `<table class="grandeurs"><tbody>${lignes}</tbody></table>`;
}

/**
 * Bloc de resultat complet : le verdict, son motif repris VERBATIM du noyau —
 * c'est lui qui distingue deja les trois diagnostics —, l'avertissement de
 * perimetre le cas echeant, et les grandeurs du calcul.
 */
export function rendreResultat(resultat: ResultatPoinconnement, poteau: Poteau): string {
  const avertissement = avertissementPerimetre(poteau.position);
  const note = noteSurU0(poteau, resultat);

  return [
    '<div class="resultat">',
    `<p data-role="verdict" data-verdict="${resultat.verdict}"`,
    ` class="verdict ${classeDuVerdict(resultat.verdict)}">`,
    `${echapper(titreDuVerdict(resultat.verdict))}</p>`,
    `<p data-role="motif" class="motif">${echapper(resultat.motif)}</p>`,
    avertissement === null
      ? ''
      : `<p data-role="avertissement-perimetre" class="alerte">${echapper(avertissement)}</p>`,
    tableauDesGrandeurs(resultat),
    note === null ? '' : `<p data-role="note-u0" class="note">${echapper(note)}</p>`,
    '</div>',
  ].join('');
}
