import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  svgAutonome,
  resultatsEnCsv,
  noteDeCalculHtml,
  JETONS,
  STYLES_TRACE,
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

/**
 * REGRESSION REELLE : les dessins exportes sortaient entierement NOIRS.
 *
 * La cause n'etait pas dans `svgAutonome`, qui faisait son travail, mais
 * dans ce qu'on lui passait : `JETONS` ne porte que le bloc `:root`. Il
 * DEFINIT les couleurs, il n'en APPLIQUE aucune — les regles qui peignent le
 * trace vivent dans `style.css`, qu'un document exporte ne voit pas. Chaque
 * forme retombait donc sur les defauts SVG, `fill: black` et `stroke: none`.
 *
 * Ces tests verrouillent la cause, pas le symptome : ils exigent que
 * `STYLES_TRACE` porte une regle pour CHAQUE classe que les traces emettent,
 * en la relisant dans `style.css`. Une classe ajoutee au dessin sans regle
 * correspondante fait echouer la suite avant que le dessin ne redevienne
 * noir chez l'utilisateur.
 */
describe('STYLES_TRACE : les regles qui peignent, pas seulement les jetons', () => {
  /** Les classes que les deux traces posent sur leurs elements. */
  const CLASSES_DESSINEES = [
    'dalle-fond',
    'bord-libre',
    'bord-libre-nom',
    'poteau',
    'perimetre',
    'nom',
    'beta',
    'position-retrait',
    'position-courante',
    'conditions',
    'dalle',
    'perimetre-u0',
    'perimetre-u1',
  ];

  it('porte une regle pour chaque classe des traces', () => {
    for (const classe of CLASSES_DESSINEES) {
      expect(STYLES_TRACE, `classe « ${classe} » sans regle exportee`).toContain(`.${classe}`);
    }
  });

  it('les jetons y sont, mais ils ne suffisaient pas', () => {
    expect(STYLES_TRACE).toContain('--texte: #1a1a1a');
    expect(STYLES_TRACE).toContain('--accent: #1e5aa8');
    // Ce que JETONS seul n'avait pas : une declaration de peinture.
    expect(JETONS).not.toContain('fill:');
    expect(STYLES_TRACE).toContain('fill:');
    expect(STYLES_TRACE).toContain('stroke:');
  });

  /**
   * Les selecteurs sont des DESCENDANTS de `.schema-positions` et
   * `.schema-poteau`. Ils ne valent que si ces classes restent sur la balise
   * `<svg>` racine — les deplacer sur un conteneur HTML de la page casserait
   * le rendu exporte sans rien casser a l'ecran.
   */
  it('les traces portent bien leur classe sur la balise svg racine', () => {
    const lire = (chemin: string) =>
      readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

    expect(lire('../../app/src/beta-diagram.ts')).toContain('<svg viewBox');
    expect(lire('../../app/src/beta-diagram.ts')).toMatch(/<svg viewBox[^`]*class="schema-positions"/);
    expect(lire('../../app/src/view.ts')).toMatch(/class="schema-poteau"/);
  });

  /**
   * Le trace en plan est a l'echelle du modele, en millimetres. Sans
   * `vector-effect`, les epaisseurs de trait sont multipliees par le facteur
   * d'echelle et le dessin sort en aplats.
   */
  it('conserve l epaisseur de trait du trace a l echelle du modele', () => {
    expect(STYLES_TRACE).toContain('vector-effect: non-scaling-stroke');
  });

  /** Hors de la page, il n'y a plus de corps dont heriter la police. */
  it('impose la police, que le dessin heritait de la page', () => {
    expect(STYLES_TRACE).toContain('font-family: var(--sans)');
  });
});

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
