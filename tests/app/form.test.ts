import { describe, expect, it } from 'vitest';

import {
  champsDepuisModele,
  donneesDepuisModele,
  lireNombre,
  modeleDepuisChamps,
  modeleParDefaut,
  type ModeleSaisie,
} from '../../app/src/form';
import { verifierPoinconnement } from '../../src/index';

/** Champs du formulaire pour un modele donne, avec surcharges ponctuelles. */
function champs(surcharge: Record<string, string> = {}): Record<string, string> {
  return { ...champsDepuisModele(modeleParDefaut()), ...surcharge };
}

/** Modele lu, ou l'echec du test si la lecture a echoue. */
function modeleLu(surcharge: Record<string, string> = {}): ModeleSaisie {
  const lecture = modeleDepuisChamps(champs(surcharge));
  if (!lecture.ok) {
    throw new Error(`lecture refusee alors qu'elle devait aboutir : ${lecture.message}`);
  }
  return lecture.modele;
}

describe('lireNombre', () => {
  it('accepte la virgule decimale, comme on ecrit une note de calcul', () => {
    expect(lireNombre('1,15')).toBe(1.15);
  });

  it('accepte le point decimal et la notation scientifique', () => {
    expect(lireNombre('0.008')).toBe(0.008);
    expect(lireNombre('1e3')).toBe(1000);
  });

  it('ignore les espaces autour de la valeur', () => {
    expect(lireNombre('  250  ')).toBe(250);
  });

  it('refuse ce qui n est pas un nombre', () => {
    expect(lireNombre('')).toBeNull();
    expect(lireNombre('   ')).toBeNull();
    expect(lireNombre('abc')).toBeNull();
    expect(lireNombre('12 kN')).toBeNull();
  });

  it('refuse l infini, qui traverserait tous les tests de finitude', () => {
    expect(lireNombre('Infinity')).toBeNull();
  });
});

describe('modeleDepuisChamps', () => {
  it('fait l aller-retour avec champsDepuisModele sans rien perdre', () => {
    const depart = modeleParDefaut();

    expect(modeleLu()).toEqual(depart);
  });

  it('refuse un champ non numerique en nommant le champ fautif', () => {
    const lecture = modeleDepuisChamps(champs({ V_Ed: 'beaucoup' }));

    expect(lecture.ok).toBe(false);
    if (!lecture.ok) {
      expect(lecture.message).toContain('V_Ed');
    }
  });

  it('refuse une position inconnue', () => {
    const lecture = modeleDepuisChamps(champs({ position: 'flottant' }));

    expect(lecture.ok).toBe(false);
  });

  it('refuse une forme inconnue', () => {
    const lecture = modeleDepuisChamps(champs({ forme: 'triangulaire' }));

    expect(lecture.ok).toBe(false);
  });

  it('ne reclame pas le diametre quand le poteau est rectangulaire', () => {
    const lecture = modeleDepuisChamps(champs({ forme: 'rectangulaire', D: '' }));

    expect(lecture.ok).toBe(true);
  });

  it('ne reclame pas les cotes quand le poteau est circulaire', () => {
    const lecture = modeleDepuisChamps(champs({ forme: 'circulaire', c1: '', c2: '' }));

    expect(lecture.ok).toBe(true);
  });

  it('ne reclame ni beta ni armatures tant que les cases sont decochees', () => {
    const lecture = modeleDepuisChamps(
      champs({ beta_impose: 'non', beta: '', armatures: 'non', s_r: '', f_ywd: '', alpha: '' }),
    );

    expect(lecture.ok).toBe(true);
  });

  it('reclame beta des que la case est cochee', () => {
    const lecture = modeleDepuisChamps(champs({ beta_impose: 'oui', beta: '' }));

    expect(lecture.ok).toBe(false);
  });

  it('reclame les armatures des que la case est cochee', () => {
    const lecture = modeleDepuisChamps(champs({ armatures: 'oui', s_r: '' }));

    expect(lecture.ok).toBe(false);
  });
});

describe('donneesDepuisModele', () => {
  it('rend un poteau rectangulaire porteur de ses deux cotes, sans diametre', () => {
    const donnees = donneesDepuisModele(modeleLu({ forme: 'rectangulaire', c1: '400', c2: '300' }));

    expect(donnees.poteau).toEqual({
      forme: 'rectangulaire',
      c1: 400,
      c2: 300,
      position: 'interieur',
    });
  });

  it('rend un poteau circulaire porteur de son seul diametre', () => {
    const donnees = donneesDepuisModele(modeleLu({ forme: 'circulaire', D: '450' }));

    expect(donnees.poteau).toEqual({ forme: 'circulaire', D: 450, position: 'interieur' });
  });

  it('laisse beta indefini tant qu il n est pas impose, pour que le noyau le deduise', () => {
    const donnees = donneesDepuisModele(modeleLu({ beta_impose: 'non' }));

    expect(donnees.action.beta).toBeUndefined();
  });

  it('transmet beta quand il est impose', () => {
    const donnees = donneesDepuisModele(modeleLu({ beta_impose: 'oui', beta: '1,32' }));

    expect(donnees.action.beta).toBe(1.32);
  });

  it('laisse les armatures indefinies tant que la case est decochee', () => {
    const donnees = donneesDepuisModele(modeleLu({ armatures: 'non' }));

    expect(donnees.armatures).toBeUndefined();
  });

  it("convertit l'angle des armatures en radians", () => {
    const donnees = donneesDepuisModele(modeleLu({ armatures: 'oui', alpha: '45' }));

    expect(donnees.armatures?.alpha).toBeCloseTo(Math.PI / 4, 12);
  });

  it("rend exactement pi/2 pour 90 degres, que le noyau refuse de depasser", () => {
    const donnees = donneesDepuisModele(modeleLu({ armatures: 'oui', alpha: '90' }));

    // Le noyau exige alpha dans ]0 ; pi/2] : un arrondi au-dessus de pi/2 leverait.
    expect(donnees.armatures?.alpha).toBe(Math.PI / 2);
    expect(() => verifierPoinconnement(donnees)).not.toThrow();
  });
});

describe('modeleParDefaut', () => {
  it('decrit une dalle qui se verifie sans lever au chargement de la page', () => {
    const donnees = donneesDepuisModele(modeleParDefaut());

    expect(() => verifierPoinconnement(donnees)).not.toThrow();
  });

  it('part sur un poteau interieur, ou les valeurs simplifiees sont les plus courantes', () => {
    expect(modeleParDefaut().position).toBe('interieur');
  });
});
