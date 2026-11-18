/**
 * Cablage de l'interface de poinconnement.
 *
 * Ce module ne calcule RIEN : il lit les champs, appelle le noyau, et confie a
 * `form`, `view` et `beta-diagram` — tous purs et testes — la lecture de la
 * saisie et la mise en forme du resultat. Tout ce qu'il ajoute, c'est le
 * branchement des evenements et la gestion de ce qui reste affiche quand le
 * calcul echoue.
 */

import { avertissementAnnexeLu, brancherFeuilles, lireAnnexe, optionsAnnexe, type BarreFeuilles, type Json } from 'aedificium-ui';
import { coefsDeLAnnexe } from './annexe';
import { nombreAffiche, notationHtml } from 'aedificium-ui';
import { blocsEnTexte, definirLangue, langueDuDocument, notationTexte, noteDeCalculHtml } from 'aedificium-ui';
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
  messageDErreur,
  rendreResultat,
  schemaDuPoteau,
} from './view';
import { STYLES_TRACE, resultatsEnCsv, svgAutonome } from './export';
import {
  blocsDEntree,
  blocsDeResultat,
  type EtatExportable,
} from './sorties';
import { noteDuCalcul } from './note';
import { ouvrirOuTelecharger, telecharger } from './storage';
import { textes } from './textes';
import './style.css';

definirLangue(langueDuDocument(document));

/** Element attendu de la page ; son absence est une erreur de developpement. */
function exige<T extends Element>(selecteur: string): T {
  const trouve = document.querySelector(selecteur);
  if (trouve === null) {
    throw new Error(`élément absent de la page : ${selecteur}`);
  }
  return trouve as T;
}

const formulaire = exige<HTMLFormElement>('#formulaire');
const corpsPositions = exige<HTMLElement>('[data-role="positions-corps"]');
const corpsSchema = exige<HTMLElement>('[data-role="schema-corps"]');
const corpsResultat = exige<HTMLElement>('[data-role="resultat-corps"]');
const banniereErreur = exige<HTMLElement>('[data-role="erreur"]');

// --- Cartouche ---------------------------------------------------------------
// Projet et element saisis HORS du formulaire : ils n'entrent pas dans le
// calcul et ne doivent donc pas le relancer.

/** Cle du cartouche dans le stockage local. */
const CLE_CARTOUCHE = 'poinconnement:cartouche';

const champProjet = exige<HTMLInputElement>('[data-role="projet"]');
const champElement = exige<HTMLInputElement>('[data-role="element"]');
const sectionSorties = exige<HTMLElement>('#sorties');

interface Cartouche {
  projet: string;
  element: string;
}

/** Le cartouche enregistre ; chaines vides si absent ou illisible. */
function lireCartouche(): Cartouche {
  try {
    const brut = localStorage.getItem(CLE_CARTOUCHE);
    if (brut === null) {
      return { projet: '', element: '' };
    }
    const lu = JSON.parse(brut) as Record<string, unknown>;
    return {
      projet: typeof lu.projet === 'string' ? lu.projet : '',
      element: typeof lu.element === 'string' ? lu.element : '',
    };
  } catch {
    return { projet: '', element: '' };
  }
}

/** Enregistre le cartouche courant. Ne recalcule rien. */
function enregistrerCartouche(): void {
  try {
    const cartouche: Cartouche = { projet: champProjet.value, element: champElement.value };
    localStorage.setItem(CLE_CARTOUCHE, JSON.stringify(cartouche));
  } catch {
    // Stockage indisponible : le cartouche reste valable pour la session.
  }
}

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
    'aciers-taux': modele.saisieAciers === 'taux',
    'aciers-barres': modele.saisieAciers === 'barres',
  };
  for (const [groupe, visible] of Object.entries(visibilites)) {
    exige<HTMLElement>(`[data-groupe="${groupe}"]`).hidden = !visible;
  }
}

