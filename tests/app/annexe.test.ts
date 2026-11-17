// Lot E (audit R4) : annexe luxembourgeoise preremplie, gamma_c et alpha_cc modifiables.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { coefsDeLAnnexe, sourceDuCoef, valeursDeLAnnexe } from '../../app/src/annexe';
import { champsDepuisModele, modeleDepuisChamps, modeleParDefaut } from '../../app/src/form';

const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

describe('annexe luxembourgeoise', () => {
  it('alpha_cc = 0,85, gamma_c 1,5, sources AN-LU', () => {
    const v = valeursDeLAnnexe('lu');
    expect(v.alpha_cc.valeur).toBe(0.85);
    expect(v.alpha_cc.source).toMatch(/^ILNAS-EN 1992-1-1\/AN-LU:2020, 3\.1\.6\(1\)P : valeur présumée/);
    expect(v.gamma_c).toEqual({ valeur: 1.5, source: expect.stringMatching(/AN-LU:2020, tableau 2\.1N : valeur recommandée présumée retenue/) });
    expect(coefsDeLAnnexe('recommande')).toEqual({ gamma_c: 1.5, alpha_cc: 1 });
  });

  it('valeur changee : source imposee', () => {
    expect(sourceDuCoef('lu', 'alpha_cc', 0.85)).toMatch(/^ILNAS/);
    expect(sourceDuCoef('lu', 'alpha_cc', 0.9)).toMatch(/imposée/);
  });

  it('saisie : annexe ecrite et relue ; ancienne feuille sans annexe = recommandee', () => {
    const m = modeleParDefaut();
    expect(m.annexe).toBe('recommande');
    const champs = champsDepuisModele({ ...m, annexe: 'lu' });
    expect(champs['annexe']).toBe('lu');
    const lu = modeleDepuisChamps(champs);
    expect(lu.ok && lu.modele.annexe).toBe('lu');
    delete champs['annexe'];
    const ancien = modeleDepuisChamps(champs);
    expect(ancien.ok && ancien.modele.annexe).toBe('recommande');
  });

  it('pages : selecteur d annexe et bandeau dans les deux langues', () => {
    for (const p of ['../../app/index.html', '../../app/en/index.html']) {
      const h = lire(p);
      expect(h).toContain('<select data-champ="annexe" data-role="annexe"></select>');
      expect(h).toContain('data-role="bandeau-annexe"');
    }
  });
});
