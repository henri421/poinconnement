/**
 * Tests d'acceptation de l'etape 8.2 (finitions) : notations, arrondis,
 * accents, titre, phrases types, sur le texte VISIBLE (ecran, dessins, note,
 * CSV, page). Le controle lui-meme vit dans aedificium-ui (`constatsAffichage`).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NOMS_GRECS, blocsEnTexte, noteDeCalculHtml, constatsAffichage, contenuBalise, notationHtml, texteVisible } from 'aedificium-ui';
import { hauteurUtileMoyenne, verifierPoinconnement } from '../../src/index';
import { donneesDepuisModele, modeleParDefaut, type ModeleSaisie } from '../../app/src/form';
import { avertissementPerimetre, rendreResultat, schemaDuPoteau } from '../../app/src/view';
import { schemaDesPositions } from '../../app/src/beta-diagram';
import { STYLES_TRACE, resultatsEnCsv } from '../../app/src/export';
import { noteDuCalcul } from '../../app/src/note';
import { blocsDEntree, blocsDeResultat, type EtatExportable } from '../../app/src/sorties';

const TITRE = 'Poinçonnement';
const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const controler = (nom: string, html: string): string[] => constatsAffichage(texteVisible(html)).map((c) => `${nom} : ${c}`);

const base = modeleParDefaut();
const MODELES: ModeleSaisie[] = [
  base,
  { ...base, position: 'rive' },
  { ...base, position: 'angle' },
  { ...base, forme: 'circulaire' },
  { ...base, armatures: false },
  { ...base, V_Ed: 150 },
  { ...base, V_Ed: 3000 },
  { ...base, betaImpose: true, beta: 1.3 },
];

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

function sorties() {
  const ecran: string[] = [];
  const notes: string[] = [];
  const csv: string[] = [];
  for (const m of MODELES) {
    const e = etat(m);
    ecran.push(e.schema, e.positions, rendreResultat(e.resultat, e.donnees.poteau), notationHtml(avertissementPerimetre(m.position) ?? ''));
    notes.push(noteDeCalculHtml(noteDuCalcul(e, { projet: 'Bureaux', element: '', date: '2026-10-24' }), STYLES_TRACE));
    const blocs = blocsEnTexte([...blocsDEntree(e), ...blocsDeResultat(e)]);
    csv.push(resultatsEnCsv(blocs.map((b) => ({ ...b, lignes: [...b.lignes] }))));
  }
  return { ecran, notes, csv };
}

describe('texte visible : notations, arrondis, accents, phrases types', () => {
  const s = sorties();

  it('ecran et dessins', () => {
    expect(s.ecran.flatMap((h, i) => controler(`ecran ${i}`, h))).toEqual([]);
  });

  it('note de calcul', () => {
    expect(s.notes.flatMap((h, i) => controler(`note ${i}`, h))).toEqual([]);
  });

  it('page (index.html)', () => {
    expect(controler('page', lire('../../app/index.html'))).toEqual([]);
  });

  it('CSV : texte brut, ni « _ » ni nom de lettre grecque ni balise', () => {
    for (const c of s.csv) {
      expect(c).not.toContain('_');
      expect(c).not.toMatch(NOMS_GRECS);
      expect(c).not.toContain('<');
    }
  });

  it('le verdict s ecrit en clair dans la note et le CSV, jamais par sa cle', () => {
    for (const t of [...s.notes, ...s.csv]) expect(t).not.toMatch(/aucune-armature-requise|armatures-necessaires|dalle-trop-mince/);
  });
});

describe('titre', () => {
  const page = lire('../../app/index.html');

  it('titre de la page sans tiret, majuscule initiale', () => {
    expect(contenuBalise(page, 'h1')).toBe(TITRE);
    expect(contenuBalise(page, 'title')?.startsWith(TITRE)).toBe(true);
  });

  it('titre en grand', () => {
    const regle = /(^|\n)h1\s*\{([^}]*)\}/.exec(lire('../../app/src/style.css'))?.[2] ?? '';
    expect(regle).toMatch(/font-size:\s*1\.75rem/);
    expect(regle).toMatch(/font-weight:\s*600/);
  });
});

describe('main.ts passe par les fonctions testees', () => {
  it('sorties et CSV', () => {
    const main = lire('../../app/src/main.ts');
    expect(main).toContain("from './sorties'");
    expect(main).toContain('blocsEnTexte(');
    expect(main).not.toMatch(/function blocsDEntree|function blocsDeResultat|const HYPOTHESES/);
  });
});
