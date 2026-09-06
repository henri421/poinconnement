/**
 * Perimetres de controle du poinconnement — EN 1992-1-1:2004 §6.4.2 et §6.4.5(3).
 *
 * L EC2 definit le perimetre de controle de base `u1` comme le contour situe a
 * 2d de l aire chargee, de longueur minimale, tronque aux bords libres. Les
 * manuels en tirent une table de cas — interieur, rive, angle, rectangulaire,
 * circulaire — dont chaque ligne est une occasion de se tromper.
 *
 * On implemente ici la DEFINITION : un seul decalage de l aire chargee, ecrete
 * aux bords libres. Les cas de la table en decoulent, et les deux formes
 * fermees connues — 2(c1 + c2) + 4*pi*d pour un rectangle interieur,
 * pi*(D + 4d) pour un cercle interieur — servent de preuve a la construction.
 *
 * Convention de reperage : le bord libre est la droite x = 0 (dalle en x >= 0)
 * pour un poteau de rive ; les bords libres sont x = 0 et y = 0 (dalle dans le
 * quart de plan x >= 0, y >= 0) pour un poteau d angle. Le poteau est suppose
 * affleurant le ou les bords libres — hypothese usuelle, et conservative : un
 * poteau en retrait du bord offrirait un perimetre plus long.
 *
 * Unites : mm.
 */

export type PositionPoteau = 'interieur' | 'rive' | 'angle';

export interface Poteau {
  forme: 'rectangulaire' | 'circulaire';
  /** Rectangulaire : cote perpendiculaire au bord libre (mm). */
  c1?: number;
  /** Rectangulaire : cote parallele au bord libre (mm). */
  c2?: number;
  /** Circulaire : diametre (mm). */
  D?: number;
  position: PositionPoteau;
}

interface Point {
  x: number;
  y: number;
}

/** Demi-plan `nx*x + ny*y + c >= 0`, la normale (nx, ny) etant unitaire. */
interface DemiPlan {
  nx: number;
  ny: number;
  c: number;
}

interface Segment {
  type: 'segment';
  depart: Point;
  arrivee: Point;
}

interface Arc {
  type: 'arc';
  centre: Point;
  rayon: number;
  /** Angles en radians, parcourus dans le sens trigonometrique. */
  angleDepart: number;
  angleArrivee: number;
}

type Primitive = Segment | Arc;

/** Intervalle ferme de reels, utilise pour l ecretage. */
interface Intervalle {
  min: number;
  max: number;
}

const TOLERANCE_NULLE = 1e-12;

/**
 * Aire chargee : soit un polygone convexe donne dans le sens trigonometrique,
 * soit un disque.
 */
type AireChargee =
  | { type: 'polygone'; sommets: Point[] }
  | { type: 'disque'; centre: Point; rayon: number };

/**
 * Cotes d un poteau rectangulaire, validees. Rendre les valeurs plutot que de
 * les relire ensuite evite toute assertion de type sur des champs optionnels.
 */
function cotesRectangle(poteau: Poteau): { c1: number; c2: number } {
  const { c1, c2 } = poteau;
  if (c1 === undefined || !Number.isFinite(c1) || c1 <= 0) {
    throw new Error('Poteau rectangulaire : c1 doit etre une longueur strictement positive (mm).');
  }
  if (c2 === undefined || !Number.isFinite(c2) || c2 <= 0) {
    throw new Error('Poteau rectangulaire : c2 doit etre une longueur strictement positive (mm).');
  }
  return { c1, c2 };
}

/** Diametre d un poteau circulaire, valide. */
function diametreCercle(poteau: Poteau): number {
  const { D } = poteau;
  if (D === undefined || !Number.isFinite(D) || D <= 0) {
    throw new Error('Poteau circulaire : D doit etre une longueur strictement positive (mm).');
  }
  return D;
}

/**
 * Aire chargee placee dans le repere : affleurant le bord libre x = 0 pour une
 * rive, le coin (0, 0) pour un angle, centree a l origine a l interieur.
 */
function aireChargee(poteau: Poteau): AireChargee {
  if (poteau.forme === 'rectangulaire') {
    const { c1, c2 } = cotesRectangle(poteau);
    // c1 porte par l axe x (perpendiculaire au bord libre), c2 par l axe y.
    const origine: Point =
      poteau.position === 'interieur'
        ? { x: -c1 / 2, y: -c2 / 2 }
        : poteau.position === 'rive'
          ? { x: 0, y: -c2 / 2 }
          : { x: 0, y: 0 };
    return {
      type: 'polygone',
      sommets: [
        { x: origine.x, y: origine.y },
        { x: origine.x + c1, y: origine.y },
        { x: origine.x + c1, y: origine.y + c2 },
        { x: origine.x, y: origine.y + c2 },
      ],
    };
  }

  const rayon = diametreCercle(poteau) / 2;
  const centre: Point =
    poteau.position === 'interieur'
      ? { x: 0, y: 0 }
      : poteau.position === 'rive'
        ? { x: rayon, y: 0 }
        : { x: rayon, y: rayon };
  return { type: 'disque', centre, rayon };
}

