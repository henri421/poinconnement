import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

/**
 * Tests du CABLAGE : on charge la vraie page et le vrai module, et on verifie
 * que saisir une valeur change ce qui s'affiche.
 *
 * La logique pure est testee a cote (form, view, beta-diagram) ; ici on ne
 * teste que la jonction, qui est precisement ce qu'aucun test unitaire ne voit.
 */

const CHEMIN_HTML = fileURLToPath(new URL('../../app/index.html', import.meta.url));

async function monterApplication(): Promise<JSDOM> {
  const dom = new JSDOM(readFileSync(CHEMIN_HTML, 'utf8'), {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });

  const global = globalThis as unknown as Record<string, unknown>;
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.HTMLInputElement = dom.window.HTMLInputElement;
  global.HTMLSelectElement = dom.window.HTMLSelectElement;

  // Import a chaud : le module se cable au chargement, sur le document installe.
  vi.resetModules();
  await import('../../app/src/main');

  return dom;
}

afterEach(() => {
  const global = globalThis as unknown as Record<string, unknown>;
  for (const nom of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement']) {
    delete global[nom];
  }
});

function element(dom: JSDOM, selecteur: string): Element {
  const trouve = dom.window.document.querySelector(selecteur);
  if (trouve === null) {
    throw new Error(`element absent de la page : ${selecteur}`);
  }
  return trouve;
}

function champ(dom: JSDOM, nom: string): HTMLInputElement {
  return element(dom, `input[data-champ="${nom}"]`) as HTMLInputElement;
}

function liste(dom: JSDOM, nom: string): HTMLSelectElement {
  return element(dom, `select[data-champ="${nom}"]`) as HTMLSelectElement;
}

