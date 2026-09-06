/**
 * Poinconnement des dalles pleines — EN 1992-1-1:2004 §6.4.
 *
 * Point d entree public du noyau de calcul.
 */

export {
  perimetreAuNu,
  perimetreDeControle,
  type Poteau,
  type PositionPoteau,
} from './geometry/control-perimeter';

export {
  coefficientBetaSimplifie,
  contrainteSollicitante,
  type ActionPoinconnement,
} from './punching/acting-shear';

export {
  coefficientHauteur,
  contrainteMinimale,
  resistanceSansArmatures,
  tauxArmatureLongitudinal,
  type DonneesResistanceSansArmatures,
} from './punching/resistance-without-links';

export {
  limiteElastiqueEfficace,
  perimetreExterieur,
  resistanceAvecArmatures,
  resistanceMaximale,
  type DonneesArmatures,
} from './punching/resistance-with-links';

export {
  hauteurUtileMoyenne,
  verifierPoinconnement,
  type ArmaturesEnvisagees,
  type DonneesPoinconnement,
  type ResultatPoinconnement,
  type Verdict,
} from './punching/verify-punching';