/** Demi-plans decrivant la dalle : rien a l interieur, un ou deux bords libres sinon. */
function demiPlansDeLaDalle(position: PositionPoteau): DemiPlan[] {
  switch (position) {
    case 'interieur':
      return [];
    case 'rive':
      return [{ nx: 1, ny: 0, c: 0 }];
    case 'angle':
      return [
        { nx: 1, ny: 0, c: 0 },
        { nx: 0, ny: 1, c: 0 },
      ];
  }
}

/**
 * Contour de l aire chargee decalee de `a` : un segment parallele par cote, un
 * arc de rayon `a` par sommet. Pour un disque, un cercle de rayon augmente.
 * Avec `a = 0`, les arcs sont de longueur nulle et le contour redonne l aire
 * chargee elle-meme.
 */
function contourDecale(aire: AireChargee, a: number): Primitive[] {
  if (aire.type === 'disque') {
    return [
      {
        type: 'arc',
        centre: aire.centre,
        rayon: aire.rayon + a,
        angleDepart: 0,
        angleArrivee: 2 * Math.PI,
      },
    ];
  }

  const sommets = aire.sommets;
  const nombre = sommets.length;
  // Normale exterieure de chaque cote, le polygone etant parcouru dans le sens
  // trigonometrique : la normale exterieure du vecteur (dx, dy) est (dy, -dx).
  const normales: Point[] = sommets.map((depart, index) => {
    const arrivee = sommets[(index + 1) % nombre];
    const dx = arrivee.x - depart.x;
    const dy = arrivee.y - depart.y;
    const longueur = Math.hypot(dx, dy);
    return { x: dy / longueur, y: -dx / longueur };
  });

  const primitives: Primitive[] = [];
  for (let index = 0; index < nombre; index += 1) {
    const depart = sommets[index];
    const arrivee = sommets[(index + 1) % nombre];
    const normale = normales[index];
    primitives.push({
      type: 'segment',
      depart: { x: depart.x + a * normale.x, y: depart.y + a * normale.y },
      arrivee: { x: arrivee.x + a * normale.x, y: arrivee.y + a * normale.y },
    });

    // Arc de raccordement au sommet d arrivee, entre les deux normales.
    const normaleSuivante = normales[(index + 1) % nombre];
    const angleDepart = Math.atan2(normale.y, normale.x);
    let angleArrivee = Math.atan2(normaleSuivante.y, normaleSuivante.x);
    // Le polygone etant convexe et parcouru dans le sens trigonometrique, l arc
    // tourne dans ce meme sens d un angle compris entre 0 et pi.
    while (angleArrivee < angleDepart) {
      angleArrivee += 2 * Math.PI;
    }
    primitives.push({
      type: 'arc',
      centre: arrivee,
      rayon: a,
      angleDepart,
      angleArrivee,
    });
  }
  return primitives;
}

/** Intersection d une liste d intervalles disjoints croissants avec un intervalle. */
function intersecter(intervalles: Intervalle[], autre: Intervalle[]): Intervalle[] {
  const resultat: Intervalle[] = [];
  for (const un of intervalles) {
    for (const deux of autre) {
      const min = Math.max(un.min, deux.min);
      const max = Math.min(un.max, deux.max);
      if (max > min) {
        resultat.push({ min, max });
      }
    }
  }
  return resultat;
}

/** Longueur du segment situee dans l intersection des demi-plans. */
function longueurSegmentDansDalle(segment: Segment, demiPlans: DemiPlan[]): number {
  const dx = segment.arrivee.x - segment.depart.x;
  const dy = segment.arrivee.y - segment.depart.y;
  const longueur = Math.hypot(dx, dy);
  if (longueur <= TOLERANCE_NULLE) {
    return 0;
  }

  let tMin = 0;
  let tMax = 1;
  for (const plan of demiPlans) {
    // Valeur du demi-plan le long du segment : constante + pente * t.
    const constante = plan.nx * segment.depart.x + plan.ny * segment.depart.y + plan.c;
    const pente = plan.nx * dx + plan.ny * dy;
    if (Math.abs(pente) <= TOLERANCE_NULLE * longueur) {
      // Segment parallele au bord libre. S il est au-dela du bord, ou exactement
      // dessus — le cote du poteau qui affleure la rive, a la distance a = 0 —,
      // il ne porte aucune longueur de contour : il n a pas de dalle a resister.
      if (constante <= 0) {
        return 0;
      }
      continue;
    }
    const tRacine = -constante / pente;
    if (pente > 0) {
      tMin = Math.max(tMin, tRacine);
    } else {
      tMax = Math.min(tMax, tRacine);
    }
  }
  return Math.max(0, tMax - tMin) * longueur;
}

