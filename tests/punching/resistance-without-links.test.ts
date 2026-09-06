import { describe, expect, it } from 'vitest';

import {
  coefficientHauteur,
  contrainteMinimale,
  resistanceSansArmatures,
  tauxArmatureLongitudinal,
  type DonneesResistanceSansArmatures,
} from '../../src/punching/resistance-without-links';

/** Cas de reference : k = 2 (d = 200), f_ck = 30, rho_l = 0,005, sans effort normal. */
const CAS_DE_REFERENCE: DonneesResistanceSansArmatures = {
  d: 200,
  f_ck: 30,
  rho_ly: 0.01,
  rho_lz: 0.0025,
};

describe('coefficientHauteur — k = 1 + racine(200/d) <= 2,0', () => {
  it('vaut 1 + racine(200/300) pour une dalle epaisse', () => {
    expect(coefficientHauteur(300)).toBeCloseTo(1.816496580927726, 12);
  });

  it('vaut exactement 2,0 a d = 200 mm', () => {
    expect(coefficientHauteur(200)).toBe(2);
  });

  it('est ecrete a 2,0 sous 200 mm', () => {
    // Sans ecretage : 1 + racine(200/150) = 2,1547...
    expect(coefficientHauteur(150)).toBe(2);
    expect(coefficientHauteur(80)).toBe(2);
  });

  it('une hauteur utile nulle ou negative leve', () => {
    expect(() => coefficientHauteur(0)).toThrow(/hauteur utile/i);
    expect(() => coefficientHauteur(-200)).toThrow(/hauteur utile/i);
  });
});

describe('tauxArmatureLongitudinal — moyenne GEOMETRIQUE, ecretee a 2 %', () => {
  it('est la racine du produit, et non la demi-somme', () => {
    // racine(0,02 * 0,005) = 0,01 ; la moyenne arithmetique vaudrait 0,0125.
    expect(tauxArmatureLongitudinal(0.02, 0.005)).toBeCloseTo(0.01, 12);
    expect(tauxArmatureLongitudinal(0.02, 0.005)).not.toBeCloseTo(0.0125, 6);
  });

  it('coincide avec la valeur commune quand les deux directions sont egales', () => {
    expect(tauxArmatureLongitudinal(0.008, 0.008)).toBeCloseTo(0.008, 12);
  });

  it('est ecrete a 0,02', () => {
    expect(tauxArmatureLongitudinal(0.03, 0.03)).toBe(0.02);
  });

  it('un taux negatif leve', () => {
    expect(() => tauxArmatureLongitudinal(-0.01, 0.005)).toThrow(/rho/i);
    expect(() => tauxArmatureLongitudinal(0.01, -0.005)).toThrow(/rho/i);
  });
});

describe('contrainteMinimale — v_min = 0,035 * k^1,5 * racine(f_ck)', () => {
  it('cas calcule a la main', () => {
    // 0,035 * 2^1,5 * racine(30) = 0,035 * 2,828427... * 5,477226... = 0,542218 MPa
    expect(contrainteMinimale(2, 30)).toBeCloseTo(0.5422176684690384, 12);
  });
});

