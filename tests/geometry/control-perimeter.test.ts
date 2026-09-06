import { describe, expect, it } from 'vitest';

import {
  perimetreAuNu,
  perimetreDeControle,
  type Poteau,
} from '../../src/geometry/control-perimeter';

/**
 * Egalite a la precision de la virgule flottante. Les longueurs sont des sommes
 * de segments et d'arcs evalues dans un ordre different de celui de la forme
 * fermee : les derniers bits peuvent differer, la valeur non.
 */
function egaliteFlottante(obtenu: number, attendu: number): void {
  expect(Math.abs(obtenu - attendu) / Math.abs(attendu)).toBeLessThan(1e-12);
}

describe('perimetreDeControle — formes fermees, qui prouvent la construction', () => {
  it('poteau interieur rectangulaire : 2(c1 + c2) + 4*pi*d a la distance 2d', () => {
    const d = 220;
    const poteau: Poteau = { forme: 'rectangulaire', c1: 400, c2: 300, position: 'interieur' };

    egaliteFlottante(
      perimetreDeControle(poteau, 2 * d),
      2 * (400 + 300) + 4 * Math.PI * d,
    );
  });

  it('poteau interieur circulaire : pi*(D + 4d) a la distance 2d', () => {
    const d = 185;
    const poteau: Poteau = { forme: 'circulaire', D: 450, position: 'interieur' };

    egaliteFlottante(perimetreDeControle(poteau, 2 * d), Math.PI * (450 + 4 * d));
  });
});

describe('perimetreDeControle — troncature au bord libre, verifiee par son effet', () => {
  const d = 200;

  it('un poteau rectangulaire de rive est plus court que le meme poteau interieur', () => {
    const interieur: Poteau = { forme: 'rectangulaire', c1: 400, c2: 300, position: 'interieur' };
    const rive: Poteau = { ...interieur, position: 'rive' };

    expect(perimetreDeControle(rive, 2 * d)).toBeLessThan(perimetreDeControle(interieur, 2 * d));
  });

  it('un poteau rectangulaire d angle est plus court encore', () => {
    const rive: Poteau = { forme: 'rectangulaire', c1: 400, c2: 300, position: 'rive' };
    const angle: Poteau = { ...rive, position: 'angle' };

    expect(perimetreDeControle(angle, 2 * d)).toBeLessThan(perimetreDeControle(rive, 2 * d));
  });

  it('la troncature vaut aussi pour un poteau circulaire', () => {
    const interieur: Poteau = { forme: 'circulaire', D: 450, position: 'interieur' };
    const rive: Poteau = { ...interieur, position: 'rive' };
    const angle: Poteau = { ...interieur, position: 'angle' };

    expect(perimetreDeControle(rive, 2 * d)).toBeLessThan(perimetreDeControle(interieur, 2 * d));
    expect(perimetreDeControle(angle, 2 * d)).toBeLessThan(perimetreDeControle(rive, 2 * d));
  });

  /**
   * Controle croise : la construction geometrique doit redonner les formes
   * fermees usuelles de la rive et de l angle, moities et quart de la
   * contribution circulaire 4*pi*d du cas interieur.
   */
  it('rive : 2*c1 + c2 + 2*pi*d ; angle : c1 + c2 + pi*d', () => {
    const rive: Poteau = { forme: 'rectangulaire', c1: 400, c2: 300, position: 'rive' };
    const angle: Poteau = { ...rive, position: 'angle' };

    egaliteFlottante(perimetreDeControle(rive, 2 * d), 2 * 400 + 300 + 2 * Math.PI * d);
    egaliteFlottante(perimetreDeControle(angle, 2 * d), 400 + 300 + Math.PI * d);
  });
});

describe('perimetreDeControle — a = 0 redonne le contour de l aire chargee', () => {
  it('rectangle interieur : le perimetre entier', () => {
    const poteau: Poteau = { forme: 'rectangulaire', c1: 400, c2: 300, position: 'interieur' };

    egaliteFlottante(perimetreDeControle(poteau, 0), 2 * (400 + 300));
  });

  it('cercle interieur : pi*D', () => {
    const poteau: Poteau = { forme: 'circulaire', D: 450, position: 'interieur' };

    egaliteFlottante(perimetreDeControle(poteau, 0), Math.PI * 450);
  });

  it('rectangle de rive : le cote sur le bord libre ne compte pas, soit 2*c1 + c2', () => {
    const poteau: Poteau = { forme: 'rectangulaire', c1: 400, c2: 300, position: 'rive' };

    egaliteFlottante(perimetreDeControle(poteau, 0), 2 * 400 + 300);
  });

  it('rectangle d angle : deux cotes sur les bords libres, soit c1 + c2', () => {
    const poteau: Poteau = { forme: 'rectangulaire', c1: 400, c2: 300, position: 'angle' };

    egaliteFlottante(perimetreDeControle(poteau, 0), 400 + 300);
  });
});

