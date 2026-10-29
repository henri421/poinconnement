/**
 * Version anglaise (lot 8.8) : page `en/index.html` de meme squelette que la
 * page francaise, et AUCUN reste de francais dans ce qui s'affiche en anglais
 * (ecran, dessins, note, CSV, messages). Le francais, lui, est couvert par
 * `finitions.test.ts`, inchange.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { blocsEnTexte, constatsAffichage, contenuBalise, definirLangue, noteDeCalculHtml, notationHtml, texteVisible } from 'aedificium-ui';
import { hauteurUtileMoyenne, verifierPoinconnement } from '../../src/index';
import { champsDepuisModele, donneesDepuisModele, modeleDepuisChamps, modeleParDefaut, type ModeleSaisie } from '../../app/src/form';
import { avertissementPerimetre, messageDErreur, rendreResultat, schemaDuPoteau } from '../../app/src/view';
import { schemaDesPositions } from '../../app/src/beta-diagram';
import { STYLES_TRACE, resultatsEnCsv } from '../../app/src/export';
import { noteDuCalcul } from '../../app/src/note';
import { blocsDEntree, blocsDeResultat, type EtatExportable } from '../../app/src/sorties';
import { textes } from '../../app/src/textes';

const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const controler = (nom: string, html: string): string[] => constatsAffichage(texteVisible(html), { langue: 'en' }).map((c) => `${nom} : ${c}`);
/** CSV : la virgule y est le separateur, pas une virgule decimale. */
const controlerCsv = (nom: string, csv: string): string[] =>
  constatsAffichage(csv, { langue: 'en' })
    .filter((c) => !c.startsWith('virgule decimale'))
    .map((c) => `${nom} : ${c}`);

/** Squelette d'une page : les attributs que lit le script, dans l'ordre. */
function squelette(html: string): string[] {
  return [...html.matchAll(/\s(id|data-[a-z-]+|type|inputmode|accept|value)="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`);
}

/** Les cas de `finitions.test.ts` : les trois verdicts, les trois positions, beta impose. */
function modeles(): ModeleSaisie[] {
  const base = modeleParDefaut();
  return [
    base,
    { ...base, position: 'rive' },
    { ...base, position: 'angle' },
    { ...base, forme: 'circulaire' },
    { ...base, armatures: false },
    { ...base, V_Ed: 150 },
    { ...base, V_Ed: 3000 },
    { ...base, betaImpose: true, beta: 1.3 },
    // Poteau de rive etroit : u0 plafonne par le §6.4.5(3), note sur u0.
    { ...base, position: 'rive', c1: 800, c2: 200 },
  ];
}

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

describe('page anglaise', () => {
  const fr = lire('../../app/index.html');
  const en = lire('../../app/en/index.html');

  it('meme squelette que la page francaise', () => {
    expect(squelette(en)).toEqual(squelette(fr));
  });

  it('langue, script commun, liens entre les deux versions', () => {
    expect(en).toContain('<html lang="en">');
    expect(en).toContain('src="../src/main.ts"');
    expect(en).toMatch(/class="barre-langue" href="\.\.\/"/);
    expect(fr).toMatch(/class="barre-langue" href="en\/"/);
  });

  it('titre anglais, aucun reste de francais', () => {
    expect(contenuBalise(en, 'h1')).toBe('Punching shear');
    expect(controler('page', en.replace(/lang="fr"[^>]*>FR</, '>'))).toEqual([]);
  });
});

describe('affichage en anglais', () => {
  beforeEach(() => definirLangue('en'));
  afterEach(() => definirLangue('fr'));

  it('ecran, dessins, note et CSV', () => {
    const constats: string[] = [];
    modeles().forEach((m, i) => {
      const e = etat(m);
      constats.push(...controler(`cas ${i} ecran`, e.schema + e.positions + rendreResultat(e.resultat, e.donnees.poteau) + notationHtml(avertissementPerimetre(m.position) ?? '')));
      constats.push(...controler(`cas ${i} note`, noteDeCalculHtml(noteDuCalcul(e, { projet: 'Offices', element: '', date: '2026-10-29' }), STYLES_TRACE)));
      const blocs = blocsEnTexte([...blocsDEntree(e), ...blocsDeResultat(e)]);
      constats.push(...controlerCsv(`cas ${i} csv`, resultatsEnCsv(blocs.map((b) => ({ ...b, lignes: [...b.lignes] })))));
    });
    expect(constats).toEqual([]);
  });

  it('les trois verdicts se lisent en anglais', () => {
    const titres = modeles().map((m) => texteVisible(rendreResultat(etat(m).resultat, donneesDepuisModele(m).poteau)));
    expect(titres.some((t) => t.includes('No punching shear reinforcement required'))).toBe(true);
    expect(titres.some((t) => t.includes('Slab too thin'))).toBe(true);
    expect(titres.some((t) => t.includes('Punching shear reinforcement to be provided'))).toBe(true);
  });

  it('messages et erreurs', () => {
    const champs = champsDepuisModele(modeleParDefaut());
    const lectures = [
      modeleDepuisChamps({ ...champs, d_y: 'abc' }),
      modeleDepuisChamps({ ...champs, forme: 'carree' }),
      modeleDepuisChamps({ ...champs, position: 'milieu' }),
    ];
    const calcul = (m: Partial<ModeleSaisie>): string => {
      try {
        verifierPoinconnement(donneesDepuisModele({ ...modeleParDefaut(), ...m }));
      } catch (e) {
        return messageDErreur(e);
      }
      throw new Error('une erreur etait attendue');
    };
    const messages = [
      ...lectures.map((l) => (l.ok ? '' : l.message)),
      calcul({ d_y: 0 }),
      calcul({ c1: 0 }),
      calcul({ c2: -1 }),
      calcul({ forme: 'circulaire', D: 0 }),
      calcul({ forme: 'circulaire', position: 'rive' }),
      calcul({ f_ck: 0 }),
      calcul({ gamma_c: 0 }),
      calcul({ alpha_cc: 0 }),
      calcul({ rho_ly: -1 }),
      calcul({ rho_lz: -1 }),
      calcul({ V_Ed: -1 }),
      calcul({ betaImpose: true, beta: 0 }),
      calcul({ armatures: true, s_r: 0 }),
      calcul({ armatures: true, alpha: 0 }),
      calcul({ armatures: true, f_ywd: 0 }),
      messageDErreur(new Error('')),
      textes().messages.rienAExporter,
      textes().messages.nouvelleVersion,
    ];
    expect(messages.flatMap((m, i) => controler(`message ${i}`, notationHtml(m)))).toEqual([]);
  });
});