describe('resistanceSansArmatures — eq. (6.47)', () => {
  it('cas calcule a la main, terme principal gouvernant', () => {
    // C_Rd,c = 0,18/1,5 = 0,12 ; k = 2 ; rho_l = racine(0,010*0,0025) = 0,005
    // 100 * rho_l * f_ck = 15 ; 15^(1/3) = 2,466212...
    // v_Rd,c = 0,12 * 2 * 2,466212... = 0,591891 MPa, superieur a v_min = 0,542218.
    expect(resistanceSansArmatures(CAS_DE_REFERENCE)).toBeCloseTo(0.5918908978393127, 12);
  });

  it('le plancher v_min gouverne quand le ferraillage est faible', () => {
    // rho_l = 0,001 : terme principal = 0,12 * 2 * (3)^(1/3) = 0,346140 MPa,
    // inferieur a v_min = 0,542218 MPa.
    const faiblementArme: DonneesResistanceSansArmatures = {
      ...CAS_DE_REFERENCE,
      rho_ly: 0.001,
      rho_lz: 0.001,
    };

    expect(resistanceSansArmatures(faiblementArme)).toBeCloseTo(0.5422176684690384, 12);
    expect(resistanceSansArmatures(faiblementArme)).toBeGreaterThan(0.346139896873778);
  });

  it('le taux d armature est ecrete a 2 % dans le calcul de la resistance', () => {
    // rho reel 3 % : ecrete a 2 %, soit 100*0,02*30 = 60 et 0,12*2*60^(1/3) = 0,939568.
    // Sans ecretage on obtiendrait 0,12*2*90^(1/3) = 1,0755 MPa.
    const fortementArme: DonneesResistanceSansArmatures = {
      ...CAS_DE_REFERENCE,
      rho_ly: 0.03,
      rho_lz: 0.03,
    };

    expect(resistanceSansArmatures(fortementArme)).toBeCloseTo(0.9395682338805272, 12);
  });

  it('la moyenne geometrique des deux taux, et non l arithmetique', () => {
    // (0,02 ; 0,005) -> rho_l = 0,01 ; (0,01 ; 0,01) -> rho_l = 0,01 : meme resistance.
    // Avec une moyenne arithmetique, le premier cas donnerait 0,0125 et une
    // resistance plus elevee.
    const dissymetrique: DonneesResistanceSansArmatures = {
      ...CAS_DE_REFERENCE,
      rho_ly: 0.02,
      rho_lz: 0.005,
    };
    const equivalent: DonneesResistanceSansArmatures = {
      ...CAS_DE_REFERENCE,
      rho_ly: 0.01,
      rho_lz: 0.01,
    };
    const arithmetique: DonneesResistanceSansArmatures = {
      ...CAS_DE_REFERENCE,
      rho_ly: 0.0125,
      rho_lz: 0.0125,
    };

    expect(resistanceSansArmatures(dissymetrique)).toBeCloseTo(
      resistanceSansArmatures(equivalent),
      12,
    );
    expect(resistanceSansArmatures(dissymetrique)).toBeLessThan(
      resistanceSansArmatures(arithmetique),
    );
  });

  /**
   * Le piege du module : au poinconnement le coefficient de l effort normal
   * vaut 0,1 (§6.4.4(1)), et non 0,15 comme a l effort tranchant (§6.2.2).
   */
  it('k1 vaut 0,1 au poinconnement, et non 0,15', () => {
    const sigma_cp = 2; // (sigma_cy + sigma_cz)/2 = (3 + 1)/2 = 2 MPa
    const comprime: DonneesResistanceSansArmatures = {
      ...CAS_DE_REFERENCE,
      sigma_cy: 3,
      sigma_cz: 1,
    };

    const apport = resistanceSansArmatures(comprime) - resistanceSansArmatures(CAS_DE_REFERENCE);

    expect(apport).toBeCloseTo(0.1 * sigma_cp, 12);
    expect(apport).not.toBeCloseTo(0.15 * sigma_cp, 6);
  });

  it('sigma_cp est la moyenne des deux directions', () => {
    const dissymetrique: DonneesResistanceSansArmatures = {
      ...CAS_DE_REFERENCE,
      sigma_cy: 3,
      sigma_cz: 1,
    };
    const uniforme: DonneesResistanceSansArmatures = {
      ...CAS_DE_REFERENCE,
      sigma_cy: 2,
      sigma_cz: 2,
    };

    expect(resistanceSansArmatures(dissymetrique)).toBeCloseTo(
      resistanceSansArmatures(uniforme),
      12,
    );
  });

  it('gamma_c vaut 1,5 par defaut et peut etre impose', () => {
    // C_Rd,c = 0,18/1,2 = 0,15 au lieu de 0,12 : rapport 1,25 sur le terme principal.
    const accidentel: DonneesResistanceSansArmatures = { ...CAS_DE_REFERENCE, gamma_c: 1.2 };

    expect(resistanceSansArmatures(accidentel)).toBeCloseTo(
      1.25 * resistanceSansArmatures(CAS_DE_REFERENCE),
      12,
    );
  });

  it('une resistance beton nulle ou negative leve', () => {
    expect(() => resistanceSansArmatures({ ...CAS_DE_REFERENCE, f_ck: 0 })).toThrow(/f_ck/);
    expect(() => resistanceSansArmatures({ ...CAS_DE_REFERENCE, f_ck: -30 })).toThrow(/f_ck/);
  });

  it('un gamma_c nul ou negatif leve', () => {
    expect(() => resistanceSansArmatures({ ...CAS_DE_REFERENCE, gamma_c: 0 })).toThrow(/gamma_c/);
  });
});
