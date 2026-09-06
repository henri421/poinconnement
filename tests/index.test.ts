import { describe, expect, it } from 'vitest';

import {
  coefficientBetaSimplifie,
  coefficientHauteur,
  contrainteMinimale,
  contrainteSollicitante,
  hauteurUtileMoyenne,
  limiteElastiqueEfficace,
  perimetreAuNu,
  perimetreDeControle,
  perimetreExterieur,
  resistanceAvecArmatures,
  resistanceMaximale,
  resistanceSansArmatures,
  tauxArmatureLongitudinal,
  verifierPoinconnement,
  type DonneesPoinconnement,
} from '../src/index';

describe('surface publique du module', () => {
  it('expose les fonctions du noyau', () => {
    const fonctions = [
      coefficientBetaSimplifie,
      coefficientHauteur,
      contrainteMinimale,
      contrainteSollicitante,
      hauteurUtileMoyenne,
      limiteElastiqueEfficace,
      perimetreAuNu,
      perimetreDeControle,
      perimetreExterieur,
      resistanceAvecArmatures,
      resistanceMaximale,
      resistanceSansArmatures,
      tauxArmatureLongitudinal,
      verifierPoinconnement,
    ];

    for (const fonction of fonctions) {
      expect(typeof fonction).toBe('function');
    }
  });

  it('verifie une dalle de bout en bout depuis le point d entree', () => {
    const donnees: DonneesPoinconnement = {
      poteau: { forme: 'circulaire', D: 500, position: 'interieur' },
      d_y: 260,
      d_z: 240,
      f_ck: 30,
      rho_ly: 0.008,
      rho_lz: 0.008,
      action: { V_Ed: 300 },
    };
    const resultat = verifierPoinconnement(donnees);

    expect(resultat.u1).toBeCloseTo(Math.PI * (500 + 4 * 250), 9);
    expect(resultat.u0).toBeCloseTo(Math.PI * 500, 9);
    expect(resultat.verdict).toBe('aucune-armature-requise');
  });
});
