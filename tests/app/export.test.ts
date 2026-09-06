import { describe, it, expect } from 'vitest';
import {
  svgAutonome,
  resultatsEnCsv,
  noteDeCalculHtml,
  JETONS,
} from '../../app/src/export';
import type { BlocExport } from '../../app/src/export';

const BLOC: BlocExport = {
  titre: 'Resultat',
  lignes: [
    { symbole: 'd', libelle: 'hauteur utile moyenne', valeur: '210,0 mm' },
    { symbole: 'v_Rd,c', libelle: 'resistance sans armatures', valeur: '0,585 MPa' },
  ],
  note: null,
};

const HORS_DOMAINE: BlocExport = {
  titre: 'Armatures de poinconnement',
  lignes: [],
  note: "non calculees : aucune armature n'est requise",
};

describe('svgAutonome', () => {
  const svg = '<svg viewBox="0 0 100 50"><rect class="beton" width="10" height="10"/></svg>';

  it('rend un document autonome, avec son espace de noms', () => {
    const doc = svgAutonome(svg, JETONS);

    expect(doc).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(doc).toContain('<rect class="beton"');
  });

  it('INLINE les jetons, sans quoi le dessin s ouvre sans couleur ailleurs', () => {
    // Les couleurs viennent de variables definies dans la page. Un SVG extrait
    // tel quel les perd : il faut les emporter avec lui.
    const doc = svgAutonome(svg, JETONS);

    expect(doc).toContain('<style');
    expect(doc).toContain('--compression');
    expect(doc).toContain('--accent');
  });

  it('ne conserve pas le balisage HTML qui suivrait le SVG', () => {
    // La legende de la page est du HTML : la laisser casserait le XML.
    const doc = svgAutonome(`${svg}<p class="legende">un texte</p>`, JETONS);

    expect(doc).not.toContain('<p class="legende"');
    expect(doc.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('rend un document VIDE MAIS VALIDE quand il n y a pas de SVG', () => {
    const doc = svgAutonome('rien du tout', JETONS);

    expect(doc).toContain('<svg');
    expect(doc).toContain('</svg>');
  });
});

describe('resultatsEnCsv', () => {
  it('separe les colonnes par un POINT-VIRGULE', () => {
    // La virgule est deja le separateur decimal francais : la prendre aussi
    // comme separateur de colonnes couperait chaque nombre en deux.
    const csv = resultatsEnCsv([BLOC]);

    expect(csv).toContain('Resultat;d;hauteur utile moyenne;210,0 mm');
  });

  it('commence par le BOM', () => {
    // Sans lui, un tableur lit le fichier dans l encodage de la machine et
    // massacre les accents comme les σ, ρ et ν des libelles.
    expect(resultatsEnCsv([BLOC]).charCodeAt(0)).toBe(0xfeff);
  });

  it('echappe un champ contenant le separateur ou un guillemet', () => {
    const csv = resultatsEnCsv([
      { titre: 'T', lignes: [{ symbole: 'a;b', libelle: 'dit "oui"', valeur: '1' }], note: null },
    ]);

    expect(csv).toContain('"a;b"');
    expect(csv).toContain('"dit ""oui"""');
  });

  it('sort AUSSI ce qui n a pas ete calcule, avec son motif', () => {
    // Une absence silencieuse ferait croire au lecteur que la verification a
    // eu lieu. C est pire qu une ligne explicitement vide.
    const csv = resultatsEnCsv([HORS_DOMAINE]);

    expect(csv).toContain('Armatures de poinconnement');
    expect(csv).toContain("aucune armature n'est requise");
  });
});

describe('noteDeCalculHtml', () => {
  const note = {
    titre: 'Dalle D1',
    date: '2026-09-06',
    entrees: [BLOC],
    dessins: ['<svg viewBox="0 0 10 10"><circle r="1"/></svg>'],
    resultats: [BLOC, HORS_DOMAINE],
    avertissements: ['le perimetre de controle peut etre NON CONSERVATIF en rive'],
    hypotheses: ['dalle pleine d epaisseur constante'],
  };

  it('rend un document HTML complet et autonome', () => {
    const html = noteDeCalculHtml(note, JETONS);

    expect(html.toLowerCase()).toContain('<!doctype html>');
    expect(html).toContain('<style');
    // Autonome : aucune ressource externe.
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<script');
  });

  it('porte les entrees, les dessins, les resultats et les hypotheses', () => {
    const html = noteDeCalculHtml(note, JETONS);

    expect(html).toContain('Dalle D1');
    expect(html).toContain('2026-09-06');
    expect(html).toContain('<svg');
    expect(html).toContain('v_Rd,c');
    expect(html).toContain('dalle pleine');
  });

  it('porte l avertissement en evidence', () => {
    // Il signale un resultat potentiellement NON CONSERVATIF : une note qui
    // le tairait serait pire que pas de note.
    const html = noteDeCalculHtml(note, JETONS);

    expect(html).toContain('NON CONSERVATIF');
    expect(html).toContain('class="avertissement"');
  });

  it('ne masque pas ce qui n a pas ete calcule', () => {
    const html = noteDeCalculHtml(note, JETONS);
    expect(html).toContain("aucune armature n'est requise");
  });

  it('porte l avertissement d aide au calcul', () => {
    expect(noteDeCalculHtml(note, JETONS)).toMatch(/responsabilite/i);
  });

  it('ne contient aucun NaN', () => {
    expect(noteDeCalculHtml(note, JETONS)).not.toContain('NaN');
  });

  it('echappe le texte insere', () => {
    const html = noteDeCalculHtml({ ...note, titre: '<script>x</script>' }, JETONS);
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
