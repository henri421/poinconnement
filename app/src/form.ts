/**
 * Saisie de l'interface : le modele, sa lecture depuis les champs, et sa
 * traduction en donnees du noyau.
 *
 * Module PUR : il ne connait ni le document, ni les elements de formulaire. Le
 * cablage lui passe des chaines, il rend un modele ou un refus motive. C'est ce
 * qui rend la saisie testable sans navigateur.
 *
 * Unites de l'interface : longueurs en mm, efforts en kN, contraintes en MPa,
 * angle des armatures en DEGRES — plus naturel a saisir que des radians.
 */

import type { DonneesPoinconnement, PositionPoteau } from '../../src/index';

export type FormePoteau = 'rectangulaire' | 'circulaire';

export interface ModeleSaisie {
  /** Hauteur utile direction y (mm). */
  d_y: number;
  /** Hauteur utile direction z (mm). */
  d_z: number;
  /** Resistance caracteristique du beton (MPa). */
  f_ck: number;
  /** Taux d'armature longitudinale tendue, direction y (-). */
  rho_ly: number;
  /** Taux d'armature longitudinale tendue, direction z (-). */
  rho_lz: number;

  forme: FormePoteau;
  /** Rectangulaire : cote perpendiculaire au bord libre (mm). */
  c1: number;
  /** Rectangulaire : cote parallele au bord libre (mm). */
  c2: number;
  /** Circulaire : diametre (mm). */
  D: number;
  position: PositionPoteau;

  /** Effort de poinconnement (kN). */
  V_Ed: number;
  /** Beta impose plutot que deduit de la position. */
  betaImpose: boolean;
  beta: number;

  /** Armatures de poinconnement envisagees, pour en deduire l'aire par cours. */
  armatures: boolean;
  /** Espacement radial des cours (mm). */
  s_r: number;
  /** Limite elastique de calcul des armatures (MPa). */
  f_ywd: number;
  /** Angle des armatures avec le plan de la dalle (degres). */
  alpha: number;

  /** Coefficient partiel du beton (-). */
  gamma_c: number;
  /** Coefficient des effets a long terme (-). */
  alpha_cc: number;
}

export type Lecture = { ok: true; modele: ModeleSaisie } | { ok: false; message: string };

const POSITIONS: readonly PositionPoteau[] = ['interieur', 'rive', 'angle'];
const FORMES: readonly FormePoteau[] = ['rectangulaire', 'circulaire'];

/**
 * Dalle de depart : 220 mm d'epaisseur environ, C30/37, poteau 400x400
 * interieur sous 700 kN. Le cas retombe sur « armatures necessaires », qui est
 * celui qui montre le plus de grandeurs — la page instruit des son ouverture.
 */
export function modeleParDefaut(): ModeleSaisie {
  return {
    d_y: 200,
    d_z: 190,
    f_ck: 30,
    rho_ly: 0.008,
    rho_lz: 0.006,
    forme: 'rectangulaire',
    c1: 400,
    c2: 400,
    D: 450,
    position: 'interieur',
    V_Ed: 700,
    betaImpose: false,
    beta: 1.15,
    armatures: true,
    s_r: 150,
    f_ywd: 435,
    alpha: 90,
    gamma_c: 1.5,
    alpha_cc: 1,
  };
}

/**
 * Nombre lu depuis un champ de saisie, ou `null`.
 *
 * La virgule decimale est acceptee : c'est ainsi qu'on ecrit une note de
 * calcul. L'infini est refuse — il traverserait sans bruit tous les tests de
 * finitude du noyau et ressortirait en resultat.
 */
export function lireNombre(texte: string): number | null {
  const nettoye = texte.trim().replace(',', '.');
  if (nettoye === '') {
    return null;
  }
  const valeur = Number(nettoye);
  return Number.isFinite(valeur) ? valeur : null;
}

/** Champs du formulaire correspondant a un modele ; les cases valent oui/non. */
export function champsDepuisModele(modele: ModeleSaisie): Record<string, string> {
  return {
    d_y: String(modele.d_y),
    d_z: String(modele.d_z),
    f_ck: String(modele.f_ck),
    rho_ly: String(modele.rho_ly),
    rho_lz: String(modele.rho_lz),
    forme: modele.forme,
    c1: String(modele.c1),
    c2: String(modele.c2),
    D: String(modele.D),
    position: modele.position,
    V_Ed: String(modele.V_Ed),
    beta_impose: modele.betaImpose ? 'oui' : 'non',
    beta: String(modele.beta),
    armatures: modele.armatures ? 'oui' : 'non',
    s_r: String(modele.s_r),
    f_ywd: String(modele.f_ywd),
    alpha: String(modele.alpha),
    gamma_c: String(modele.gamma_c),
    alpha_cc: String(modele.alpha_cc),
  };
}

