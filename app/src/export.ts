import type { LigneResultat } from './view';
import { echapper } from './view';

/**
 * Les sorties : ce qui fait quitter la page a ce qu'elle calcule.
 *
 * Tout ici est PUR — aucune API de navigateur, aucun `document`. Le
 * telechargement lui-meme vit dans `storage.ts`. C'est ce qui rend testable
 * tout ce qui peut se tromper : composition des documents, echappement,
 * separateurs, encodage.
 *
 * Aucune dependance ajoutee : ni generateur de PDF, ni gabarits. Le navigateur
 * imprime deja tres bien du HTML.
 */

/** Un bloc affichable, tel que l'ecran le montre. */
export interface BlocExport {
  titre: string;
  lignes: LigneResultat[];
  /** Motif d'indisponibilite, ou precision. `null` s'il n'y en a pas. */
  note: string | null;
}

/**
 * Les jetons de l'identite graphique, embarques dans les documents exportes.
 *
 * Copie du `:root` de `style.css`. Un document exporte est AUTONOME : il ne
 * voit pas la feuille de la page, et sans cette copie il s'ouvrirait sans
 * couleur — voire noir sur noir. Toute evolution du `:root` doit etre
 * reportee ici.
 */
export const JETONS = `:root {
  --fond: #f7f7f6;
  --surface: #ffffff;
  --surface-appui: #f2f1ec;
  --texte: #1a1a1a;
  --texte-doux: #4a4842;
  --texte-faible: #6a6862;
  --bordure: #c8c6c0;
  --bordure-douce: #eceae4;
  --accent: #1e5aa8;
  --accent-doux: #eaf1f9;
  --compression: #2f5d8a;
  --traction: #a8442a;
  --beton: #e7eaee;
  --neutre: #9a978f;
  --ok: #1f6f3f;      --ok-fond: #eaf4ee;
  --alerte: #8a6d00;  --alerte-fond: #fdf6e3;
  --refus: #a52121;   --refus-fond: #f8ecec;
  --sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --rayon: 4px;
  --rayon-petit: 3px;
  color-scheme: light;
}`;

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

const DECLARATION_XML = '<?xml version="1.0" encoding="UTF-8"?>';
const NAMESPACE_SVG = 'http://www.w3.org/2000/svg';

/** Les styles voyagent dans un CDATA : ils contiennent des `>` et des `&`. */
function baliseStyle(styles: string): string {
  return `<style type="text/css"><![CDATA[\n${styles}\n]]></style>`;
}

/**
 * Enveloppe un SVG de la page dans un document autonome, styles INLINES.
 *
 * N'en retient que le SVG : ce que la page place autour (legendes, notes) est
 * du HTML, et le laisser casserait le XML.
 */
export function svgAutonome(svg: string, styles: string): string {
  const debut = /<svg\b[^>]*>/i.exec(svg);
  const fin = svg.lastIndexOf('</svg>');

  // Rien d'exploitable : un document vide mais VALIDE, plutot qu'un fichier
  // tronque que le lecteur ne saurait pas ouvrir.
  if (debut === null || fin < debut.index) {
    return `${DECLARATION_XML}\n<svg xmlns="${NAMESPACE_SVG}">${baliseStyle(styles)}</svg>`;
  }

  const ouverture = /\bxmlns\s*=/.test(debut[0])
    ? debut[0]
    : debut[0].replace(/^<svg\b/i, `<svg xmlns="${NAMESPACE_SVG}"`);

  return (
    `${DECLARATION_XML}\n${ouverture}${baliseStyle(styles)}` +
    `${svg.slice(debut.index + debut[0].length, fin)}</svg>`
  );
}

// --- CSV ---------------------------------------------------------------------

/**
 * Le point-virgule, et pas la virgule.
 *
 * Le separateur decimal de l'interface est la VIRGULE — `nombreFr` la produit
 * partout. La prendre aussi comme separateur de colonnes couperait chaque
 * nombre en deux a l'ouverture.
 */
const SEPARATEUR = ';';
const FIN_DE_LIGNE = '\r\n';

/**
 * Marque d'ordre des octets. Sans elle, un tableur lit le fichier dans
 * l'encodage de la machine et massacre les accents comme les σ, ρ et ν dont
 * les libelles de ce module sont peuples.
 */
const BOM = '﻿';

