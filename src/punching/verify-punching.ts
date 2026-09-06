/**
 * Verdict de poinconnement — EN 1992-1-1:2004 §6.4.
 *
 * L outil CONSTATE et ne PRESCRIT PAS : il rend l aire d armatures par cours
 * qui satisfait l inequation de l eq. (6.52), jamais un plan de ferraillage.
 *
 * Unites : efforts en kN, longueurs en mm, contraintes en MPa.
 */

import {
  perimetreAuNu,
  perimetreDeControle,
  type Poteau,
} from '../geometry/control-perimeter';
import {
  coefficientBetaSimplifie,
  contrainteSollicitante,
  type ActionPoinconnement,
} from './acting-shear';
import {
  limiteElastiqueEfficace,
  perimetreExterieur,
  resistanceMaximale,
} from './resistance-with-links';
import { resistanceSansArmatures } from './resistance-without-links';

/** Armatures de poinconnement envisagees, pour en deduire l aire necessaire. */
export interface ArmaturesEnvisagees {
  /** Espacement radial des cours (mm). */
  s_r: number;
  /** Limite elastique de calcul (MPa). */
  f_ywd: number;
  /** Angle avec le plan de la dalle (rad) ; pi/2 par defaut. */
  alpha?: number;
}

export interface DonneesPoinconnement {
  poteau: Poteau;
  /** Hauteur utile direction y (mm). */
  d_y: number;
  /** Hauteur utile direction z (mm). */
  d_z: number;
  /** Resistance caracteristique du beton (MPa). */
  f_ck: number;
  /** Taux d armature longitudinale tendue, direction y (-). */
  rho_ly: number;
  /** Taux d armature longitudinale tendue, direction z (-). */
  rho_lz: number;
  action: ActionPoinconnement;
  /** Coefficient partiel du beton ; 1,5 par defaut. */
  gamma_c?: number;
  /** Coefficient des effets a long terme ; 1,0 par defaut. */
  alpha_cc?: number;
  /** Contrainte normale du beton, direction y (MPa, compression positive). */
  sigma_cy?: number;
  /** Contrainte normale du beton, direction z (MPa, compression positive). */
  sigma_cz?: number;
  /** Sans elles, l aire d armatures requise n est pas calculee. */
  armatures?: ArmaturesEnvisagees;
}

export type Verdict = 'aucune-armature-requise' | 'dalle-trop-mince' | 'armatures-necessaires';

export interface ResultatPoinconnement {
  verdict: Verdict;
  /** Motif en clair, distinguant les trois diagnostics. */
  motif: string;
  /** Hauteur utile moyenne retenue (mm). */
  d: number;
  /** Coefficient d excentrement retenu (-). */
  beta: number;
  /** Perimetre au nu du poteau (mm), §6.4.5(3). */
  u0: number;
  /** Perimetre de controle de base, a 2d (mm). */
  u1: number;
  /** Contrainte sollicitante au nu du poteau (MPa). */
  v_Ed_u0: number;
  /** Contrainte sollicitante sur le perimetre de base (MPa). */
  v_Ed_u1: number;
  /** Resistance sans armatures (MPa). */
  v_Rd_c: number;
  /** Contrainte d ecrasement admissible au nu (MPa). */
  v_Rd_max: number;
  /** Aire d armatures par cours satisfaisant l eq. (6.52) (mm2), si applicable. */
  A_sw_requis?: number;
  /** Perimetre exterieur au-dela duquel les armatures sont inutiles (mm). */
  u_out_ef?: number;
}

/**
 * Hauteur utile moyenne `d = (d_y + d_z)/2` (mm).
 *
 * Le poinconnement travaille dans les deux directions a la fois : c est la
 * moyenne des deux hauteurs utiles qui entre dans toutes les expressions du
 * §6.4, et non celle d une seule direction.
 */
export function hauteurUtileMoyenne(d_y: number, d_z: number): number {
  if (!Number.isFinite(d_y) || d_y <= 0 || !Number.isFinite(d_z) || d_z <= 0) {
    throw new Error(
      'Chaque hauteur utile, d_y et d_z, doit etre un nombre strictement positif (mm).',
    );
  }
  return (d_y + d_z) / 2;
}

