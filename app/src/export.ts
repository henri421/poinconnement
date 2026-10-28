import type { LigneResultat } from './view';
import {
  JETONS,
  resultatsEnCsv as resultatsEnCsvCommun,
  svgAutonome as svgAutonomeCommun,
} from 'aedificium-ui';

export { JETONS };

/** Enveloppe un SVG de la page dans un document autonome, styles INLINES. */
export function svgAutonome(svg: string, styles: string): string {
  return svgAutonomeCommun(svg, styles);
}

/** Les resultats affiches, en CSV (point-virgule, BOM, aucun bloc omis). */
export function resultatsEnCsv(blocs: BlocExport[]): string {
  return resultatsEnCsvCommun(blocs);
}

/**
 * Les sorties : ce qui fait quitter la page a ce qu'elle calcule.
 *
 * Tout ici est PUR — aucune API de navigateur, aucun `document`. Le
 * telechargement lui-meme vit dans `storage.ts`. C'est ce qui rend testable
 * tout ce qui peut se tromper : separateurs, encodage, styles des dessins.
 *
 * La note de calcul ne vit PLUS ici : elle vient de `aedificium-ui`, commune
 * aux apps de la suite (`noteDeCalculHtml`).
 */

/** Un bloc affichable, tel que l'ecran le montre. */
export interface BlocExport {
  titre: string;
  lignes: readonly LigneResultat[];
  /** Motif d'indisponibilite, ou precision. `null` s'il n'y en a pas. */
  note: string | null;
}


/**
 * LES STYLES DU TRACE, jetons compris.
 *
 * ⚠ POURQUOI `JETONS` NE SUFFIT PAS, et pourquoi les dessins exportes
 * sortaient entierement NOIRS.
 *
 * `JETONS` ne porte que le bloc `:root` : il DEFINIT `--texte`, `--accent`,
 * `--beton`… mais aucune regle ne les APPLIQUE. Les regles qui peignent le
 * trace vivent dans `style.css`, sous `.schema-positions …` et
 * `.schema-poteau …`, et un document exporte ne voit pas cette feuille. Sans
 * elles, chaque forme retombe sur les defauts SVG — `fill: black`,
 * `stroke: none` — et le dessin sort en aplat noir uniforme : le poteau, la
 * dalle et les perimetres deviennent indiscernables.
 *
 * Les selecteurs sont recopies VERBATIM, descendants compris : les deux
 * traces portent bien `class="schema-positions"` et `class="schema-poteau"`
 * sur leur balise `<svg>` racine, qui reste donc l'ancetre attendu une fois
 * le document isole.
 *
 * Seules les regles de PEINTURE sont reprises. Les regles de mise en page de
 * `style.css` — `width: 100%`, `max-height: 22rem` — dimensionnent le dessin
 * DANS la page ; hors d'elle, elles contraindraient un document dont le
 * lecteur choisit deja l'echelle.
 *
 * Toute evolution des regles de trace dans `style.css` doit etre reportee
 * ici, comme celle du `:root` l'est deja dans `JETONS`.
 */
export const STYLES_TRACE = `${JETONS}

svg {
  background: var(--surface);
  color-scheme: light;
  /*
   * La police est AJOUTEE : dans la page, les textes du trace heritent celle
   * du corps de page. Hors de la page il n'y a plus de corps, et le dessin
   * sortirait dans la police par defaut du visualiseur.
   */
  font-family: var(--sans);
}

/*
 * Le trace en plan est a l'echelle du modele, en millimetres : sans cette
 * regle, les epaisseurs de trait seraient multipliees par le facteur
 * d'echelle et le dessin sortirait en gros traits baveux.
 */
.schema-poteau * { vector-effect: non-scaling-stroke; }

.schema-positions .dalle-fond { fill: var(--beton); stroke: none; }
.schema-positions .bord-libre { fill: none; stroke: var(--texte); stroke-width: 3; }
.schema-positions .bord-libre-nom { fill: var(--texte); font-size: 12px; }
.schema-positions .poteau { fill: var(--texte); }
.schema-positions .perimetre {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-dasharray: 7 5;
}
.schema-positions .nom { fill: var(--texte); font-size: 14px; }
.schema-positions .beta {
  fill: var(--accent);
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 700;
}
.schema-positions .position-retrait { opacity: 0.34; }
.schema-positions .position-courante .beta { font-size: 17px; }
.schema-positions .conditions { fill: var(--texte-doux); font-size: 12px; }

.schema-poteau .dalle { fill: var(--beton); }
.schema-poteau .poteau { fill: var(--texte); }
.schema-poteau .perimetre-u0 { fill: none; stroke: var(--accent); stroke-width: 3; }
.schema-poteau .perimetre-u1 {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-dasharray: 8 6;
}
.schema-poteau .bord-libre { fill: none; stroke: var(--texte); stroke-width: 3; }`;