function champCsv(valeur: string): string {
  if (!/[;"\r\n]/.test(valeur)) return valeur;
  return `"${valeur.replace(/"/g, '""')}"`;
}

function ligneCsv(champs: string[]): string {
  return champs.map(champCsv).join(SEPARATEUR);
}

/**
 * Les resultats affiches, en tableau.
 *
 * AUCUN BLOC N'EST OMIS. Ce qui n'a pas ete calcule sort avec son motif : une
 * absence silencieuse ferait croire au lecteur que la verification a eu lieu.
 */
export function resultatsEnCsv(blocs: BlocExport[]): string {
  const lignes = [ligneCsv(['Bloc', 'Symbole', 'Grandeur', 'Valeur'])];

  for (const bloc of blocs) {
    for (const l of bloc.lignes) {
      lignes.push(ligneCsv([bloc.titre, l.symbole, l.libelle, l.valeur]));
    }
    // Le motif sort meme sans ligne : c'est justement le cas ou il porte
    // toute l'information.
    if (bloc.note !== null) lignes.push(ligneCsv([bloc.titre, '', bloc.note, '']));
  }

  return BOM + lignes.join(FIN_DE_LIGNE) + FIN_DE_LIGNE;
}

// --- Note de calcul ----------------------------------------------------------

export interface NoteDeCalcul {
  titre: string;
  date: string;
  entrees: BlocExport[];
  /** SVG deja produits par la page, jamais redessines. */
  dessins: string[];
  resultats: BlocExport[];
  /** Mises en garde a placer en evidence, avant les resultats. */
  avertissements: string[];
  hypotheses: string[];
}

const AIDE_AU_CALCUL =
  "Outil d'aide au calcul. La verification finale et la responsabilite incombent a " +
  "l'ingenieur du projet. Cette note est un compte rendu, pas une justification " +
  'reglementaire signee : elle porte les hypotheses, elle n\'engage personne.';

const STYLE_NOTE = `
  body { margin: 0; padding: 24px 28px; background: var(--surface); color: var(--texte);
         font: 14px/1.5 var(--sans); }
  h1 { font-size: 1.1rem; font-weight: normal; letter-spacing: .02em; margin: 0 0 .2rem; }
  h2 { font-size: .95rem; font-weight: 600; margin: 1.6rem 0 .5rem;
       border-bottom: 1px solid var(--bordure); padding-bottom: .25rem; }
  h3 { font-size: .8rem; font-weight: 600; margin: 1rem 0 .35rem; }
  .date { color: var(--texte-faible); font-size: .8rem; margin: 0 0 1.2rem; }
  table { border-collapse: collapse; width: 100%; margin: .3rem 0 .6rem; }
  td { border-bottom: 1px solid var(--bordure-douce); padding: .25rem .4rem; vertical-align: top; }
  td.sym { font-family: var(--mono); width: 7rem; background: var(--surface-appui); }
  td.lib { color: var(--texte-doux); }
  td.val { font-family: var(--mono); font-variant-numeric: tabular-nums; text-align: right;
           white-space: nowrap; }
  .note { color: var(--texte-doux); font-size: .8rem; margin: .2rem 0 .8rem; }
  .avertissement { border-left: 3px solid var(--alerte); background: var(--alerte-fond);
                   color: var(--alerte); padding: .5rem .7rem; border-radius: var(--rayon);
                   margin: .5rem 0; font-size: .82rem; }
  .dessin { margin: .6rem 0 1rem; page-break-inside: avoid; }
  .dessin svg { max-width: 100%; height: auto; }
  .pied { margin-top: 2rem; padding-top: .6rem; border-top: 1px solid var(--bordure);
          color: var(--texte-doux); font-size: .78rem; }
  ul { margin: .3rem 0 .6rem; padding-left: 1.1rem; color: var(--texte-doux); font-size: .82rem; }
  @media print { body { background: #fff; padding: 0; } h2 { page-break-after: avoid; } }
`;

function tableDuBloc(bloc: BlocExport): string {
  const lignes = bloc.lignes
    .map(
      (l) =>
        `<tr><td class="sym">${echapper(l.symbole)}</td>` +
        `<td class="lib">${echapper(l.libelle)}</td>` +
        `<td class="val">${echapper(l.valeur)}</td></tr>`
    )
    .join('');

  const table = lignes === '' ? '' : `<table>${lignes}</table>`;
  // Le motif est rendu MEME sans ligne : c'est justement le cas ou il porte
  // toute l'information.
  const note = bloc.note === null ? '' : `<p class="note">${echapper(bloc.note)}</p>`;

  return `<h3>${echapper(bloc.titre)}</h3>${table}${note}`;
}

/**
 * La note de calcul : un document HTML AUTONOME, imprimable en PDF par le
 * navigateur.
 *
 * Elle porte les valeurs INTERMEDIAIRES et pas seulement les resultats : un
 * `v_Rd,c` sans son `k`, son `rho_l` et son `sigma_cp` n'est pas verifiable
 * par un tiers, et c'est a cela qu'une note de calcul sert.
 *
 * Elle NE CONCLUT PAS a la place de l'ingenieur — elle rapporte les verdicts
 * des modules, sans avis de synthese — et ne masque AUCUNE verification non
 * applicable : ce qui n'a pas ete calcule y figure avec son motif.
 */
export function noteDeCalculHtml(note: NoteDeCalcul, styles: string): string {
  const avertissements = note.avertissements
    .map((a) => `<p class="avertissement">${echapper(a)}</p>`)
    .join('');

  const dessins = note.dessins.map((svg) => `<div class="dessin">${svg}</div>`).join('');

  const hypotheses =
    note.hypotheses.length === 0
      ? ''
      : `<h2>Hypotheses et limites</h2><ul>${note.hypotheses
          .map((h) => `<li>${echapper(h)}</li>`)
          .join('')}</ul>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Note de calcul — ${echapper(note.titre)}</title>
<style>${styles}${STYLE_NOTE}</style></head>
<body>
<h1>Note de calcul — poinconnement (EN 1992-1-1:2004 §6.4)</h1>
<p class="date">${echapper(note.titre)} · ${echapper(note.date)}</p>
${avertissements}
<h2>Donnees d entree</h2>${note.entrees.map(tableDuBloc).join('')}
<h2>Geometrie et perimetres</h2>${dessins}
<h2>Verifications</h2>${note.resultats.map(tableDuBloc).join('')}
${hypotheses}
<p class="pied">${AIDE_AU_CALCUL}</p>
</body></html>`;
}
