/**
 * Contenu de la note de calcul commune (`noteDeCalculHtml` d'aedificium-ui).
 *
 * Module PUR. La note lit le dernier etat valide (`EtatExportable`), le meme
 * que le CSV : memes lignes que l'ecran, memes dessins, jamais redessines.
 */

import { nombreAffiche, type ElementNote, type LigneResultat, type NoteDeCalcul, type VerificationNote } from 'aedificium-ui';
import type { ResultatPoinconnement } from '../../src/index';
import { avertissementsDeLaNote, blocsDEntree, type EtatExportable } from './sorties';
import { lignesDuResultat, noteSurU0 } from './view';
import { phrase, textes } from './textes';

const aff = (v: number, d = 3): string => nombreAffiche(v, Math.min(d, 3));
const L = (symbole: string, libelle: string, valeur: string): LigneResultat => ({ symbole, libelle, valeur });

/** Nom de l'element quand il n'est pas renseigne. */
export function nomDeLElement(e: EtatExportable): string {
  return textes().note.element[e.modele.position];
}

/**
 * Verifications : l'ecrasement au nu, puis la resistance sans armatures.
 * Au-dela de v_Rd,c, la seconde n'est pas satisfaite : les armatures
 * dimensionnees figurent dans les calculs, la note ne conclut pas pour autant.
 */
export function verificationsDeLaNote(r: ResultatPoinconnement): VerificationNote[] {
  const t = textes().note;
  const v = (nom: string, clause: string, taux: number): VerificationNote => ({ nom, clause, taux, ok: taux <= 1 });
  return [
    v(t.ecrasement, t.clauseEcrasement, r.v_Ed_u0 / r.v_Rd_max),
    v(t.sansArmatures, t.clauseSansArmatures, r.v_Ed_u1 / r.v_Rd_c),
  ];
}

/** Note du dernier calcul valide. */
export function noteDuCalcul(e: EtatExportable, cartouche: { projet: string; element: string; date: string }): NoteDeCalcul {
  const m = e.modele;
  const t = textes().note;
  const [dalle, poteau, sollicitation] = blocsDEntree(e);
  const ligne = (s: string) => dalle.lignes.find((l) => l.symbole === s) as LigneResultat;
  const bloc = (titre: string, lignes: readonly LigneResultat[], note: string | null = null): ElementNote => ({ type: 'bloc', bloc: { titre, lignes: [...lignes], note } });

  return {
    cartouche: {
      projet: cartouche.projet,
      element: cartouche.element.trim() === '' ? nomDeLElement(e) : cartouche.element,
      date: cartouche.date,
      norme: t.norme,
      outil: t.outil,
    },
    sections: {
      geometrie: [
        bloc(t.dalle, [ligne('d_y'), ligne('d_z')]),
        bloc(t.poteau, poteau.lignes),
        ...(m.armatures
          ? [bloc(t.armatures, [L('s_r', t.sr, `${aff(m.s_r)} mm`), L('alpha', t.alpha, `${aff(m.alpha)}°`)])]
          : []),
        { type: 'figure', svg: e.positions, legende: t.legendePositions },
        { type: 'figure', svg: e.schema, legende: t.legendePerimetres },
      ],
      materiaux: [
        bloc(t.materiaux, [
          ligne('f_ck'),
          L('gamma_c', t.gammaC, aff(m.gamma_c)),
          L('alpha_cc', t.alphaCc, aff(m.alpha_cc)),
          ligne('rho_ly'),
          ligne('rho_lz'),
          ...(m.armatures ? [L('f_ywd', t.fywd, `${aff(m.f_ywd)} MPa`)] : []),
        ]),
      ],
      hypotheses: [
        bloc(t.excentrement, [
          L('β', m.betaImpose ? t.impose : t.simplifie, aff(e.resultat.beta)),
        ]),
        { type: 'liste', items: [...textes().sorties.hypotheses] },
      ],
      charges: [bloc(t.sollicitation, sollicitation.lignes)],
      calculs: [
        bloc(t.verificationTitre, lignesDuResultat(e.resultat), noteSurU0(e.donnees.poteau, e.resultat)),
        { type: 'texte', texte: phrase(e.resultat.motif) },
      ],
    },
    verifications: verificationsDeLaNote(e.resultat),
    avertissements: avertissementsDeLaNote(e),
  };
}