describe('perimetreDeControle — entrees invalides : une erreur, jamais un NaN', () => {
  const rect: Poteau = { forme: 'rectangulaire', c1: 400, c2: 300, position: 'interieur' };

  it('une distance negative leve', () => {
    expect(() => perimetreDeControle(rect, -1)).toThrow(/distance/i);
  });

  it('un rectangle sans c1 leve', () => {
    const poteau: Poteau = { forme: 'rectangulaire', c2: 300, position: 'interieur' };

    expect(() => perimetreDeControle(poteau, 400)).toThrow(/c1/i);
  });

  it('un rectangle sans c2 leve', () => {
    const poteau: Poteau = { forme: 'rectangulaire', c1: 400, position: 'interieur' };

    expect(() => perimetreDeControle(poteau, 400)).toThrow(/c2/i);
  });

  it('une dimension nulle leve', () => {
    const poteau: Poteau = { forme: 'rectangulaire', c1: 0, c2: 300, position: 'interieur' };

    expect(() => perimetreDeControle(poteau, 400)).toThrow(/c1/i);
  });

  it('un cercle sans D leve', () => {
    const poteau: Poteau = { forme: 'circulaire', position: 'interieur' };

    expect(() => perimetreDeControle(poteau, 400)).toThrow(/D/);
  });

  it('un diametre nul leve', () => {
    const poteau: Poteau = { forme: 'circulaire', D: 0, position: 'interieur' };

    expect(() => perimetreDeControle(poteau, 400)).toThrow(/D/);
  });
});

describe('perimetreAuNu — u0 selon le §6.4.5(3)', () => {
  it('poteau interieur : le perimetre du poteau lui-meme', () => {
    const rectangle: Poteau = { forme: 'rectangulaire', c1: 400, c2: 300, position: 'interieur' };
    const cercle: Poteau = { forme: 'circulaire', D: 450, position: 'interieur' };

    egaliteFlottante(perimetreAuNu(rectangle, 200), 2 * (400 + 300));
    egaliteFlottante(perimetreAuNu(cercle, 200), Math.PI * 450);
  });

  it('poteau de rive : c2 + 3d quand cette valeur gouverne', () => {
    // c2 + 3d = 300 + 450 = 750 ; plafond c2 + 2*c1 = 300 + 800 = 1100.
    const poteau: Poteau = { forme: 'rectangulaire', c1: 400, c2: 300, position: 'rive' };

    egaliteFlottante(perimetreAuNu(poteau, 150), 750);
  });

  it('poteau de rive : plafonne a c2 + 2*c1 quand le poteau est court', () => {
    // c2 + 3d = 300 + 600 = 900 ; plafond c2 + 2*c1 = 300 + 500 = 800.
    const poteau: Poteau = { forme: 'rectangulaire', c1: 250, c2: 300, position: 'rive' };

    egaliteFlottante(perimetreAuNu(poteau, 200), 800);
  });

  it('poteau d angle : 3d quand cette valeur gouverne', () => {
    // 3d = 450 ; plafond c1 + c2 = 600.
    const poteau: Poteau = { forme: 'rectangulaire', c1: 300, c2: 300, position: 'angle' };

    egaliteFlottante(perimetreAuNu(poteau, 150), 450);
  });

  it('poteau d angle : plafonne a c1 + c2 quand le poteau est court', () => {
    // 3d = 600 ; plafond c1 + c2 = 400.
    const poteau: Poteau = { forme: 'rectangulaire', c1: 200, c2: 200, position: 'angle' };

    egaliteFlottante(perimetreAuNu(poteau, 200), 400);
  });

  /**
   * Le §6.4.5(3) n enonce u0 que pour des poteaux rectangulaires de rive et d
   * angle. Rendre le contour geometrique tronque serait ici non conservatif
   * (pour un cercle tangent au bord libre, la troncature ne retire rien) :
   * l outil refuse plutot que d inventer une expression.
   */
  it('poteau circulaire de rive ou d angle : hors du domaine du §6.4.5(3), leve', () => {
    const rive: Poteau = { forme: 'circulaire', D: 450, position: 'rive' };
    const angle: Poteau = { forme: 'circulaire', D: 450, position: 'angle' };

    expect(() => perimetreAuNu(rive, 200)).toThrow(/6\.4\.5/);
    expect(() => perimetreAuNu(angle, 200)).toThrow(/6\.4\.5/);
  });

  it('une hauteur utile nulle ou negative leve', () => {
    const poteau: Poteau = { forme: 'rectangulaire', c1: 400, c2: 300, position: 'rive' };

    expect(() => perimetreAuNu(poteau, 0)).toThrow(/hauteur utile/i);
    expect(() => perimetreAuNu(poteau, -200)).toThrow(/hauteur utile/i);
  });
});
