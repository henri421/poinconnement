import { describe, expect, it } from 'vitest';

import { resistanceAvecArmatures } from '../../src/punching/resistance-with-links';
import {
  hauteurUtileMoyenne,
  verifierPoinconnement,
  type DonneesPoinconnement,
} from '../../src/punching/verify-punching';

/**
 * Dalle de reference : poteau interieur 400 x 400, d = 250 mm, C30/37,
 * rho_l = 0,8 % dans les deux directions, beta simplifie.
 *
 * u1 = 2*(400+400) + 4*pi*250 = 4741,59 mm ; u0 = 1600 mm
 * v_Rd,c = 0,655737 MPa ; v_Rd,max = 5,28 MPa
 */
function dalleDeReference(V_Ed: number): DonneesPoinconnement {
  return {
    poteau: { forme: 'rectangulaire', c1: 400, c2: 400, position: 'interieur' },
    d_y: 260,
    d_z: 240,
    f_ck: 30,
    rho_ly: 0.008,
    rho_lz: 0.008,
    action: { V_Ed },
    armatures: { s_r: 150, f_ywd: 435 },
  };
}

describe('hauteurUtileMoyenne', () => {
  it('est la moyenne des deux directions', () => {
    expect(hauteurUtileMoyenne(260, 240)).toBe(250);
  });

  it('une hauteur utile nulle ou negative leve', () => {
    expect(() => hauteurUtileMoyenne(0, 240)).toThrow(/hauteur utile/i);
    expect(() => hauteurUtileMoyenne(260, -240)).toThrow(/hauteur utile/i);
  });
});

describe('verifierPoinconnement — les trois verdicts', () => {
  it('aucune armature requise quand v_Ed(u1) <= v_Rd,c', () => {
    // V_Ed = 300 kN : v_Ed(u1) = 0,291041 MPa <= v_Rd,c = 0,655737 MPa
    const resultat = verifierPoinconnement(dalleDeReference(300));

    expect(resultat.verdict).toBe('aucune-armature-requise');
    expect(resultat.v_Ed_u1).toBeCloseTo(0.291041, 6);
    expect(resultat.v_Rd_c).toBeCloseTo(0.6557368325275917, 12);
    expect(resultat.A_sw_requis).toBeUndefined();
  });

  it('des armatures sont necessaires quand v_Rd,c est depasse sans ecrasement', () => {
    // V_Ed = 900 kN : v_Ed(u1) = 0,873124 > 0,655737 ; v_Ed(u0) = 2,5875 <= 5,28
    const resultat = verifierPoinconnement(dalleDeReference(900));

    expect(resultat.verdict).toBe('armatures-necessaires');
    expect(resultat.motif).toMatch(/armatures/i);
    expect(resultat.motif).not.toMatch(/trop mince/i);
  });

  it('la dalle est trop mince quand v_Ed(u0) depasse v_Rd,max', () => {
    // V_Ed = 2500 kN : v_Ed(u0) = 7,1875 MPa > v_Rd,max = 5,28 MPa
    const resultat = verifierPoinconnement(dalleDeReference(2500));

    expect(resultat.verdict).toBe('dalle-trop-mince');
    expect(resultat.motif).toMatch(/trop mince/i);
    expect(resultat.v_Ed_u0).toBeCloseTo(7.1875, 9);
    expect(resultat.v_Rd_max).toBeCloseTo(5.28, 12);
  });

  /**
   * L ecrasement au nu est un plafond absolu : il est examine avant le manque
   * d armatures, qu aucune armature ne pourrait de toute facon combler.
   */
  it('« trop mince » l emporte sur « armatures necessaires »', () => {
    const trop = verifierPoinconnement(dalleDeReference(2500));

    expect(trop.v_Ed_u1).toBeGreaterThan(trop.v_Rd_c);
    expect(trop.verdict).toBe('dalle-trop-mince');
  });
});

describe('verifierPoinconnement — ce que l outil constate quand des armatures manquent', () => {
  const resultat = verifierPoinconnement(dalleDeReference(900));

  it('rend une aire par cours qui satisfait exactement l eq. (6.52)', () => {
    expect(resultat.A_sw_requis).toBeCloseTo(578.5831325277434, 9);

    // Verification par le calcul direct : avec cette aire, v_Rd,cs rejoint v_Ed.
    const A_sw = resultat.A_sw_requis ?? 0;
    const v_Rd_cs = resistanceAvecArmatures({
      v_Rd_c: resultat.v_Rd_c,
      d: resultat.d,
      s_r: 150,
      A_sw,
      f_ywd: 435,
      u1: resultat.u1,
    });

    expect(v_Rd_cs).toBeCloseTo(resultat.v_Ed_u1, 9);
  });

  it('rend le perimetre exterieur a couvrir', () => {
    expect(resultat.u_out_ef).toBeCloseTo(6313.508399462675, 9);
    expect(resultat.u_out_ef ?? 0).toBeGreaterThan(resultat.u1);
  });

  it('sans donnees d armatures, l aire requise n est pas calculee mais le perimetre l est', () => {
    const sansArmatures: DonneesPoinconnement = { ...dalleDeReference(900), armatures: undefined };
    const sansAire = verifierPoinconnement(sansArmatures);

    expect(sansAire.verdict).toBe('armatures-necessaires');
    expect(sansAire.A_sw_requis).toBeUndefined();
    expect(sansAire.u_out_ef).toBeCloseTo(6313.508399462675, 9);
  });
});

describe('verifierPoinconnement — coefficient d excentrement', () => {
  it('utilise la valeur simplifiee de la position en l absence de beta impose', () => {
    expect(verifierPoinconnement(dalleDeReference(300)).beta).toBe(1.15);
  });

  it('respecte un beta impose par l utilisateur', () => {
    const impose: DonneesPoinconnement = {
      ...dalleDeReference(300),
      action: { V_Ed: 300, beta: 1.32 },
    };
    const resultat = verifierPoinconnement(impose);

    expect(resultat.beta).toBe(1.32);
    // La contrainte suit proportionnellement le coefficient impose.
    expect(resultat.v_Ed_u1).toBeCloseTo(
      (1.32 / 1.15) * verifierPoinconnement(dalleDeReference(300)).v_Ed_u1,
      12,
    );
  });
});

describe('verifierPoinconnement — geometrie du perimetre', () => {
  it('rend les deux perimetres de la construction geometrique', () => {
    const resultat = verifierPoinconnement(dalleDeReference(300));

    expect(resultat.d).toBe(250);
    expect(resultat.u0).toBeCloseTo(1600, 9);
    expect(resultat.u1).toBeCloseTo(2 * (400 + 400) + 4 * Math.PI * 250, 9);
  });

  it('un poteau de rive est plus sollicite que le meme poteau interieur', () => {
    const interieur = verifierPoinconnement(dalleDeReference(300));
    const rive = verifierPoinconnement({
      ...dalleDeReference(300),
      poteau: { forme: 'rectangulaire', c1: 400, c2: 400, position: 'rive' },
    });

    // Perimetre plus court et beta plus eleve : la contrainte augmente deux fois.
    expect(rive.beta).toBe(1.4);
    expect(rive.u1).toBeLessThan(interieur.u1);
    expect(rive.v_Ed_u1).toBeGreaterThan(interieur.v_Ed_u1);
  });
});
