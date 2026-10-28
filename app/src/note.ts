/**
 * Contenu de la note de calcul commune (`noteDeCalculHtml` d'aedificium-ui).
 *
 * Module PUR. La note lit le dernier etat valide (`EtatExportable`), le meme
 * que le CSV : memes lignes que l'ecran, memes dessins, jamais redessines.
 */

import { nombreAffiche, type ElementNote, type LigneResultat, type NoteDeCalcul, type VerificationNote } from 'aedificium-ui';
import type { ResultatPoinconnement } from '../../src/index';
import { HYPOTHESES, avertissementsDeLaNote, blocsDEntree, type EtatExportable } from './sorties';
import { lignesDuResultat, noteSurU0 } from './view';

const aff = (v: number, d = 3): string => nombreAffiche(v, Math.min(d, 3));
const L = (symbole: string, libelle: string, valeur: string): LigneResultat => ({ symbole, libelle, valeur });

/** Nom de l'element quand il n'est pas renseigne. */
export function nomDeLElement(e: EtatExportable): string {
  return { interieur: 'Poteau intérieur', rive: 'Poteau de rive', angle: "Poteau d'angle" }[e.modele.position];
}

/**
 * Verifications : l'ecrasement au nu, puis la resistance sans armatures.
 * Au-dela de v_Rd,c, la seconde n'est pas satisfaite : les armatures
 * dimensionnees figurent dans les calculs, la note ne conclut pas pour autant.
 */
export function verificationsDeLaNote(r: ResultatPoinconnement): VerificationNote[] {
  const v = (nom: string, clause: string, taux: number): VerificationNote => ({ nom, clause, taux, ok: taux <= 1 });
  return [
    v('Écrasement du béton au nu du poteau', '§6.4.5(3)', r.v_Ed_u0 / r.v_Rd_max),
    v('Résistance sans armatures de poinçonnement', '§6.4.4, (6.47)', r.v_Ed_u1 / r.v_Rd_c),
  ];
}

/** Note du dernier calcul valide. */
export function noteDuCalcul(e: EtatExportable, cartouche: { projet: string; element: string; date: string }): NoteDeCalcul {
  const m = e.modele;
  const [dalle, poteau, sollicitation] = blocsDEntree(e);
  const ligne = (s: string) => dalle.lignes.find((l) => l.symbole === s) as LigneResultat;
  const bloc = (titre: string, lignes: readonly LigneResultat[], note: string | null = null): ElementNote => ({ type: 'bloc', bloc: { titre, lignes: [...lignes], note } });

  return {
    cartouche: {
      projet: cartouche.projet,
      element: cartouche.element.trim() === '' ? nomDeLElement(e) : cartouche.element,
      date: cartouche.date,
      norme: 'EN 1992-1-1:2004, §6.4',
      outil: 'poinçonnement',
    },
    sections: {
      geometrie: [
        bloc('Dalle', [ligne('d_y'), ligne('d_z')]),
        bloc('Poteau', poteau.lignes),
        ...(m.armatures
          ? [bloc('Armatures de poinçonnement envisagées', [L('s_r', 'espacement radial des cours', `${aff(m.s_r)} mm`), L('alpha', 'angle avec le plan de la dalle', `${aff(m.alpha)}°`)])]
          : []),
        { type: 'figure', svg: e.positions, legende: "Positions du poteau et coefficients d'excentrement" },
        { type: 'figure', svg: e.schema, legende: 'Périmètres de contrôle u0 et u1' },
      ],
      materiaux: [
        bloc('Béton et armatures longitudinales', [
          ligne('f_ck'),
          L('gamma_c', 'coefficient partiel du béton', aff(m.gamma_c)),
          L('alpha_cc', 'coefficient des effets à long terme', aff(m.alpha_cc)),
          ligne('rho_ly'),
          ligne('rho_lz'),
          ...(m.armatures ? [L('f_ywd', 'limite élastique de calcul des armatures de poinçonnement', `${aff(m.f_ywd)} MPa`)] : []),
        ]),
      ],
      hypotheses: [
        bloc("Coefficient d'excentrement", [
          L('β', m.betaImpose ? 'imposé' : 'valeur simplifiée du §6.4.3(6)', aff(e.resultat.beta)),
        ]),
        { type: 'liste', items: [...HYPOTHESES] },
      ],
      charges: [bloc('Sollicitation', sollicitation.lignes)],
      calculs: [
        bloc('Vérification (§6.4)', lignesDuResultat(e.resultat), noteSurU0(e.donnees.poteau, e.resultat)),
        { type: 'texte', texte: e.resultat.motif },
      ],
    },
    verifications: verificationsDeLaNote(e.resultat),
    avertissements: avertissementsDeLaNote(e),
  };
}
