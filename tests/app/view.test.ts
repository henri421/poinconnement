import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  avertissementPerimetre,
  classeDuVerdict,
  echapper,
  lignesDuResultat,
  messageDErreur,
  nombreFr,
  noteSurU0,
  rendreResultat,
  schemaDuPoteau,
  titreDuVerdict,
} from '../../app/src/view';
import {
  perimetreDeControle,
  verifierPoinconnement,
  type DonneesPoinconnement,
  type PositionPoteau,
  type Poteau,
  type ResultatPoinconnement,
  type Verdict,
} from '../../src/index';

const VERDICTS: Verdict[] = [
  'aucune-armature-requise',
  'dalle-trop-mince',
  'armatures-necessaires',
];

const POSITIONS: PositionPoteau[] = ['interieur', 'rive', 'angle'];

/** Dalle de reference : 200/190 mm utiles, C30/37, poteau 400x400 interieur. */
function donnees(surcharge: Partial<DonneesPoinconnement> = {}): DonneesPoinconnement {
  return {
    poteau: { forme: 'rectangulaire', c1: 400, c2: 400, position: 'interieur' },
    d_y: 200,
    d_z: 190,
    f_ck: 30,
    rho_ly: 0.008,
    rho_lz: 0.006,
    action: { V_Ed: 700 },
    ...surcharge,
  };
}

/** Un resultat de chaque verdict, obtenu en ne changeant que l'effort. */
function resultatDuVerdict(verdict: Verdict): ResultatPoinconnement {
  const efforts: Record<Verdict, number> = {
    'aucune-armature-requise': 300,
    'armatures-necessaires': 700,
    'dalle-trop-mince': 2000,
  };
  const obtenu = verifierPoinconnement(donnees({ action: { V_Ed: efforts[verdict] } }));
  if (obtenu.verdict !== verdict) {
    throw new Error(
      `l'effort choisi pour "${verdict}" donne en fait "${obtenu.verdict}" : le cas de test est a revoir`,
    );
  }
  return obtenu;
}

function analyser(html: string): Document {
  return new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
}

describe('echapper', () => {
  it('neutralise ce qui refermerait une balise ou un attribut', () => {
    expect(echapper('<script>')).toBe('&lt;script&gt;');
    expect(echapper('a & b')).toBe('a &amp; b');
    expect(echapper('dit "oui"')).toBe('dit &quot;oui&quot;');
  });

  it("echappe l'esperluette avant tout le reste, sans double echappement", () => {
    expect(echapper('&lt;')).toBe('&amp;lt;');
  });
});

describe('nombreFr', () => {
  it('ecrit la virgule decimale et le nombre de decimales demande', () => {
    expect(nombreFr(4050.44, 1)).toBe('4050,4');
    expect(nombreFr(1.15, 2)).toBe('1,15');
  });

  it('ne laisse jamais passer un NaN ni un infini vers l ecran', () => {
    expect(nombreFr(Number.NaN, 2)).not.toContain('NaN');
    expect(nombreFr(Number.POSITIVE_INFINITY, 2)).not.toContain('Infinity');
  });
});

describe('avertissementPerimetre', () => {
  it('se tait sur un poteau interieur, ou la construction est complete', () => {
    expect(avertissementPerimetre('interieur')).toBeNull();
  });

  it('avertit en rive et en angle que le perimetre retenu peut etre trop long', () => {
    for (const position of ['rive', 'angle'] as PositionPoteau[]) {
      const texte = avertissementPerimetre(position);

      expect(texte).not.toBeNull();
      // Le sens de l'erreur doit etre dit : u1 surestime, donc v_Ed sous-estime.
      // La casse est libre : l'interface met la mise en garde en capitales.
      expect(texte?.toLowerCase()).toContain('non conservatif');
      expect(texte?.toLowerCase()).toContain('surestime u1');
      expect(texte).toContain('u1');
    }
  });
});

describe('les trois verdicts se lisent differemment', () => {
  it('porte un titre distinct pour chacun', () => {
    const titres = VERDICTS.map(titreDuVerdict);

    expect(new Set(titres).size).toBe(VERDICTS.length);
  });

  it('porte une classe distincte pour chacun', () => {
    const classes = VERDICTS.map(classeDuVerdict);

    expect(new Set(classes).size).toBe(VERDICTS.length);
  });

  it('ne confond pas la dalle trop mince avec un manque d armatures', () => {
    const titre = titreDuVerdict('dalle-trop-mince');

    expect(titre.toLowerCase()).toContain('mince');
    expect(titre.toLowerCase()).not.toContain('armatures necessaires');
  });
});

