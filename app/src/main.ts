/**
 * Cablage de l'interface de poinconnement.
 *
 * Ce module ne calcule RIEN : il lit les champs, appelle le noyau, et confie a
 * `form`, `view` et `beta-diagram` — tous purs et testes — la lecture de la
 * saisie et la mise en forme du resultat. Tout ce qu'il ajoute, c'est le
 * branchement des evenements et la gestion de ce qui reste affiche quand le
 * calcul echoue.
 */

import { hauteurUtileMoyenne, verifierPoinconnement } from '../../src/index';
import { schemaDesPositions } from './beta-diagram';
import {
  champsDepuisModele,
  donneesDepuisModele,
  modeleDepuisChamps,
  modeleParDefaut,
  type ModeleSaisie,
} from './form';
import {
  avertissementPerimetre,
  lignesDuResultat,
  messageDErreur,
  noteSurU0,
  rendreResultat,
  schemaDuPoteau,
  titreDuVerdict,
} from './view';
import { STYLES_TRACE, noteDeCalculHtml, resultatsEnCsv, svgAutonome } from './export';
import type { BlocExport } from './export';
import { telecharger } from './storage';
import './style.css';

/** Element attendu de la page ; son absence est une erreur de developpement. */
function exige<T extends Element>(selecteur: string): T {
  const trouve = document.querySelector(selecteur);
  if (trouve === null) {
    throw new Error(`element absent de la page : ${selecteur}`);
  }
  return trouve as T;
}

const formulaire = exige<HTMLFormElement>('#formulaire');
const corpsPositions = exige<HTMLElement>('[data-role="positions-corps"]');
const corpsSchema = exige<HTMLElement>('[data-role="schema-corps"]');
const corpsResultat = exige<HTMLElement>('[data-role="resultat-corps"]');
const banniereErreur = exige<HTMLElement>('[data-role="erreur"]');

/** Tous les champs de saisie, quelle que soit leur nature. */
function champs(): (HTMLInputElement | HTMLSelectElement)[] {
  return Array.from(formulaire.querySelectorAll('[data-champ]'));
}

/** Valeurs des champs, telles que `form` les attend : des chaines. */
function valeursDesChamps(): Record<string, string> {
  const valeurs: Record<string, string> = {};
  for (const element of champs()) {
    const nom = element.getAttribute('data-champ');
    if (nom === null) {
      continue;
    }
    valeurs[nom] =
      element instanceof HTMLInputElement && element.type === 'checkbox'
        ? element.checked
          ? 'oui'
          : 'non'
        : element.value;
  }
  return valeurs;
}

/** Ecrit un modele dans le formulaire. Sert au remplissage initial. */
function ecrireModele(modele: ModeleSaisie): void {
  const valeurs = champsDepuisModele(modele);
  for (const element of champs()) {
    const nom = element.getAttribute('data-champ');
    if (nom === null || valeurs[nom] === undefined) {
      continue;
    }
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      element.checked = valeurs[nom] === 'oui';
    } else {
      element.value = valeurs[nom];
    }
  }
}

/** Masque les champs sans objet, pour ne pas demander ce qui n'est pas lu. */
function ajusterLesGroupes(modele: ModeleSaisie): void {
  const visibilites: Record<string, boolean> = {
    rectangulaire: modele.forme === 'rectangulaire',
    circulaire: modele.forme === 'circulaire',
    beta: modele.betaImpose,
    armatures: modele.armatures,
  };
  for (const [groupe, visible] of Object.entries(visibilites)) {
    exige<HTMLElement>(`[data-groupe="${groupe}"]`).hidden = !visible;
  }
}

function afficherErreur(message: string): void {
  banniereErreur.textContent = message;
  banniereErreur.hidden = false;
}

function effacerErreur(): void {
  banniereErreur.textContent = '';
  banniereErreur.hidden = true;
}

/**
 * Recalcule et repeint.
 *
 * Regle de conduite en cas d'echec : on montre l'erreur et on LAISSE EN PLACE
 * le dernier resultat valide. Effacer la page a chaque frappe intermediaire —
 * un champ vide le temps de retaper un nombre — rendrait la saisie illisible ;
 * et un resultat perime affiche sous une erreur bien visible vaut mieux qu'un
 * ecran blanc dont on ne sait pas s'il calcule encore.
 */