function afficherErreur(message: string): void {
  banniereErreur.textContent = notationTexte(message);
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
/** Feuilles de calcul d'un projet de la suite. */
let barre: BarreFeuilles | null = null;

function rafraichir(): void {
  barre?.signaler();
  const lecture = modeleDepuisChamps(valeursDesChamps());
  if (!lecture.ok) {
    afficherErreur(lecture.message);
    return;
  }

  const modele = lecture.modele;
  ajusterLesGroupes(modele);
  const rhoCalcule = document.querySelector<HTMLElement>('[data-role="rho-calcule"]');
  if (rhoCalcule !== null) {
    rhoCalcule.innerHTML =
      modele.saisieAciers === 'barres'
        ? notationHtml(
            `rho_ly = ${nombreAffiche(modele.rho_ly, 5)} ; rho_lz = ${nombreAffiche(modele.rho_lz, 5)} ` +
              `(A_s / (1000 d), ${textes().sorties.bande})`
          )
        : '';
  }
  // Le schema des positions ne depend que de la position, deja validee : il
  // reste juste, meme quand le calcul qui suit echoue.
  corpsPositions.innerHTML = schemaDesPositions(modele.position);

  try {
    const donnees = donneesDepuisModele(modele);
    const d = hauteurUtileMoyenne(donnees.d_y, donnees.d_z);
    const resultat = verifierPoinconnement(donnees);
    const schema = schemaDuPoteau(donnees.poteau, d, {
      ...(modele.saisieAciers === 'barres'
        ? { nappes: { phi_y: modele.phi_y, s_y: modele.s_y, phi_z: modele.phi_z, s_z: modele.s_z } }
        : {}),
      ...(modele.armatures ? { cours: { s_r: modele.s_r, u_out_ef: resultat.u_out_ef } } : {}),
    });

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

let derniereSortie: EtatExportable | null = null;

/** Nom de fichier, tire de la position et de la date. */
function baseDeNom(sortie: EtatExportable): string {
  return `poinconnement-${sortie.modele.position}`;
}

function dateDuJour(): string {
  return new Date().toISOString().slice(0, 10);
}

function sansCalculAExporter(): void {
  afficherErreur(textes().messages.rienAExporter);
}

/**
 * Un dessin par bouton : deux telechargements lances d'un meme clic, les
 * navigateurs bloquent le second sans prevenir.
 */
function exporterDessin(sortie: EtatExportable, quoi: 'positions' | 'perimetres'): void {
  const svg = quoi === 'positions' ? sortie.positions : sortie.schema;
  telecharger(`${baseDeNom(sortie)}-${quoi}.svg`, svgAutonome(svg, STYLES_TRACE), 'image/svg+xml;charset=utf-8');
}

function exporterResultats(sortie: EtatExportable): void {
  telecharger(
    `${baseDeNom(sortie)}-resultats.csv`,
    resultatsEnCsv(blocsEnTexte([...blocsDEntree(sortie), ...blocsDeResultat(sortie)])),
    'text/csv;charset=utf-8'
  );
}

function exporterNote(sortie: EtatExportable): void {
  // Valeurs courantes des champs, pas celles du stockage : ce que l'on voit
  // est ce que la note portera.
  const html = noteDeCalculHtml(
    noteDuCalcul(sortie, {
      projet: champProjet.value,
      element: champElement.value,
      date: dateDuJour(),
    }),
    // STYLES_TRACE et non JETONS : la note porte les DEUX dessins en ligne,
    // et les jetons seuls les laisseraient noirs, exactement comme les SVG
    // exportes separement.
    STYLES_TRACE
  );
  const nom = `${baseDeNom(sortie)}-note.html`;

  // Onglet si possible, sinon telechargement : jamais un bouton muet.
  ouvrirOuTelecharger(nom, html);
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
  if (action === 'exporter-positions') exporterDessin(derniereSortie, 'positions');
  else if (action === 'exporter-perimetres') exporterDessin(derniereSortie, 'perimetres');
  else if (action === 'exporter-resultats') exporterResultats(derniereSortie);
  else if (action === 'exporter-note') exporterNote(derniereSortie);
});

const selecteurAnnexe = formulaire.querySelector<HTMLSelectElement>('[data-role="annexe"]');
const bandeauAnnexe = formulaire.querySelector<HTMLElement>('[data-role="bandeau-annexe"]');
if (selecteurAnnexe !== null) selecteurAnnexe.innerHTML = optionsAnnexe('recommande');

/** Bandeau de l'annexe luxembourgeoise, tant qu'elle n'est pas verifiee. */
function majBandeauAnnexe(): void {
  if (bandeauAnnexe === null || selecteurAnnexe === null) return;
  bandeauAnnexe.textContent = avertissementAnnexeLu();
  bandeauAnnexe.hidden = selecteurAnnexe.value !== 'lu' || bandeauAnnexe.textContent === '';
}

ecrireModele(modeleParDefaut());
majBandeauAnnexe();
// Changer d'annexe repremplit gamma_c, alpha_cc et k de v_Rd,max ; ils restent modifiables ensuite.
formulaire.addEventListener('change', (ev) => {
  if (ev.target !== selecteurAnnexe || selecteurAnnexe === null) return;
  const c = coefsDeLAnnexe(lireAnnexe(selecteurAnnexe.value));
  const v = champsDepuisModele({ ...modeleParDefaut(), ...c });
  for (const cle of ['gamma_c', 'alpha_cc', 'k_vRd_max'] as const) {
    const champ = formulaire.querySelector<HTMLInputElement>(`[data-champ="${cle}"]`);
    if (champ !== null) champ.value = v[cle] ?? '';
  }
  majBandeauAnnexe();
});
formulaire.addEventListener('input', rafraichir);
formulaire.addEventListener('change', rafraichir);

const cartouche = lireCartouche();
champProjet.value = cartouche.projet;
champElement.value = cartouche.element;
sectionSorties.addEventListener('input', enregistrerCartouche);

barre = brancherFeuilles({
  app: 'poinconnement',
  nomApp: document.querySelector('header h1')?.textContent ?? 'poinconnement',
  conteneur: document.querySelector('[data-role="feuilles"]') as HTMLElement,
  lire: () => valeursDesChamps() as Json,
  charger: (d) => {
    // Une feuille enregistree avant le lot E n'a pas d'annexe : repartir des valeurs par defaut.
    ecrireModele(modeleParDefaut());
    if (d !== null) {
      const v = d as Record<string, string>;
      for (const el of champs()) {
        const valeur = v[el.getAttribute('data-champ') ?? ''];
        if (valeur === undefined) continue;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = valeur === 'oui';
        else el.value = valeur;
      }
    }
    rafraichir();
    majBandeauAnnexe();
  },
});

rafraichir();

// Hors navigateur (tests), pas de service worker.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void import('./pwa').then((m) => m.enregistrerServiceWorker());
}
