import { describe, expect, it } from 'vitest';

import {
  limiteElastiqueEfficace,
  perimetreExterieur,
  resistanceAvecArmatures,
  resistanceMaximale,
  type DonneesArmatures,
} from '../../src/punching/resistance-with-links';

describe('resistanceMaximale — v_Rd,max = 0,5 * nu * f_cd, §6.4.5(3)', () => {
  it('cas calcule a la main', () => {
    // nu = 0,6 * (1 - 30/250) = 0,6 * 0,88 = 0,528
    // f_cd = 30/1,5 = 20 MPa ; v_Rd,max = 0,5 * 0,528 * 20 = 5,28 MPa
    expect(resistanceMaximale(30)).toBeCloseTo(5.28, 12);
  });

  it('decroit en proportion de nu quand f_ck augmente', () => {
    // nu = 0,6 * (1 - 50/250) = 0,48 ; f_cd = 50/1,5 ; v_Rd,max = 0,5*0,48*50/1,5 = 8 MPa
    expect(resistanceMaximale(50)).toBeCloseTo(8, 12);
  });

  it('gamma_c peut etre impose', () => {
    // f_cd = 30/1,2 = 25 MPa ; v_Rd,max = 0,5 * 0,528 * 25 = 6,6 MPa
    expect(resistanceMaximale(30, 1.2)).toBeCloseTo(6.6, 12);
  });

  it('un f_ck nul ou negatif leve', () => {
    expect(() => resistanceMaximale(0)).toThrow(/f_ck/);
    expect(() => resistanceMaximale(-30)).toThrow(/f_ck/);
  });
});

describe('limiteElastiqueEfficace — f_ywd,ef = 250 + 0,25*d <= f_ywd', () => {
  it('n est PAS plafonnee sur une dalle mince', () => {
    // 250 + 0,25*250 = 312,5 MPa, en deca de f_ywd = 435 MPa.
    expect(limiteElastiqueEfficace(250, 435)).toBeCloseTo(312.5, 12);
  });

  it('EST plafonnee a f_ywd sur une dalle epaisse', () => {
    // 250 + 0,25*800 = 450 MPa, au-dela de f_ywd = 435 MPa : c est f_ywd qui vaut.
    expect(limiteElastiqueEfficace(800, 435)).toBe(435);
  });

  it('une hauteur utile ou une limite elastique invalide leve', () => {
    expect(() => limiteElastiqueEfficace(0, 435)).toThrow(/hauteur utile/i);
    expect(() => limiteElastiqueEfficace(250, 0)).toThrow(/f_ywd/);
  });
});

describe('resistanceAvecArmatures — eq. (6.52)', () => {
  const CAS: DonneesArmatures = {
    v_Rd_c: 0.6,
    d: 250,
    s_r: 150,
    A_sw: 1000,
    f_ywd: 435,
    u1: 3000,
  };

  it('cas calcule a la main', () => {
    // f_ywd,ef = min(250 + 0,25*250 ; 435) = 312,5 MPa
    // 0,75 * v_Rd,c = 0,45 MPa
    // 1,5 * (250/150) * 1000 * 312,5 * sin(90) / (3000 * 250)
    //   = 2,5 * 1000 * 312,5 / 750 000 = 1,041667 MPa
    // v_Rd,cs = 0,45 + 1,041667 = 1,491667 MPa
    expect(resistanceAvecArmatures(CAS)).toBeCloseTo(1.4916666666666667, 12);
  });

  it('des armatures inclinees a 45 degres apportent sin(45) de la contribution', () => {
    const incline: DonneesArmatures = { ...CAS, alpha: Math.PI / 4 };
    const apportDroit = resistanceAvecArmatures(CAS) - 0.75 * CAS.v_Rd_c;
    const apportIncline = resistanceAvecArmatures(incline) - 0.75 * CAS.v_Rd_c;

    expect(apportIncline).toBeCloseTo(apportDroit * Math.sin(Math.PI / 4), 12);
  });

  it('sans armatures il reste 0,75 * v_Rd,c, et non v_Rd,c', () => {
    expect(resistanceAvecArmatures({ ...CAS, A_sw: 0 })).toBeCloseTo(0.45, 12);
  });

  it('un espacement radial nul leve', () => {
    expect(() => resistanceAvecArmatures({ ...CAS, s_r: 0 })).toThrow(/s_r/);
  });

  it('un angle hors de la plage physique leve', () => {
    expect(() => resistanceAvecArmatures({ ...CAS, alpha: 0 })).toThrow(/alpha/i);
    expect(() => resistanceAvecArmatures({ ...CAS, alpha: Math.PI })).toThrow(/alpha/i);
  });
});

describe('perimetreExterieur — u_out,ef = beta * V_Ed / (v_Rd,c * d)', () => {
  it('cas calcule a la main', () => {
    // 1,15 * 900 000 N / (0,6 MPa * 250 mm) = 1 035 000 / 150 = 6900 mm
    expect(perimetreExterieur(900, 1.15, 0.6, 250)).toBeCloseTo(6900, 9);
  });

  it('croit quand V_Ed croit', () => {
    const petit = perimetreExterieur(900, 1.15, 0.6, 250);
    const grand = perimetreExterieur(1200, 1.15, 0.6, 250);

    expect(grand).toBeGreaterThan(petit);
    expect(grand / petit).toBeCloseTo(1200 / 900, 12);
  });

  it('une resistance nulle leve', () => {
    expect(() => perimetreExterieur(900, 1.15, 0, 250)).toThrow(/v_Rd,c/);
  });
});
