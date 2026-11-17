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

import { lireAnnexe, lireNombre, type AnnexeNationale } from 'aedificium-ui';
import type { DonneesPoinconnement, PositionPoteau } from '../../src/index';
import { textes } from './textes';

export type FormePoteau = 'rectangulaire' | 'circulaire';
/** Armatures longitudinales saisies par leur taux, ou par diametre et espacement. */
export type SaisieAciers = 'taux' | 'barres';

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
  /** Mode de saisie des armatures longitudinales tendues. */
  saisieAciers: SaisieAciers;
  /** Barres de la direction y : diametre et espacement (mm). */
  phi_y: number;
  s_y: number;
  /** Barres de la direction z : diametre et espacement (mm). */
  phi_z: number;
  s_z: number;

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
  /** Annexe nationale (lot E) : preremplit gamma_c et alpha_cc, qui restent modifiables. */
  annexe: AnnexeNationale;
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
    // Par taux : une feuille enregistree avant les barres garde son calcul.
    saisieAciers: 'taux',
    phi_y: 16,
    s_y: 150,
    phi_z: 14,
    s_z: 150,
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
    annexe: 'recommande',
  };
}


export { lireNombre };

/**
 * Aire par metre et taux d'une nappe reguliere de barres (EN 1992-1-1
 * 6.4.4(1)) : `A_s = pi phi^2/4 . 1000/s` (mm2/m), `rho = A_s / (1000 d)`.
 * Les barres sont supposees regulieres sur la bande c + 3d de part et d'autre
 * du poteau, ou le taux est defini.
 */
export function tauxDepuisBarres(phi: number, s: number, d: number): { As: number; rho: number } {
  for (const [nom, v] of [['phi', phi], ['s', s], ['d', d]] as const) {
    if (!(Number.isFinite(v) && v > 0)) throw new Error(`tauxDepuisBarres : ${nom} doit etre strictement positif (mm)`);
  }
  const As = ((Math.PI * phi * phi) / 4) * (1000 / s);
  return { As, rho: As / (1000 * d) };
}

/** Champs du formulaire correspondant a un modele ; les cases valent oui/non. */
export function champsDepuisModele(modele: ModeleSaisie): Record<string, string> {
  return {
    d_y: String(modele.d_y),
    d_z: String(modele.d_z),
    f_ck: String(modele.f_ck),
    rho_ly: String(modele.rho_ly),
    rho_lz: String(modele.rho_lz),
    saisie_aciers: modele.saisieAciers,
    phi_y: String(modele.phi_y),
    s_y: String(modele.s_y),
    phi_z: String(modele.phi_z),
    s_z: String(modele.s_z),
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
    annexe: modele.annexe,
  };
}

/** Echec de lecture, nommant le champ fautif pour qu'on sache ou corriger. */
function refus(champ: string): Lecture {
  return { ok: false, message: textes().saisie.champ(champ) };
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
    return { ok: false, message: textes().saisie.forme(forme) };
  }
  const position = valeurs.position;
  if (!POSITIONS.includes(position as PositionPoteau)) {
    return { ok: false, message: textes().saisie.position(position) };
  }

  const saisieAciers: SaisieAciers = valeurs.saisie_aciers === 'barres' ? 'barres' : 'taux';
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
    ...(saisieAciers === 'barres' ? ['phi_y', 's_y', 'phi_z', 's_z'] : ['rho_ly', 'rho_lz']),
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

  const phi_y = requis.phi_y ?? facultatif('phi_y', precedent.phi_y);
  const s_y = requis.s_y ?? facultatif('s_y', precedent.s_y);
  const phi_z = requis.phi_z ?? facultatif('phi_z', precedent.phi_z);
  const s_z = requis.s_z ?? facultatif('s_z', precedent.s_z);
  let rho_ly: number;
  let rho_lz: number;
  if (saisieAciers === 'barres') {
    try {
      rho_ly = tauxDepuisBarres(phi_y, s_y, requis.d_y).rho;
      rho_lz = tauxDepuisBarres(phi_z, s_z, requis.d_z).rho;
    } catch {
      return refus(phi_y > 0 && s_y > 0 && phi_z > 0 && s_z > 0 ? 'd_y' : 's_y');
    }
  } else {
    rho_ly = requis.rho_ly;
    rho_lz = requis.rho_lz;
  }

  return {
    ok: true,
    modele: {
      d_y: requis.d_y,
      d_z: requis.d_z,
      f_ck: requis.f_ck,
      rho_ly,
      rho_lz,
      saisieAciers,
      phi_y,
      s_y,
      phi_z,
      s_z,
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
      annexe: lireAnnexe(valeurs.annexe),
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
