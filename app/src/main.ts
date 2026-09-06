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
import { messageDErreur, rendreResultat, schemaDuPoteau } from './view';
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
    effacerErreur();
  } catch (erreur) {
    afficherErreur(messageDErreur(erreur));
  }
}

ecrireModele(modeleParDefaut());
formulaire.addEventListener('input', rafraichir);
formulaire.addEventListener('change', rafraichir);
rafraichir();