function saisir(dom: JSDOM, nom: string, valeur: string): void {
  const entree = champ(dom, nom);
  entree.value = valeur;
  entree.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

function choisir(dom: JSDOM, nom: string, valeur: string): void {
  const deroulante = liste(dom, nom);
  deroulante.value = valeur;
  deroulante.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
}

function cocher(dom: JSDOM, nom: string, valeur: boolean): void {
  const boite = champ(dom, nom);
  boite.checked = valeur;
  boite.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
}

/** Verdict affiche, ou `null` si la page n'en montre aucun. */
function verdict(dom: JSDOM): string | null {
  return dom.window.document.querySelector('[data-role="verdict"]')?.getAttribute('data-verdict') ?? null;
}

function erreurVisible(dom: JSDOM): string | null {
  const banniere = dom.window.document.querySelector('[data-role="erreur"]') as HTMLElement | null;
  if (banniere === null || banniere.hidden) {
    return null;
  }
  return banniere.textContent;
}

describe('la page au chargement', () => {
  it('rend un verdict sans qu on ait rien saisi', async () => {
    const dom = await monterApplication();

    expect(verdict(dom)).not.toBeNull();
  });

  it('n affiche aucun NaN', async () => {
    const dom = await monterApplication();

    expect(dom.window.document.body.textContent).not.toContain('NaN');
  });

  it('montre le schema des trois positions et le trace du poteau', async () => {
    const dom = await monterApplication();

    expect(element(dom, '#positions svg')).not.toBeNull();
    expect(element(dom, '#schema svg')).not.toBeNull();
  });

  it('ne montre aucune erreur', async () => {
    const dom = await monterApplication();

    expect(erreurVisible(dom)).toBeNull();
  });
});

describe('la saisie change le resultat', () => {
  it('change le verdict quand on change V_Ed', async () => {
    const dom = await monterApplication();
    const depart = verdict(dom);

    saisir(dom, 'V_Ed', '300');

    expect(verdict(dom)).not.toBe(depart);
  });

  it('atteint chacun des trois verdicts par une saisie', async () => {
    const dom = await monterApplication();

    saisir(dom, 'V_Ed', '300');
    expect(verdict(dom)).toBe('aucune-armature-requise');

    saisir(dom, 'V_Ed', '700');
    expect(verdict(dom)).toBe('armatures-necessaires');

    saisir(dom, 'V_Ed', '2000');
    expect(verdict(dom)).toBe('dalle-trop-mince');
  });

  it('met le schema des positions a jour quand la position change', async () => {
    const dom = await monterApplication();
    const courante = (): string | null =>
      element(dom, '#positions .position-courante').getAttribute('data-position');

    expect(courante()).toBe('interieur');

    choisir(dom, 'position', 'angle');

    expect(courante()).toBe('angle');
  });
});

describe("l'avertissement de perimetre en rive et en angle", () => {
  const avertissement = (dom: JSDOM): Element | null =>
    dom.window.document.querySelector('[data-role="avertissement-perimetre"]');

  it('apparait des que la position est une rive', async () => {
    const dom = await monterApplication();
    expect(avertissement(dom)).toBeNull();

    choisir(dom, 'position', 'rive');

    expect(avertissement(dom)).not.toBeNull();
  });

  it("apparait aussi en angle", async () => {
    const dom = await monterApplication();

    choisir(dom, 'position', 'angle');

    expect(avertissement(dom)).not.toBeNull();
  });

  it('disparait des qu on revient a une position interieure', async () => {
    const dom = await monterApplication();
    choisir(dom, 'position', 'rive');
    expect(avertissement(dom)).not.toBeNull();

    choisir(dom, 'position', 'interieur');

    expect(avertissement(dom)).toBeNull();
  });
});

describe('les cas que le noyau refuse', () => {
  it("n'efface pas la page sur un poteau circulaire de rive", async () => {
    const dom = await monterApplication();
    saisir(dom, 'V_Ed', '300');
    const dernierValide = verdict(dom);

    choisir(dom, 'forme', 'circulaire');
    choisir(dom, 'position', 'rive');

    // L'exception de perimetreAuNu est attrapee : elle est EXPLIQUEE, et le
    // dernier resultat valide reste lisible plutot que de disparaitre.
    expect(erreurVisible(dom)).toContain('§6.4.5(3)');
    expect(verdict(dom)).toBe(dernierValide);
    expect(element(dom, '#positions svg')).not.toBeNull();
  });

  it('retrouve un resultat des que le cas redevient calculable', async () => {
    const dom = await monterApplication();
    choisir(dom, 'forme', 'circulaire');
    choisir(dom, 'position', 'angle');
    expect(erreurVisible(dom)).not.toBeNull();

    choisir(dom, 'position', 'interieur');

    expect(erreurVisible(dom)).toBeNull();
    expect(verdict(dom)).not.toBeNull();
  });
});

describe('les saisies invalides', () => {
  it("affiche l'erreur sans effacer le dernier resultat valide", async () => {
    const dom = await monterApplication();
    saisir(dom, 'V_Ed', '300');
    const dernierValide = verdict(dom);

    saisir(dom, 'V_Ed', 'beaucoup');

    expect(erreurVisible(dom)).toContain('V_Ed');
    expect(verdict(dom)).toBe(dernierValide);
  });

  it("explique un refus du noyau plutot que de laisser la page muette", async () => {
    const dom = await monterApplication();

    saisir(dom, 'd_y', '-200');

    expect(erreurVisible(dom)).not.toBeNull();
  });

  it("efface l'erreur des que la saisie redevient valide", async () => {
    const dom = await monterApplication();
    saisir(dom, 'V_Ed', 'beaucoup');
    expect(erreurVisible(dom)).not.toBeNull();

    saisir(dom, 'V_Ed', '700');

    expect(erreurVisible(dom)).toBeNull();
  });
});

describe('les champs sans objet sont masques', () => {
  const estMasque = (dom: JSDOM, groupe: string): boolean =>
    (element(dom, `[data-groupe="${groupe}"]`) as HTMLElement).hidden;

  it('masque le diametre tant que le poteau est rectangulaire', async () => {
    const dom = await monterApplication();

    expect(estMasque(dom, 'circulaire')).toBe(true);
    expect(estMasque(dom, 'rectangulaire')).toBe(false);
  });

  it('echange les deux groupes quand la forme change', async () => {
    const dom = await monterApplication();

    choisir(dom, 'forme', 'circulaire');

    expect(estMasque(dom, 'circulaire')).toBe(false);
    expect(estMasque(dom, 'rectangulaire')).toBe(true);
  });

  it("masque le champ beta tant qu'il n'est pas impose", async () => {
    const dom = await monterApplication();

    expect(estMasque(dom, 'beta')).toBe(true);

    cocher(dom, 'beta_impose', true);

    expect(estMasque(dom, 'beta')).toBe(false);
  });

  it('masque les armatures envisagees quand la case est decochee', async () => {
    const dom = await monterApplication();

    expect(estMasque(dom, 'armatures')).toBe(false);

    cocher(dom, 'armatures', false);

    expect(estMasque(dom, 'armatures')).toBe(true);
  });
});
