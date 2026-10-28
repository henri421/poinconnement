/**
 * Tests d'acceptation du lot 8.7 : la note de calcul passe sur la note
 * commune d'aedificium-ui (cartouche, sections dans l'ordre fixe, dessins
 * dans la geometrie, conclusions sans verdict global).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { noteDeCalculHtml, texteVisible, type ElementNote } from 'aedificium-ui';
import { hauteurUtileMoyenne, verifierPoinconnement } from '../../src/index';
import { donneesDepuisModele, modeleParDefaut, type ModeleSaisie } from '../../app/src/form';
import { lignesDuResultat, schemaDuPoteau, titreDuVerdict } from '../../app/src/view';
import { schemaDesPositions } from '../../app/src/beta-diagram';
import { STYLES_TRACE } from '../../app/src/export';
import { HYPOTHESES, avertissementsDeLaNote, type EtatExportable } from '../../app/src/sorties';
import { noteDuCalcul } from '../../app/src/note';

const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const CARTOUCHE = { projet: 'Bureaux', element: 'Poteau B4', date: '2026-10-28' };

function etat(m: ModeleSaisie): EtatExportable {
  const donnees = donneesDepuisModele(m);
  const resultat = verifierPoinconnement(donnees);
  return {
    modele: m,
    donnees,
    resultat,
    schema: schemaDuPoteau(donnees.poteau, hauteurUtileMoyenne(donnees.d_y, donnees.d_z)),
    positions: schemaDesPositions(m.position),
  };
}

const BASE = modeleParDefaut();
const E = etat(BASE);
const note = noteDuCalcul(E, CARTOUCHE);
const html = noteDeCalculHtml(note, STYLES_TRACE);
const blocs = (els: ElementNote[] | undefined) => (els ?? []).flatMap((e) => (e.type === 'bloc' ? [e.bloc] : []));
const symboles = (els: ElementNote[] | undefined) => blocs(els).flatMap((b) => b.lignes.map((l) => l.symbole));
const figures = (els: ElementNote[] | undefined) => (els ?? []).flatMap((e) => (e.type === 'figure' ? [e] : []));

describe('cartouche', () => {
  it('projet, element, date, norme et outil', () => {
    expect(note.cartouche).toEqual({ ...CARTOUCHE, norme: 'EN 1992-1-1:2004, §6.4', outil: 'poinçonnement' });
  });

  it('element vide : poteau et sa position', () => {
    expect(noteDuCalcul(E, { ...CARTOUCHE, element: '' }).cartouche.element).toBe('Poteau intérieur');
    expect(noteDuCalcul(etat({ ...BASE, position: 'angle' }), { ...CARTOUCHE, element: ' ' }).cartouche.element).toBe("Poteau d'angle");
  });

  it('le texte du cartouche est echappe', () => {
    const h = noteDeCalculHtml(noteDuCalcul(E, { ...CARTOUCHE, projet: 'Bureaux <x>' }), STYLES_TRACE);
    expect(h).toContain('Bureaux &lt;x&gt;');
    expect(h).not.toContain('Bureaux <x>');
  });
});

describe('sections', () => {
  it('ordre fixe, sans combinaisons', () => {
    const titres = [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map((x) => x[1]);
    expect(titres).toEqual(['1. Géométrie', '2. Matériaux', '3. Hypothèses', '4. Cas de charges', '5. Calculs et vérifications', '6. Conclusions']);
  });

  it('geometrie : dalle, poteau, armatures envisagees, puis les deux dessins de la page', () => {
    const g = note.sections.geometrie;
    expect(symboles(g)).toEqual(['d_y', 'd_z', 'forme', 'c1', 'c2', 'position', 's_r', 'alpha']);
    expect(figures(g).map((f) => f.svg)).toEqual([E.positions, E.schema]);
  });

  it('sans armatures envisagees : ni s_r ni f_ywd', () => {
    const n = noteDuCalcul(etat({ ...BASE, armatures: false }), CARTOUCHE);
    expect(symboles(n.sections.geometrie)).not.toContain('s_r');
    expect(symboles(n.sections.materiaux)).not.toContain('f_ywd');
  });

  it('poteau circulaire : le diametre', () => {
    const n = noteDuCalcul(etat({ ...BASE, forme: 'circulaire' }), CARTOUCHE);
    expect(symboles(n.sections.geometrie)).toContain('D');
    expect(symboles(n.sections.geometrie)).not.toContain('c1');
  });

  it('materiaux : beton, coefficients, armatures longitudinales', () => {
    expect(symboles(note.sections.materiaux)).toEqual(['f_ck', 'gamma_c', 'alpha_cc', 'rho_ly', 'rho_lz', 'f_ywd']);
  });

  it('hypotheses : beta retenu, puis la liste', () => {
    const h = note.sections.hypotheses;
    expect(blocs(h)[0].lignes.map((l) => l.symbole)).toEqual(['β']);
    expect(blocs(h)[0].lignes[0].libelle).toContain('§6.4.3(6)');
    expect(blocs(noteDuCalcul(etat({ ...BASE, betaImpose: true, beta: 1.3 }), CARTOUCHE).sections.hypotheses)[0].lignes[0]).toEqual({ symbole: 'β', libelle: 'imposé', valeur: '1,3' });
    expect((h ?? []).flatMap((e) => (e.type === 'liste' ? [e.items] : []))).toEqual([[...HYPOTHESES]]);
  });

  it('cas de charges : V_Ed', () => {
    expect(symboles(note.sections.charges)).toEqual(['V_Ed']);
  });

  it('avertissement de perimetre en rive, repris en tete', () => {
    expect(note.avertissements).toEqual([]);
    const e = etat({ ...BASE, position: 'rive' });
    expect(noteDuCalcul(e, CARTOUCHE).avertissements).toEqual(avertissementsDeLaNote(e));
    expect(noteDuCalcul(e, CARTOUCHE).avertissements).toHaveLength(1);
  });
});

describe('calculs', () => {
  it('le bloc de l ecran, puis le motif ; pas de bloc Verdict', () => {
    const c = note.sections.calculs ?? [];
    expect(blocs(c).map((b) => b.titre)).toEqual(['Vérification (§6.4)']);
    expect(blocs(c)[0].lignes).toEqual(lignesDuResultat(E.resultat));
    expect(c.flatMap((x) => (x.type === 'texte' ? [x.texte] : []))).toEqual([E.resultat.motif]);
  });
});

describe('conclusions', () => {
  const cas: ModeleSaisie[] = [{ ...BASE, V_Ed: 150 }, BASE, { ...BASE, V_Ed: 3000 }];
  for (const m of cas) {
    it(`V_Ed = ${m.V_Ed} kN : ecrasement puis resistance sans armatures`, () => {
      const e = etat(m);
      const r = e.resultat;
      const v = noteDuCalcul(e, CARTOUCHE).verifications;
      expect(v.map((x) => [x.nom, x.clause])).toEqual([
        ['Écrasement du béton au nu du poteau', '§6.4.5(3)'],
        ['Résistance sans armatures de poinçonnement', '§6.4.4, (6.47)'],
      ]);
      expect(v[0].taux).toBeCloseTo(r.v_Ed_u0 / r.v_Rd_max, 10);
      expect(v[1].taux).toBeCloseTo(r.v_Ed_u1 / r.v_Rd_c, 10);
      expect(v[0].ok).toBe(r.verdict !== 'dalle-trop-mince');
      expect(v[1].ok).toBe(r.verdict === 'aucune-armature-requise');
    });
  }

  it('aucun verdict global', () => {
    for (const m of [{ ...BASE, V_Ed: 150 }, BASE, { ...BASE, V_Ed: 3000 }]) {
      const e = etat(m);
      const t = texteVisible(noteDeCalculHtml(noteDuCalcul(e, CARTOUCHE), STYLES_TRACE));
      expect(t).toContain('Vérification déterminante');
      expect(t).not.toContain(titreDuVerdict(e.resultat.verdict));
      expect(t).not.toContain('Conforme');
    }
  });
});

describe('cablage', () => {
  const main = lire('../../app/src/main.ts');
  const page = lire('../../app/index.html');
  const sorties = page.slice(page.indexOf('id="sorties"'), page.indexOf('</section>', page.indexOf('id="sorties"')));

  it('la note passe par noteDuCalcul et la note commune', () => {
    expect(main).toContain('noteDuCalcul(');
    expect(main).toMatch(/import \{[^}]*\bnoteDeCalculHtml\b[^}]*\} from 'aedificium-ui'/);
    expect(main).not.toMatch(/import \{[^}]*\bnoteDeCalculHtml\b[^}]*\} from '\.\/export'/);
  });

  it('champs projet et element dans les sorties, memorises', () => {
    expect(sorties).toContain('data-role="projet"');
    expect(sorties).toContain('data-role="element"');
    expect(main).toContain("'poinconnement:cartouche'");
  });

  it('l ancienne note locale a disparu', () => {
    const exp = lire('../../app/src/export.ts');
    expect(exp).not.toContain('function noteDeCalculHtml');
    expect(exp).not.toContain('STYLE_NOTE');
    expect(exp).toContain('export const STYLES_TRACE');
    expect(exp).toContain('export function resultatsEnCsv');
  });
});