describe('lignesDuResultat', () => {
  it('rend toutes les grandeurs du calcul, sans NaN', () => {
    const lignes = lignesDuResultat(resultatDuVerdict('armatures-necessaires'));
    const symboles = lignes.map((ligne) => ligne.symbole);

    expect(symboles).toEqual(
      expect.arrayContaining([
        'd',
        'β',
        'u0',
        'u1',
        'v_Ed(u0)',
        'v_Ed(u1)',
        'v_Rd,c',
        'v_Rd,max',
      ]),
    );
    for (const ligne of lignes) {
      expect(ligne.valeur).not.toContain('NaN');
    }
  });

  it("n'affiche u_out,ef que lorsque le noyau le rend", () => {
    const avec = lignesDuResultat(resultatDuVerdict('armatures-necessaires'));
    const sans = lignesDuResultat(resultatDuVerdict('aucune-armature-requise'));

    expect(avec.map((ligne) => ligne.symbole)).toContain('u_out,ef');
    expect(sans.map((ligne) => ligne.symbole)).not.toContain('u_out,ef');
  });

  it("n'affiche A_sw que si des armatures ont ete envisagees", () => {
    const sans = lignesDuResultat(resultatDuVerdict('armatures-necessaires'));
    const avec = lignesDuResultat(
      verifierPoinconnement(
        donnees({
          action: { V_Ed: 700 },
          armatures: { s_r: 150, f_ywd: 435 },
        }),
      ),
    );

    expect(sans.map((ligne) => ligne.symbole)).not.toContain('A_sw');
    expect(avec.map((ligne) => ligne.symbole)).toContain('A_sw');
  });
});

describe('rendreResultat', () => {
  const poteauInterieur: Poteau = {
    forme: 'rectangulaire',
    c1: 400,
    c2: 400,
    position: 'interieur',
  };
  const poteauDeRive: Poteau = { forme: 'rectangulaire', c1: 400, c2: 400, position: 'rive' };

  it('reprend le motif du noyau verbatim, sans le reformuler', () => {
    const resultat = resultatDuVerdict('dalle-trop-mince');
    const document = analyser(rendreResultat(resultat, poteauInterieur));

    expect(document.querySelector('[data-role="motif"]')?.textContent).toBe(resultat.motif);
  });

  it('annonce le verdict et sa classe', () => {
    for (const verdict of VERDICTS) {
      const resultat = resultatDuVerdict(verdict);
      const document = analyser(rendreResultat(resultat, poteauInterieur));
      const banniere = document.querySelector('[data-role="verdict"]');

      expect(banniere?.getAttribute('data-verdict')).toBe(verdict);
      expect(banniere?.getAttribute('class')).toContain(classeDuVerdict(verdict));
      expect(banniere?.textContent).toContain(titreDuVerdict(verdict));
    }
  });

  it("montre l'avertissement de perimetre a cote du resultat, en rive", () => {
    const document = analyser(
      rendreResultat(
        verifierPoinconnement(donnees({ poteau: poteauDeRive })),
        poteauDeRive,
      ),
    );

    expect(document.querySelector('[data-role="avertissement-perimetre"]')).not.toBeNull();
  });

  it("ne montre pas cet avertissement sur un poteau interieur", () => {
    const document = analyser(
      rendreResultat(resultatDuVerdict('armatures-necessaires'), poteauInterieur),
    );

    expect(document.querySelector('[data-role="avertissement-perimetre"]')).toBeNull();
  });

  it('ne laisse echapper aucun NaN', () => {
    for (const verdict of VERDICTS) {
      expect(rendreResultat(resultatDuVerdict(verdict), poteauInterieur)).not.toContain('NaN');
    }
  });
});

describe('noteSurU0', () => {
  it('se tait sur un poteau interieur, ou u0 est bien le contour dessine', () => {
    const poteau: Poteau = { forme: 'rectangulaire', c1: 400, c2: 400, position: 'interieur' };

    expect(noteSurU0(poteau, verifierPoinconnement(donnees({ poteau })))).toBeNull();
  });

  it('previent quand le u0 normatif est plus court que le contour dessine', () => {
    // Poteau de rive tres allonge : c2 + 3d est bien en deca de c2 + 2*c1.
    const poteau: Poteau = { forme: 'rectangulaire', c1: 900, c2: 300, position: 'rive' };
    const resultat = verifierPoinconnement(donnees({ poteau }));

    expect(resultat.u0).toBeLessThan(perimetreDeControle(poteau, 0));
    expect(noteSurU0(poteau, resultat)).not.toBeNull();
  });
});