function rafraichir(): void {
  const lecture = modeleDepuisChamps(valeursDesChamps());
  if (!lecture.ok) {
    afficherErreur(lecture.message);
    return;
  }

  const modele = lecture.modele;
  ajusterLesGroupes(modele);
  // Le schema des positions ne depend que de la position, deja validee : il
  // reste juste, meme quand le calcul qui suit echoue.
  corpsPositions.innerHTML = schemaDesPositions(modele.position);

  try {
    const donnees = donneesDepuisModele(modele);
    const d = hauteurUtileMoyenne(donnees.d_y, donnees.d_z);
    const schema = schemaDuPoteau(donnees.poteau, d);
    const resultat = verifierPoinconnement(donnees);

    corpsSchema.innerHTML = schema;
    corpsResultat.innerHTML = rendreResultat(resultat, donnees.poteau);
    // Ce que les sorties exporteront : le DERNIER etat valide, jamais une
    // saisie intermediaire fautive.
    derniereSortie = { modele, donnees, resultat, schema, positions: corpsPositions.innerHTML };
    effacerErreur();
  } catch (erreur) {
    afficherErreur(messageDErreur(erreur));
  }
}

// --- Sorties -----------------------------------------------------------------

interface EtatExportable {
  modele: ReturnType<typeof modeleParDefaut>;
  donnees: ReturnType<typeof donneesDepuisModele>;
  resultat: ReturnType<typeof verifierPoinconnement>;
  schema: string;
  positions: string;
}

let derniereSortie: EtatExportable | null = null;

/** Nom de fichier, tire de la position et de la date. */
function baseDeNom(sortie: EtatExportable): string {
  return `poinconnement-${sortie.modele.position}`;
}

