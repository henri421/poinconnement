import { describe, expect, it } from 'vitest';

import {
  coefficientBetaSimplifie,
  contrainteSollicitante,
} from '../../src/punching/acting-shear';

describe('coefficientBetaSimplifie — valeurs du §6.4.3(6)', () => {
  it('vaut 1,15 pour un poteau interieur', () => {
    expect(coefficientBetaSimplifie('interieur')).toBe(1.15);
  });

  it('vaut 1,4 pour un poteau de rive', () => {
    expect(coefficientBetaSimplifie('rive')).toBe(1.4);
  });

  it('vaut 1,5 pour un poteau d angle', () => {
    expect(coefficientBetaSimplifie('angle')).toBe(1.5);
  });
});

describe('contrainteSollicitante — v_Ed = beta * V_Ed / (u * d)', () => {
  it('cas calcule a la main', () => {
    // beta = 1,15 ; V_Ed = 900 kN = 900 000 N ; u = 3000 mm ; d = 200 mm.
    // v_Ed = 1,15 * 900 000 / (3000 * 200) = 1 035 000 / 600 000 = 1,725 MPa.
    expect(contrainteSollicitante(900, 1.15, 3000, 200)).toBeCloseTo(1.725, 12);
  });

  /**
   * L effort entre en kN et les longueurs en mm : sans la conversion, la
   * contrainte serait mille fois trop petite. Le facteur est fixe ici.
   */
  it('convertit bien les kN en N', () => {
    const sansConversion = (1.15 * 900) / (3000 * 200);

    expect(contrainteSollicitante(900, 1.15, 3000, 200)).toBeCloseTo(1000 * sansConversion, 12);
    expect(contrainteSollicitante(900, 1.15, 3000, 200)).toBeGreaterThan(1);
  });

  it('un effort nul donne une contrainte nulle', () => {
    expect(contrainteSollicitante(0, 1.15, 3000, 200)).toBe(0);
  });

  it('un perimetre nul ou negatif leve', () => {
    expect(() => contrainteSollicitante(900, 1.15, 0, 200)).toThrow(/perimetre/i);
    expect(() => contrainteSollicitante(900, 1.15, -3000, 200)).toThrow(/perimetre/i);
  });

  it('une hauteur utile nulle ou negative leve', () => {
    expect(() => contrainteSollicitante(900, 1.15, 3000, 0)).toThrow(/hauteur utile/i);
    expect(() => contrainteSollicitante(900, 1.15, 3000, -200)).toThrow(/hauteur utile/i);
  });

  it('un beta nul ou negatif leve', () => {
    expect(() => contrainteSollicitante(900, 0, 3000, 200)).toThrow(/beta/i);
    expect(() => contrainteSollicitante(900, -1.15, 3000, 200)).toThrow(/beta/i);
  });

  it('un effort negatif leve', () => {
    expect(() => contrainteSollicitante(-900, 1.15, 3000, 200)).toThrow(/V_Ed/);
  });
});