describe('messageDErreur', () => {
  it("reprend le message d'une Error, qui dit deja le domaine refuse", () => {
    expect(messageDErreur(new Error('cas hors du domaine'))).toContain('cas hors du domaine');
  });

  it('reste lisible face a ce qui n est pas une Error', () => {
    const message = messageDErreur('bruit');

    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain('undefined');
  });
});

describe('schemaDuPoteau', () => {
  it("s'adapte a son conteneur : un viewBox, aucune dimension en dur", () => {
    const document = analyser(
      schemaDuPoteau({ forme: 'rectangulaire', c1: 400, c2: 400, position: 'interieur' }, 195),
    );
    const svg = document.querySelector('svg');

    expect(svg?.getAttribute('viewBox')).toMatch(/^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/);
    expect(svg?.getAttribute('width')).toBeNull();
    expect(svg?.getAttribute('height')).toBeNull();
  });

  it('dessine la dalle, le poteau et les deux perimetres, dans toutes les configurations', () => {
    for (const position of POSITIONS) {
      for (const poteau of [
        { forme: 'rectangulaire', c1: 400, c2: 300, position } as Poteau,
        { forme: 'circulaire', D: 450, position } as Poteau,
      ]) {
        const document = analyser(schemaDuPoteau(poteau, 195));

        expect(document.querySelector('[data-role="dalle"]')).not.toBeNull();
        expect(document.querySelector('[data-role="poteau"]')).not.toBeNull();
        expect(document.querySelector('[data-role="perimetre-u0"]')).not.toBeNull();
        expect(document.querySelector('[data-role="perimetre-u1"]')).not.toBeNull();
      }
    }
  });

  it('montre le ou les bords libres, et eux seuls', () => {
    const nombreDeBords = (position: PositionPoteau): number =>
      analyser(
        schemaDuPoteau({ forme: 'rectangulaire', c1: 400, c2: 300, position }, 195),
      ).querySelectorAll('[data-role="bord-libre"]').length;

    expect(nombreDeBords('interieur')).toBe(0);
    expect(nombreDeBords('rive')).toBe(1);
    expect(nombreDeBords('angle')).toBe(2);
  });

  it('ecrete les perimetres au bord libre plutot que de les laisser deborder', () => {
    const document = analyser(
      schemaDuPoteau({ forme: 'rectangulaire', c1: 400, c2: 300, position: 'rive' }, 195),
    );
    const perimetre = document.querySelector('[data-role="perimetre-u1"]');

    expect(perimetre?.getAttribute('clip-path')).toMatch(/^url\(#/);
  });

  it("ne gaspille pas la vue au-dela du bord libre, ou il n'y a pas de dalle", () => {
    // La zone hors dalle est ecretee : l'y etendre ne montre rien et retrecit
    // d'autant le dessin utile.
    for (const position of ['rive', 'angle'] as PositionPoteau[]) {
      const document = analyser(
        schemaDuPoteau({ forme: 'rectangulaire', c1: 400, c2: 400, position }, 195),
      );
      const [xMin, yMin, largeur, hauteur] = (document.querySelector('svg')?.getAttribute('viewBox') ?? '')
        .split(' ')
        .map(Number);

      expect(Math.abs(xMin)).toBeLessThan(0.15 * largeur);
      if (position === 'angle') {
        // En angle, le bord libre horizontal est en y = 0, soit le bas du trace.
        expect(Math.abs(yMin + hauteur)).toBeLessThan(0.15 * hauteur);
      }
    }
  });

  it("ne trace pas d'arc de rayon nul pour le perimetre au nu", () => {
    const document = analyser(
      schemaDuPoteau({ forme: 'rectangulaire', c1: 400, c2: 300, position: 'interieur' }, 195),
    );
    const trace = document.querySelector('[data-role="perimetre-u0"]')?.getAttribute('d') ?? '';

    expect(trace).not.toContain('A 0 0');
  });

  it('ne laisse echapper aucun NaN, meme sur un poteau circulaire d angle', () => {
    for (const position of POSITIONS) {
      expect(schemaDuPoteau({ forme: 'circulaire', D: 450, position }, 195)).not.toContain('NaN');
    }
  });

  it('dessine encore le poteau circulaire de rive, dont le noyau refuse u0', () => {
    // Le trace est de la geometrie : il reste licite la ou u0 ne l'est pas.
    expect(() =>
      schemaDuPoteau({ forme: 'circulaire', D: 450, position: 'rive' }, 195),
    ).not.toThrow();
  });
});
