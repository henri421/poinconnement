/**
 * Ecrasement du beton au nu du poteau et resistance avec armatures de
 * poinconnement — EN 1992-1-1:2004 §6.4.5.
 *
 * Unites : efforts en kN, longueurs en mm, contraintes en MPa.
 */

const GAMMA_C_PAR_DEFAUT = 1.5;

/**
 * Coefficient tenant compte des effets a long terme sur la resistance en
 * compression, §3.1.6(1)P. Valeur recommandee par l EN 1992-1-1:2004 : 1,0.
 */
const ALPHA_CC_PAR_DEFAUT = 1;

export interface DonneesArmatures {
  /** Resistance sans armatures `v_Rd,c` (MPa), eq. (6.47). */
  v_Rd_c: number;
  /** Hauteur utile moyenne (mm). */
  d: number;
  /** Espacement radial des cours d armatures (mm). */
  s_r: number;
  /** Aire d armatures de poinconnement par cours, sur le pourtour (mm2). */
  A_sw: number;
  /** Limite elastique de calcul des armatures de poinconnement (MPa). */
  f_ywd: number;
  /** Angle des armatures avec le plan de la dalle (rad) ; pi/2 par defaut. */
  alpha?: number;
  /** Perimetre de controle de base `u1` (mm). */
  u1: number;
}

/**
 * Contrainte maximale admissible au nu du poteau `v_Rd,max = 0,5 * nu * f_cd`
 * (MPa), §6.4.5(3), avec `nu = 0,6 * (1 - f_ck/250)`.
 *
 * Elle se confronte a `v_Ed` calculee sur `u0`, et NON sur `u1` : c est
 * l ecrasement des bielles au contact du poteau qui est en jeu. Le depassement
 * de cette valeur signifie que la dalle est trop mince — aucune armature de
 * poinconnement n y remedie.
 */
export function resistanceMaximale(
  f_ck: number,
  gamma_c: number = GAMMA_C_PAR_DEFAUT,
  alpha_cc: number = ALPHA_CC_PAR_DEFAUT,
): number {
  if (!Number.isFinite(f_ck) || f_ck <= 0) {
    throw new Error('f_ck doit etre un nombre strictement positif (MPa).');
  }
  if (!Number.isFinite(gamma_c) || gamma_c <= 0) {
    throw new Error('gamma_c doit etre un nombre strictement positif (-).');
  }
  if (!Number.isFinite(alpha_cc) || alpha_cc <= 0) {
    throw new Error('alpha_cc doit etre un nombre strictement positif (-).');
  }

  const nu = 0.6 * (1 - f_ck / 250);
  const f_cd = (alpha_cc * f_ck) / gamma_c;
  return 0.5 * nu * f_cd;
}

/**
 * Limite elastique efficace des armatures de poinconnement
 * `f_ywd,ef = 250 + 0,25*d <= f_ywd` (MPa), note de l eq. (6.52), d en mm.
 *
 * Ce plafond traduit que les armatures de poinconnement ne peuvent pas etre
 * pleinement ancrees dans l epaisseur disponible : sur une dalle epaisse, c est
 * `f_ywd` qui gouverne, sur une dalle mince c est l ancrage.
 */
export function limiteElastiqueEfficace(d: number, f_ywd: number): number {
  if (!Number.isFinite(d) || d <= 0) {
    throw new Error('La hauteur utile d doit etre un nombre strictement positif (mm).');
  }
  if (!Number.isFinite(f_ywd) || f_ywd <= 0) {
    throw new Error('f_ywd doit etre un nombre strictement positif (MPa).');
  }
  return Math.min(250 + 0.25 * d, f_ywd);
}

/**
 * Resistance au poinconnement avec armatures `v_Rd,cs` (MPa), eq. (6.52) :
 *
 *   v_Rd,cs = 0,75 * v_Rd,c + 1,5 * (d/s_r) * A_sw * f_ywd,ef * sin(alpha) / (u1 * d)
 *
 * Le beton n y compte que pour 0,75 de sa resistance seule : l armature ne
 * s ajoute pas a une resistance beton intacte.
 */
export function resistanceAvecArmatures(donnees: DonneesArmatures): number {
  const { v_Rd_c, d, s_r, A_sw, f_ywd, u1 } = donnees;
  const alpha = donnees.alpha ?? Math.PI / 2;

  if (!Number.isFinite(v_Rd_c) || v_Rd_c < 0) {
    throw new Error('v_Rd,c doit etre un nombre positif ou nul (MPa).');
  }
  if (!Number.isFinite(s_r) || s_r <= 0) {
    throw new Error('L espacement radial s_r doit etre un nombre strictement positif (mm).');
  }
  if (!Number.isFinite(A_sw) || A_sw < 0) {
    throw new Error('A_sw doit etre une aire positive ou nulle (mm2).');
  }
  if (!Number.isFinite(u1) || u1 <= 0) {
    throw new Error('Le perimetre u1 doit etre un nombre strictement positif (mm).');
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > Math.PI / 2) {
    throw new Error("L'angle alpha des armatures doit etre dans ]0 ; pi/2] (rad).");
  }

  const f_ywd_ef = limiteElastiqueEfficace(d, f_ywd);
  const apportArmatures = (1.5 * (d / s_r) * A_sw * f_ywd_ef * Math.sin(alpha)) / (u1 * d);

  return 0.75 * v_Rd_c + apportArmatures;
}

/**
 * Perimetre au-dela duquel les armatures ne sont plus necessaires
 * `u_out,ef = beta * V_Ed / (v_Rd,c * d)` (mm), eq. (6.54).
 *
 * @param V_Ed effort de poinconnement (kN)
 * @param beta coefficient d excentrement (-)
 * @param v_Rd_c resistance sans armatures (MPa)
 * @param d hauteur utile moyenne (mm)
 */
export function perimetreExterieur(
  V_Ed: number,
  beta: number,
  v_Rd_c: number,
  d: number,
): number {
  if (!Number.isFinite(V_Ed) || V_Ed < 0) {
    throw new Error('V_Ed doit etre un effort positif ou nul (kN).');
  }
  if (!Number.isFinite(beta) || beta <= 0) {
    throw new Error('Le coefficient beta doit etre un nombre strictement positif (-).');
  }
  if (!Number.isFinite(v_Rd_c) || v_Rd_c <= 0) {
    throw new Error('v_Rd,c doit etre un nombre strictement positif (MPa).');
  }
  if (!Number.isFinite(d) || d <= 0) {
    throw new Error('La hauteur utile d doit etre un nombre strictement positif (mm).');
  }

  // 1000 : passage des kN aux N.
  return (beta * V_Ed * 1000) / (v_Rd_c * d);
}