/** Longueur de l arc situee dans l intersection des demi-plans. */
function longueurArcDansDalle(arc: Arc, demiPlans: DemiPlan[]): number {
  if (arc.rayon <= TOLERANCE_NULLE) {
    return 0;
  }

  let intervalles: Intervalle[] = [{ min: arc.angleDepart, max: arc.angleArrivee }];
  for (const plan of demiPlans) {
    // Le point d angle theta est dans le demi-plan si
    // constante + rayon * cos(theta - orientation) >= 0.
    const constante = plan.nx * arc.centre.x + plan.ny * arc.centre.y + plan.c;
    const rapport = -constante / arc.rayon;
    if (rapport <= -1) {
      continue; // Arc entierement dans le demi-plan.
    }
    if (rapport >= 1) {
      return 0; // Arc entierement hors du demi-plan.
    }
    const orientation = Math.atan2(plan.ny, plan.nx);
    const demiOuverture = Math.acos(rapport);
    // L ensemble admissible est periodique : on couvre toutes les periodes
    // susceptibles de rencontrer l intervalle de l arc.
    const kMin = Math.floor((arc.angleDepart - orientation - demiOuverture) / (2 * Math.PI)) - 1;
    const kMax = Math.ceil((arc.angleArrivee - orientation + demiOuverture) / (2 * Math.PI)) + 1;
    const admissibles: Intervalle[] = [];
    for (let k = kMin; k <= kMax; k += 1) {
      const centreAngulaire = orientation + 2 * k * Math.PI;
      admissibles.push({
        min: centreAngulaire - demiOuverture,
        max: centreAngulaire + demiOuverture,
      });
    }
    intervalles = intersecter(intervalles, admissibles);
    if (intervalles.length === 0) {
      return 0;
    }
  }

  const ouverture = intervalles.reduce((somme, un) => somme + (un.max - un.min), 0);
  return ouverture * arc.rayon;
}

/**
 * Longueur du contour situe a la distance `a` de l aire chargee (mm), tronque
 * aux bords libres de la dalle.
 *
 * Le perimetre de controle de base `u1` du §6.4.2 s obtient avec `a = 2d`.
 */
export function perimetreDeControle(poteau: Poteau, a: number): number {
  if (!Number.isFinite(a) || a < 0) {
    throw new Error('La distance a l aire chargee doit etre un nombre positif ou nul (mm).');
  }

  const demiPlans = demiPlansDeLaDalle(poteau.position);
  const primitives = contourDecale(aireChargee(poteau), a);

  return primitives.reduce((somme, primitive) => {
    const longueur =
      primitive.type === 'segment'
        ? longueurSegmentDansDalle(primitive, demiPlans)
        : longueurArcDansDalle(primitive, demiPlans);
    return somme + longueur;
  }, 0);
}

/**
 * Perimetre de l aire chargee `u0` (mm), au sens du §6.4.5(3), sur lequel se
 * verifie l ecrasement du beton au nu du poteau.
 *
 * - poteau interieur : le perimetre du poteau ;
 * - poteau de rive : `c2 + 3d`, plafonne a `c2 + 2*c1` ;
 * - poteau d angle : `3d`, plafonne a `c1 + c2`.
 *
 * Les deux plafonds sont exactement le contour geometrique tronque au bord
 * libre, c est-a-dire `perimetreDeControle(poteau, 0)` : la meme construction
 * les fournit, sans table.
 *
 * Le §6.4.5(3) n enonce rien pour un poteau CIRCULAIRE de rive ou d angle.
 * Rendre le contour geometrique serait non conservatif — un cercle affleurant
 * un bord libre n y perd aucune longueur — et transposer `3d` serait inventer
 * une expression que la norme ne donne pas : l outil refuse le cas.
 */
export function perimetreAuNu(poteau: Poteau, d: number): number {
  if (!Number.isFinite(d) || d <= 0) {
    throw new Error('La hauteur utile d doit etre un nombre strictement positif (mm).');
  }

  const contourTronque = perimetreDeControle(poteau, 0);
  if (poteau.position === 'interieur') {
    return contourTronque;
  }
  if (poteau.forme === 'circulaire') {
    throw new Error(
      "Le §6.4.5(3) de l'EN 1992-1-1:2004 ne donne pas u0 pour un poteau circulaire " +
        "de rive ou d'angle : cas hors du domaine de l'outil.",
    );
  }

  const { c2 } = cotesRectangle(poteau);
  const valeurNormative = poteau.position === 'rive' ? c2 + 3 * d : 3 * d;
  return Math.min(valeurNormative, contourTronque);
}
