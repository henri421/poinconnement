/**
 * Les blocs des sorties : entrees, resultats, verdict, hypotheses et
 * avertissements de la note.
 *
 * Module PUR : aucun `document`, aucune API de navigateur. Il ne compose que
 * des donnees, que `export.ts` met ensuite en HTML ou en CSV.
 */

import type { DonneesPoinconnement, PositionPoteau, ResultatPoinconnement } from '../../src/index';
import { nombreAffiche } from 'aedificium-ui';
import type { ModeleSaisie } from './form';
import type { BlocExport } from './export';
import { avertissementPerimetre, lignesDuResultat, noteSurU0, titreDuVerdict } from './view';
import { phrase, textes } from './textes';

/** Nombre affiche : trois decimales au plus, sans zeros inutiles. */
const aff = (valeur: number, decimales: number): string =>
  nombreAffiche(valeur, Math.min(decimales, 3));

/** Libelles des valeurs d'union, jamais affichees par leur cle. */
/** Libelle d'une position, jamais son identifiant. */
export const libellePosition = (p: PositionPoteau): string => textes().sorties.positions[p];

/** Tout ce qu'une sortie decrit : le modele, le calcul et les deux dessins. */
export interface EtatExportable {
  modele: ModeleSaisie;
  donnees: DonneesPoinconnement;
  resultat: ResultatPoinconnement;
  schema: string;
  positions: string;
}

/** Les donnees d'entree, dans la meme forme que les resultats. */
export function blocsDEntree(sortie: EtatExportable): BlocExport[] {
  const m = sortie.modele;
  const t = textes().sorties;
  const geometrie =
    m.forme === 'circulaire'
      ? [{ symbole: 'D', libelle: t.D, valeur: `${aff(m.D, 3)} mm` }]
      : [
          { symbole: 'c1', libelle: t.c1, valeur: `${aff(m.c1, 3)} mm` },
          { symbole: 'c2', libelle: t.c2, valeur: `${aff(m.c2, 3)} mm` },
        ];

  return [
    {
      titre: t.dalle,
      lignes: [
        { symbole: 'd_y', libelle: t.dy, valeur: `${aff(m.d_y, 3)} mm` },
        { symbole: 'd_z', libelle: t.dz, valeur: `${aff(m.d_z, 3)} mm` },
        { symbole: 'f_ck', libelle: t.fck, valeur: `${aff(m.f_ck, 3)} MPa` },
        { symbole: 'rho_ly', libelle: t.rhoLy, valeur: aff(m.rho_ly, 3) },
        { symbole: 'rho_lz', libelle: t.rhoLz, valeur: aff(m.rho_lz, 3) },
      ],
      note: null,
    },
    {
      titre: t.poteau,
      lignes: [
        { symbole: t.forme, libelle: t.formeLibelle, valeur: t.formes[m.forme] },
        ...geometrie,
        { symbole: t.position, libelle: t.positionLibelle, valeur: libellePosition(m.position) },
      ],
      note: null,
    },
    {
      titre: t.sollicitation,
      lignes: [{ symbole: 'V_Ed', libelle: t.VEd, valeur: `${aff(m.V_Ed, 3)} kN` }],
      note: null,
    },
  ];
}

/** Les resultats, verdict compris. */
export function blocsDeResultat(sortie: EtatExportable): BlocExport[] {
  const t = textes().sorties;
  return [
    {
      titre: t.verification,
      lignes: lignesDuResultat(sortie.resultat),
      note: noteSurU0(sortie.donnees.poteau, sortie.resultat),
    },
    {
      titre: t.verdict,
      lignes: [
        {
          symbole: t.constat,
          libelle: t.libelleVerdict,
          valeur: titreDuVerdict(sortie.resultat.verdict),
        },
      ],
      note: phrase(sortie.resultat.motif),
    },
  ];
}

/** Hypotheses et limites rappelees dans la note de calcul. */
/** Hypotheses, en francais (tests) ; la note lit `textes().sorties.hypotheses`. */
export const HYPOTHESES: readonly string[] = textes().sorties.hypotheses;

/** Les mises en garde a placer en evidence dans la note. */
export function avertissementsDeLaNote(sortie: EtatExportable): string[] {
  const a = avertissementPerimetre(sortie.modele.position);
  return a === null ? [] : [a];
}