/**
 * Aire d armatures par cours qui amene `v_Rd,cs` au niveau de `v_Ed`, par
 * inversion de l eq. (6.52). La hauteur utile s y simplifie.
 */
function aireRequise(
  v_Ed: number,
  v_Rd_c: number,
  u1: number,
  d: number,
  armatures: ArmaturesEnvisagees,
): number {
  const alpha = armatures.alpha ?? Math.PI / 2;
  const f_ywd_ef = limiteElastiqueEfficace(d, armatures.f_ywd);
  if (!Number.isFinite(armatures.s_r) || armatures.s_r <= 0) {
    throw new Error('L espacement radial s_r doit etre un nombre strictement positif (mm).');
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > Math.PI / 2) {
    throw new Error("L'angle alpha des armatures doit etre dans ]0 ; pi/2] (rad).");
  }

  return ((v_Ed - 0.75 * v_Rd_c) * u1 * armatures.s_r) / (1.5 * f_ywd_ef * Math.sin(alpha));
}

/** Verification complete du poinconnement d une dalle pleine, §6.4. */
export function verifierPoinconnement(donnees: DonneesPoinconnement): ResultatPoinconnement {
  const d = hauteurUtileMoyenne(donnees.d_y, donnees.d_z);
  const beta = donnees.action.beta ?? coefficientBetaSimplifie(donnees.poteau.position);

  const u0 = perimetreAuNu(donnees.poteau, d);
  const u1 = perimetreDeControle(donnees.poteau, 2 * d);

  const v_Ed_u0 = contrainteSollicitante(donnees.action.V_Ed, beta, u0, d);
  const v_Ed_u1 = contrainteSollicitante(donnees.action.V_Ed, beta, u1, d);

  const v_Rd_c = resistanceSansArmatures({
    d,
    f_ck: donnees.f_ck,
    rho_ly: donnees.rho_ly,
    rho_lz: donnees.rho_lz,
    gamma_c: donnees.gamma_c,
    sigma_cy: donnees.sigma_cy,
    sigma_cz: donnees.sigma_cz,
  });
  const v_Rd_max = resistanceMaximale(donnees.f_ck, donnees.gamma_c, donnees.alpha_cc);

  const commun = { d, beta, u0, u1, v_Ed_u0, v_Ed_u1, v_Rd_c, v_Rd_max };

  // L ecrasement des bielles au nu du poteau est un plafond absolu : il est
  // examine en premier, parce qu aucune armature de poinconnement ne le releve.
  if (v_Ed_u0 > v_Rd_max) {
    return {
      ...commun,
      verdict: 'dalle-trop-mince',
      motif:
        `Ecrasement du beton au nu du poteau : v_Ed(u0) = ${v_Ed_u0.toFixed(3)} MPa depasse ` +
        `v_Rd,max = ${v_Rd_max.toFixed(3)} MPa. La dalle est trop mince ; des armatures de ` +
        "poinconnement n'y changeraient rien. Il faut epaissir la dalle, elargir le poteau, " +
        'ou monter en resistance de beton.',
    };
  }

  if (v_Ed_u1 <= v_Rd_c) {
    return {
      ...commun,
      verdict: 'aucune-armature-requise',
      motif:
        `v_Ed(u1) = ${v_Ed_u1.toFixed(3)} MPa reste sous v_Rd,c = ${v_Rd_c.toFixed(3)} MPa : ` +
        "aucune armature de poinconnement n'est requise.",
    };
  }

  const u_out_ef = perimetreExterieur(donnees.action.V_Ed, beta, v_Rd_c, d);
  const A_sw_requis =
    donnees.armatures === undefined
      ? undefined
      : aireRequise(v_Ed_u1, v_Rd_c, u1, d, donnees.armatures);

  return {
    ...commun,
    verdict: 'armatures-necessaires',
    motif:
      `v_Ed(u1) = ${v_Ed_u1.toFixed(3)} MPa depasse v_Rd,c = ${v_Rd_c.toFixed(3)} MPa sans ` +
      'atteindre l ecrasement au nu : des armatures de poinconnement sont necessaires ' +
      `jusqu'au perimetre u_out,ef = ${u_out_ef.toFixed(0)} mm.`,
    A_sw_requis,
    u_out_ef,
  };
}
