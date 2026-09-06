/**
 * Contrainte de poinconnement sollicitante — EN 1992-1-1:2004 §6.4.3.
 *
 * Unites : efforts en kN, longueurs en mm, contraintes en MPa.
 */

import type { PositionPoteau } from '../geometry/control-perimeter';

export interface ActionPoinconnement {
  /** Effort de poinconnement (kN). */
  V_Ed: number;
  /** Coefficient d'excentrement ; absent = valeur simplifiee du §6.4.3(6). */
  beta?: number;
}

/**
 * Valeurs simplifiees du coefficient d excentrement `beta`, §6.4.3(6) :
 * 1,15 pour un poteau interieur, 1,4 de rive, 1,5 d angle.
 *
 * ATTENTION — ces valeurs ne sont licites que sous les conditions que la norme
 * enonce au meme paragraphe :
 * - la stabilite laterale de la structure n est PAS assuree par un effet de
 *   cadre entre dalles et poteaux ;
 * - les portees adjacentes ne different pas de plus de 25 %.
 *
 * Hors de ces conditions, `beta` doit etre calcule par l expression complete du
 * §6.4.3(3) a (5), au moyen du module de flexion `W1` — calcul qui n est PAS
 * couvert par cet outil : il faut alors imposer sa propre valeur de `beta`.
 */
export function coefficientBetaSimplifie(position: PositionPoteau): number {
  switch (position) {
    case 'interieur':
      return 1.15;
    case 'rive':
      return 1.4;
    case 'angle':
      return 1.5;
  }
}

/**
 * Contrainte de poinconnement sollicitante `v_Ed = beta * V_Ed / (u * d)` (MPa).
 *
 * @param V_Ed effort de poinconnement (kN)
 * @param beta coefficient d excentrement (-)
 * @param u perimetre considere, `u0` ou `u1` (mm)
 * @param d hauteur utile moyenne `(d_y + d_z)/2` (mm)
 */
export function contrainteSollicitante(V_Ed: number, beta: number, u: number, d: number): number {
  if (!Number.isFinite(V_Ed) || V_Ed < 0) {
    throw new Error("V_Ed doit etre un effort positif ou nul (kN).");
  }
  if (!Number.isFinite(beta) || beta <= 0) {
    throw new Error('Le coefficient beta doit etre un nombre strictement positif (-).');
  }
  if (!Number.isFinite(u) || u <= 0) {
    throw new Error('Le perimetre u doit etre un nombre strictement positif (mm).');
  }
  if (!Number.isFinite(d) || d <= 0) {
    throw new Error('La hauteur utile d doit etre un nombre strictement positif (mm).');
  }

  // 1000 : passage des kN aux N, les longueurs etant en mm et le resultat en MPa.
  return (beta * V_Ed * 1000) / (u * d);
}
