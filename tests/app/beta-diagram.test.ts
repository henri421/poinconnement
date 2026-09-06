import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { schemaDesPositions } from '../../app/src/beta-diagram';
import type { PositionPoteau } from '../../src/index';

const POSITIONS: PositionPoteau[] = ['interieur', 'rive', 'angle'];

/** Racine SVG du schema, analysee par un vrai parseur plutot qu a la ficelle. */
function racine(courante: PositionPoteau): SVGSVGElement {
  const dom = new JSDOM(`<!doctype html><body>${schemaDesPositions(courante)}</body>`);
  const svg = dom.window.document.querySelector('svg');
  if (svg === null) {
    throw new Error('le schema ne contient pas d element <svg>');
  }
  return svg as unknown as SVGSVGElement;
}

/** Groupes de position, indexes par leur attribut `data-position`. */
function groupes(svg: SVGSVGElement): Map<string, Element> {
  const trouves = new Map<string, Element>();
  for (const groupe of Array.from(svg.querySelectorAll('[data-position]'))) {
    const nom = groupe.getAttribute('data-position');
    if (nom !== null) {
      trouves.set(nom, groupe);
    }
  }
  return trouves;
}

describe('schemaDesPositions', () => {
  it('porte les trois coefficients beta du §6.4.3(6)', () => {
    const texte = racine('interieur').textContent ?? '';

    expect(texte).toContain('1,15');
    expect(texte).toContain('1,4');
    expect(texte).toContain('1,5');
  });

  it('montre les trois positions a la fois, quelle que soit la courante', () => {
    for (const courante of POSITIONS) {
      const trouves = groupes(racine(courante));

      expect(Array.from(trouves.keys()).sort()).toEqual(['angle', 'interieur', 'rive']);
    }
  });

  it('marque la position courante d une classe distincte des deux autres', () => {
    for (const courante of POSITIONS) {
      const trouves = groupes(racine(courante));

      const classeCourante = trouves.get(courante)?.getAttribute('class') ?? '';
      expect(classeCourante).toContain('position-courante');

      for (const autre of POSITIONS.filter((nom) => nom !== courante)) {
        const classeAutre = trouves.get(autre)?.getAttribute('class') ?? '';
        expect(classeAutre).not.toContain('position-courante');
        expect(classeAutre).toContain('position-retrait');
      }
    }
  });

  it('dessine pour chaque position son poteau et son perimetre de controle', () => {
    const trouves = groupes(racine('rive'));

    for (const nom of POSITIONS) {
      const groupe = trouves.get(nom);
      expect(groupe?.querySelector('[data-role="poteau"]')).not.toBeNull();
      expect(groupe?.querySelector('[data-role="perimetre"]')).not.toBeNull();
    }
  });

  it('change de rendu quand la position courante change', () => {
    const rendus = POSITIONS.map((position) => schemaDesPositions(position));

    expect(new Set(rendus).size).toBe(POSITIONS.length);
  });

  it('ne laisse echapper aucun NaN', () => {
    for (const courante of POSITIONS) {
      expect(schemaDesPositions(courante)).not.toContain('NaN');
    }
  });

  it("s adapte a son conteneur : un viewBox, aucune dimension en dur", () => {
    const svg = racine('angle');

    expect(svg.getAttribute('viewBox')).toMatch(/^[-\d. ]+$/);
    expect(svg.getAttribute('width')).toBeNull();
    expect(svg.getAttribute('height')).toBeNull();
  });

  it('rappelle les conditions qui rendent ces trois valeurs licites', () => {
    const texte = racine('interieur').textContent ?? '';

    expect(texte).toContain('6.4.3(6)');
    expect(texte).toContain('cadre');
    expect(texte).toContain('25 %');
  });

  it('avertit que hors de ces conditions beta doit etre impose', () => {
    const texte = racine('interieur').textContent ?? '';

    expect(texte).toContain('W1');
  });
});