/** Echec de lecture, nommant le champ fautif pour qu'on sache ou corriger. */
function refus(champ: string): Lecture {
  return { ok: false, message: `Saisie invalide : le champ ${champ} doit etre un nombre.` };
}

/**
 * Modele lu depuis les champs, ou refus motive.
 *
 * Les champs sans objet ne sont PAS reclames : le diametre d'un poteau
 * rectangulaire, les cotes d'un poteau circulaire, beta tant qu'il n'est pas
 * impose, les armatures tant que la case est decochee. Ils gardent leur valeur
 * precedente, pour qu'un aller-retour entre deux formes ne l'efface pas.
 */
export function modeleDepuisChamps(valeurs: Record<string, string>): Lecture {
  const precedent = modeleParDefaut();

  const forme = valeurs.forme;
  if (!FORMES.includes(forme as FormePoteau)) {
    return { ok: false, message: `Saisie invalide : forme de poteau inconnue « ${forme} ».` };
  }
  const position = valeurs.position;
  if (!POSITIONS.includes(position as PositionPoteau)) {
    return { ok: false, message: `Saisie invalide : position de poteau inconnue « ${position} ».` };
  }

  const betaImpose = valeurs.beta_impose === 'oui';
  const armatures = valeurs.armatures === 'oui';

  /** Champ exige : son absence est un refus. */
  const exige = (nom: string): number | Lecture => lireNombre(valeurs[nom] ?? '') ?? refus(nom);
  /** Champ sans objet dans la configuration courante : on garde le precedent. */
  const facultatif = (nom: string, defaut: number): number =>
    lireNombre(valeurs[nom] ?? '') ?? defaut;

  const requis: Record<string, number> = {};
  const nomsRequis = [
    'd_y',
    'd_z',
    'f_ck',
    'rho_ly',
    'rho_lz',
    'V_Ed',
    'gamma_c',
    'alpha_cc',
    ...(forme === 'rectangulaire' ? ['c1', 'c2'] : ['D']),
    ...(betaImpose ? ['beta'] : []),
    ...(armatures ? ['s_r', 'f_ywd', 'alpha'] : []),
  ];
  for (const nom of nomsRequis) {
    const lu = exige(nom);
    if (typeof lu !== 'number') {
      return lu;
    }
    requis[nom] = lu;
  }

  return {
    ok: true,
    modele: {
      d_y: requis.d_y,
      d_z: requis.d_z,
      f_ck: requis.f_ck,
      rho_ly: requis.rho_ly,
      rho_lz: requis.rho_lz,
      forme: forme as FormePoteau,
      c1: requis.c1 ?? facultatif('c1', precedent.c1),
      c2: requis.c2 ?? facultatif('c2', precedent.c2),
      D: requis.D ?? facultatif('D', precedent.D),
      position: position as PositionPoteau,
      V_Ed: requis.V_Ed,
      betaImpose,
      beta: requis.beta ?? facultatif('beta', precedent.beta),
      armatures,
      s_r: requis.s_r ?? facultatif('s_r', precedent.s_r),
      f_ywd: requis.f_ywd ?? facultatif('f_ywd', precedent.f_ywd),
      alpha: requis.alpha ?? facultatif('alpha', precedent.alpha),
      gamma_c: requis.gamma_c,
      alpha_cc: requis.alpha_cc,
    },
  };
}

/**
 * Radians depuis les degres.
 *
 * L'ordre des operations n'est pas indifferent : `(degres / 180) * PI` rend
 * EXACTEMENT `PI/2` pour 90 degres, la division tombant juste, la ou
 * `degres * PI / 180` peut rendre un flottant au-dessus de `PI/2` — que le
 * noyau refuse, l'angle devant rester dans ]0 ; pi/2].
 */
function radians(degres: number): number {
  return (degres / 180) * Math.PI;
}

/** Donnees du noyau correspondant au modele saisi. */
export function donneesDepuisModele(modele: ModeleSaisie): DonneesPoinconnement {
  return {
    poteau:
      modele.forme === 'rectangulaire'
        ? { forme: 'rectangulaire', c1: modele.c1, c2: modele.c2, position: modele.position }
        : { forme: 'circulaire', D: modele.D, position: modele.position },
    d_y: modele.d_y,
    d_z: modele.d_z,
    f_ck: modele.f_ck,
    rho_ly: modele.rho_ly,
    rho_lz: modele.rho_lz,
    action: {
      V_Ed: modele.V_Ed,
      beta: modele.betaImpose ? modele.beta : undefined,
    },
    gamma_c: modele.gamma_c,
    alpha_cc: modele.alpha_cc,
    armatures: modele.armatures
      ? { s_r: modele.s_r, f_ywd: modele.f_ywd, alpha: radians(modele.alpha) }
      : undefined,
  };
}
