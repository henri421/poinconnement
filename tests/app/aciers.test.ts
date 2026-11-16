// Etape 10, C7 (audit du 10/11/2026, U2) : armatures longitudinales saisies par
// diametre et espacement, rho_l calcule, vue en plan des nappes et des cours.
// Test d'acceptation : ne pas modifier.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { perimetreDeControle, type Poteau } from '../../src/index';
import { champsDepuisModele, modeleDepuisChamps, modeleParDefaut, tauxDepuisBarres } from '../../app/src/form';
import { schemaDuPoteau } from '../../app/src/view';
import { blocsDEntree } from '../../app/src/sorties';

const aire = (phi: number) => (Math.PI * phi * phi) / 4;

describe('rho_l depuis les barres (6.4.4(1))', () => {
  it('A_s = pi phi^2/4 . 1000/s par metre, rho = A_s / (1000 d)', () => {
    const r = tauxDepuisBarres(16, 150, 220);
    expect(r.As).toBeCloseTo((aire(16) * 1000) / 150, 9);
    expect(r.rho).toBeCloseTo((aire(16) * 1000) / 150 / (1000 * 220), 12);
  });

  it('diametre, espacement ou hauteur utile non positifs refuses', () => {
    expect(() => tauxDepuisBarres(0, 150, 220)).toThrow();
    expect(() => tauxDepuisBarres(16, 0, 220)).toThrow();
    expect(() => tauxDepuisBarres(16, 150, -1)).toThrow();
  });
});

describe('saisie des armatures longitudinales', () => {
  const base = () => champsDepuisModele(modeleParDefaut());

  it('par defaut, la saisie reste par taux (feuilles existantes inchangees)', () => {
    const m = modeleParDefaut();
    expect(m.saisieAciers).toBe('taux');
    const l = modeleDepuisChamps(base());
    expect(l.ok && l.modele.rho_ly).toBe(0.008);
  });

  it('en barres : rho_ly et rho_lz calcules depuis phi, s et d de chaque direction', () => {
    const l = modeleDepuisChamps({
      ...base(), saisie_aciers: 'barres', d_y: '220', d_z: '200',
      phi_y: '16', s_y: '150', phi_z: '14', s_z: '150', rho_ly: '', rho_lz: '',
    });
    expect(l.ok).toBe(true);
    if (!l.ok) return;
    expect(l.modele.saisieAciers).toBe('barres');
    expect(l.modele.rho_ly).toBeCloseTo((aire(16) * 1000) / 150 / 220000, 12);
    expect(l.modele.rho_lz).toBeCloseTo((aire(14) * 1000) / 150 / 200000, 12);
    expect(l.modele.phi_y).toBe(16);
    expect(l.modele.s_z).toBe(150);
  });

  it('en barres : un espacement manquant est refuse en nommant le champ', () => {
    const l = modeleDepuisChamps({ ...base(), saisie_aciers: 'barres', s_y: '' });
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.message).toContain('s_y');
  });

  it('les champs des barres font l aller-retour', () => {
    const c = champsDepuisModele({ ...modeleParDefaut(), saisieAciers: 'barres', phi_y: 20, s_y: 125 });
    expect(c.saisie_aciers).toBe('barres');
    expect(c.phi_y).toBe('20');
    expect(c.s_y).toBe('125');
  });

  it('la note decrit les barres saisies', () => {
    const l = modeleDepuisChamps({ ...base(), saisie_aciers: 'barres', phi_y: '16', s_y: '150', phi_z: '14', s_z: '200' });
    if (!l.ok) throw new Error(l.message);
    const blocs = blocsDEntree({ modele: l.modele } as never);
    const texte = JSON.stringify(blocs);
    expect(texte).toContain('φ16');
    expect(texte).toContain('150 mm');
    expect(texte).toContain('mm²/m');
  });
});

describe('vue en plan des nappes et des cours', () => {
  const p: Poteau = { forme: 'rectangulaire', c1: 400, c2: 400, position: 'interieur' };

  it('sans options, le schema reste celui des perimetres', () => {
    const s = schemaDuPoteau(p, 200);
    expect(s).not.toContain('data-role="bande-rho"');
    expect(s).not.toContain('data-role="barre-y"');
  });

  it('avec les nappes : bande c + 3d et barres des deux directions', () => {
    const s = schemaDuPoteau(p, 200, { nappes: { phi_y: 16, s_y: 150, phi_z: 14, s_z: 150 } });
    expect(s).toContain('data-role="bande-rho"');
    expect((s.match(/data-role="barre-y"/g) ?? []).length).toBeGreaterThan(4);
    expect((s.match(/data-role="barre-z"/g) ?? []).length).toBeGreaterThan(4);
  });

  it('avec les cours : de 0,5d en s_r jusqu a 1,5d en deca de u_out,ef (6.4.5(4))', () => {
    // u_out,ef a 1000 mm du nu : derniers cours a <= 700 mm -> 100, 250, 400, 550, 700.
    const s = schemaDuPoteau(p, 200, { cours: { s_r: 150, u_out_ef: perimetreDeControle(p, 1000) } });
    expect((s.match(/data-role="cours"/g) ?? []).length).toBe(5);
    expect(s).toContain('data-role="perimetre-uout"');
  });
});

describe('page', () => {
  for (const page of ['app/index.html', 'app/en/index.html']) {
    it(`${page} : choix de saisie et champs des barres`, () => {
      const h = readFileSync(new URL(`../../${page}`, import.meta.url), 'utf8');
      for (const champ of ['saisie_aciers', 'phi_y', 's_y', 'phi_z', 's_z']) expect(h).toContain(`data-champ="${champ}"`);
      expect(h).toContain('data-groupe="aciers-barres"');
      expect(h).toContain('data-groupe="aciers-taux"');
      expect(h).toContain('data-role="rho-calcule"');
    });
  }
});
