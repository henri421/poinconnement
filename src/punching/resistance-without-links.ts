/**
 * Resistance au poinconnement sans armatures d effort tranchant —
 * EN 1992-1-1:2004 §6.4.4(1), eq. (6.47).
 *
 *   v_Rd,c = C_Rd,c * k * (100 * rho_l * f_ck)^(1/3) + k1 * sigma_cp
 *          >= v_min + k1 * sigma_cp
 *
 * Unites : longueurs en mm, contraintes en MPa.
 */

/** Coefficient partiel du beton, valeur recommandee en situation durable. */
const GAMMA_C_PAR_DEFAUT = 1.5;

/** Taux d armature longitudinale plafonne par le §6.4.4(1). */
const RHO_L_MAXIMAL = 0.02;

/**
 * ⚠ PIEGE DU MODULE — coefficient de l effort normal.
 *
 * Au POINCONNEMENT, §6.4.4(1) : k1 = 0,1.
 * A l EFFORT TRANCHANT, §6.2.2(1) : k1 = 0,15.
 *
 * Les deux expressions de v_Rd,c sont presque identiques ; seul ce coefficient
 * differe. Reprendre 0,15 par habitude surestimerait la resistance de la dalle
 * comprimee. La valeur ci-dessous est celle du poinconnement, et elle est fixee
 * par un test qui le dit.
 */
const K1_POINCONNEMENT = 0.1;

export interface DonneesResistanceSansArmatures {
  /** Hauteur utile moyenne `(d_y + d_z)/2` (mm). */
  d: number;
  /** Resistance caracteristique du beton en compression (MPa). */
  f_ck: number;
  /** Taux d armature longitudinale tendue, direction y (-). */
  rho_ly: number;
  /** Taux d armature longitudinale tendue, direction z (-). */
  rho_lz: number;
  /** Coefficient partiel du beton ; 1,5 par defaut. */
  gamma_c?: number;
  /** Contrainte normale du beton, direction y (MPa, compression positive). */
  sigma_cy?: number;
  /** Contrainte normale du beton, direction z (MPa, compression positive). */
  sigma_cz?: number;
}

/** Coefficient de hauteur `k = 1 + racine(200/d) <= 2,0`, d en mm. */
export function coefficientHauteur(d: number): number {
  if (!Number.isFinite(d) || d <= 0) {
    throw new Error('La hauteur utile d doit etre un nombre strictement positif (mm).');
  }
  return Math.min(2, 1 + Math.sqrt(200 / d));
}

/**
 * Taux d armature longitudinale de reference `rho_l = racine(rho_ly * rho_lz)`,
 * plafonne a 0,02.
 *
 * C est la moyenne GEOMETRIQUE des deux directions, et non l arithmetique.
 */
export function tauxArmatureLongitudinal(rho_ly: number, rho_lz: number): number {
  if (!Number.isFinite(rho_ly) || rho_ly < 0) {
    throw new Error('Le taux d armature rho_ly doit etre un nombre positif ou nul (-).');
  }
  if (!Number.isFinite(rho_lz) || rho_lz < 0) {
    throw new Error('Le taux d armature rho_lz doit etre un nombre positif ou nul (-).');
  }
  return Math.min(RHO_L_MAXIMAL, Math.sqrt(rho_ly * rho_lz));
}

/** Plancher de resistance `v_min = 0,035 * k^1,5 * racine(f_ck)` (MPa), eq. (6.3N). */
export function contrainteMinimale(k: number, f_ck: number): number {
  if (!Number.isFinite(k) || k <= 0) {
    throw new Error('Le coefficient k doit etre un nombre strictement positif (-).');
  }
  if (!Number.isFinite(f_ck) || f_ck <= 0) {
    throw new Error('f_ck doit etre un nombre strictement positif (MPa).');
  }
  return 0.035 * Math.pow(k, 1.5) * Math.sqrt(f_ck);
}

/** Resistance au poinconnement sans armatures `v_Rd,c` (MPa), eq. (6.47). */
export function resistanceSansArmatures(donnees: DonneesResistanceSansArmatures): number {
  const { d, f_ck, rho_ly, rho_lz } = donnees;
  const gamma_c = donnees.gamma_c ?? GAMMA_C_PAR_DEFAUT;
  const sigma_cy = donnees.sigma_cy ?? 0;
  const sigma_cz = donnees.sigma_cz ?? 0;

  if (!Number.isFinite(f_ck) || f_ck <= 0) {
    throw new Error('f_ck doit etre un nombre strictement positif (MPa).');
  }
  if (!Number.isFinite(gamma_c) || gamma_c <= 0) {
    throw new Error('gamma_c doit etre un nombre strictement positif (-).');
  }
  if (!Number.isFinite(sigma_cy) || !Number.isFinite(sigma_cz)) {
    throw new Error('Les contraintes normales sigma_cy et sigma_cz doivent etre finies (MPa).');
  }

  const k = coefficientHauteur(d);
  const rho_l = tauxArmatureLongitudinal(rho_ly, rho_lz);
  const C_Rd_c = 0.18 / gamma_c;

  const termePrincipal = C_Rd_c * k * Math.cbrt(100 * rho_l * f_ck);
  const plancher = contrainteMinimale(k, f_ck);

  // Contrainte normale moyenne des deux directions.
  const sigma_cp = (sigma_cy + sigma_cz) / 2;

  // Le terme d effort normal s ajoute aussi bien au terme principal qu au
  // plancher : c est le maximum des deux termes de beton qui est retenu.
  return Math.max(termePrincipal, plancher) + K1_POINCONNEMENT * sigma_cp;
}