function dateDuJour(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Les donnees d'entree, dans la meme forme que les resultats. */
function blocsDEntree(sortie: EtatExportable): BlocExport[] {
  const m = sortie.modele;
  const geometrie =
    m.forme === 'circulaire'
      ? [{ symbole: 'D', libelle: 'diametre du poteau', valeur: `${m.D} mm` }]
      : [
          { symbole: 'c1', libelle: 'cote perpendiculaire au bord libre', valeur: `${m.c1} mm` },
          { symbole: 'c2', libelle: 'cote parallele au bord libre', valeur: `${m.c2} mm` },
        ];

  return [
    {
      titre: 'Dalle',
      lignes: [
        { symbole: 'd_y', libelle: 'hauteur utile, direction y', valeur: `${m.d_y} mm` },
        { symbole: 'd_z', libelle: 'hauteur utile, direction z', valeur: `${m.d_z} mm` },
        { symbole: 'f_ck', libelle: 'resistance caracteristique du beton', valeur: `${m.f_ck} MPa` },
        { symbole: 'rho_ly', libelle: 'taux d armature longitudinale, direction y', valeur: `${m.rho_ly}` },
        { symbole: 'rho_lz', libelle: 'taux d armature longitudinale, direction z', valeur: `${m.rho_lz}` },
      ],
      note: null,
    },
    {
      titre: 'Poteau',
      lignes: [
        { symbole: 'forme', libelle: 'forme du poteau', valeur: m.forme },
        ...geometrie,
        { symbole: 'position', libelle: 'position dans la dalle', valeur: m.position },
      ],
      note: null,
    },
    {
      titre: 'Sollicitation',
      lignes: [{ symbole: 'V_Ed', libelle: 'effort de poinconnement', valeur: `${m.V_Ed} kN` }],
      note: null,
    },
  ];
}

/** Les resultats, verdict compris. */
function blocsDeResultat(sortie: EtatExportable): BlocExport[] {
  return [
    {
      titre: 'Verification (§6.4)',
      lignes: lignesDuResultat(sortie.resultat),
      note: noteSurU0(sortie.donnees.poteau, sortie.resultat),
    },
    {
      titre: 'Verdict',
      lignes: [
        {
          symbole: 'verdict',
          libelle: titreDuVerdict(sortie.resultat.verdict),
          valeur: sortie.resultat.verdict,
        },
      ],
      note: sortie.resultat.motif,
    },
  ];
}

const HYPOTHESES = [
  'Dalle pleine d epaisseur constante : ni chapiteau, ni dalle allegee, ni precontrainte.',
  'Coefficient beta par valeurs simplifiees du §6.4.3(6) ou impose ; pas de calcul par W1.',
  'Aucune ouverture a proximite du poteau (§6.4.2(3)).',
  'Dispositions constructives des armatures de poinconnement (§9.4.3) non verifiees.',
  'Valeurs recommandees de l EN 1992-1-1 ; une annexe nationale peut les modifier.',
];

/** Les mises en garde a placer en evidence dans la note. */
function avertissementsDeLaNote(sortie: EtatExportable): string[] {
  const a = avertissementPerimetre(sortie.modele.position);
  return a === null ? [] : [a];
}

function sansCalculAExporter(): void {
  afficherErreur(
    'Aucun calcul valide a exporter. Les sorties decrivent le dernier calcul reussi : ' +
      'corriger la saisie, puis reessayer.'
  );
}

function exporterDessins(sortie: EtatExportable): void {
  const base = baseDeNom(sortie);
  telecharger(`${base}-positions.svg`, svgAutonome(sortie.positions, STYLES_TRACE), 'image/svg+xml;charset=utf-8');
  telecharger(`${base}-perimetres.svg`, svgAutonome(sortie.schema, STYLES_TRACE), 'image/svg+xml;charset=utf-8');
}

function exporterResultats(sortie: EtatExportable): void {
  telecharger(
    `${baseDeNom(sortie)}-resultats.csv`,
    resultatsEnCsv([...blocsDEntree(sortie), ...blocsDeResultat(sortie)]),
    'text/csv;charset=utf-8'
  );
}

function exporterNote(sortie: EtatExportable): void {
  const html = noteDeCalculHtml(
    {
      titre: `Poteau ${sortie.modele.position}`,
      date: dateDuJour(),
      entrees: blocsDEntree(sortie),
      // Les dessins DEJA produits, jamais redessines.
      dessins: [sortie.positions, sortie.schema],
      resultats: blocsDeResultat(sortie),
      avertissements: avertissementsDeLaNote(sortie),
      hypotheses: HYPOTHESES,
    },
    // STYLES_TRACE et non JETONS : la note porte les DEUX dessins en ligne,
    // et les jetons seuls les laisseraient noirs, exactement comme les SVG
    // exportes separement.
    STYLES_TRACE
  );
  const nom = `${baseDeNom(sortie)}-note.html`;

  // L'ouverture d'onglet est bloquee par defaut chez beaucoup d'utilisateurs.
  // Un bouton qui ne fait rien SANS RIEN DIRE est pire qu'un telechargement
  // inattendu : on retombe alors sur le fichier.
  let onglet: Window | null = null;
  try {
    onglet = window.open('', '_blank') ?? null;
  } catch {
    onglet = null;
  }
  if (onglet === null) {
    telecharger(nom, html, 'text/html;charset=utf-8');
    return;
  }
  try {
    onglet.document.write(html);
    onglet.document.close();
  } catch {
    telecharger(nom, html, 'text/html;charset=utf-8');
  }
}

document.addEventListener('click', (evenement) => {
  const cible = evenement.target;
  if (!(cible instanceof HTMLElement)) return;
  const action = cible.dataset.action;
  if (action === undefined || !action.startsWith('exporter-')) return;

  if (derniereSortie === null) {
    sansCalculAExporter();
    return;
  }
  if (action === 'exporter-dessins') exporterDessins(derniereSortie);
  else if (action === 'exporter-resultats') exporterResultats(derniereSortie);
  else if (action === 'exporter-note') exporterNote(derniereSortie);
});

ecrireModele(modeleParDefaut());
formulaire.addEventListener('input', rafraichir);
formulaire.addEventListener('change', rafraichir);
rafraichir();
