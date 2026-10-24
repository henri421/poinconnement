/**
 * Les blocs des sorties : entrees, resultats, verdict, hypotheses et
 * avertissements de la note.
 *
 * Module PUR : aucun `document`, aucune API de navigateur. Il ne compose que
 * des donnees, que `export.ts` met ensuite en HTML ou en CSV.
 */

import type { DonneesPoinconnement, PositionPoteau, ResultatPoinconnement } from '../../src/index';
import type { ModeleSaisie } from './form';
import type { BlocExport } from './export';
import { avertissementPerimetre, lignesDuResultat, noteSurU0, titreDuVerdict } from './view';

/** Libelles des valeurs d'union, jamais affichees par leur cle. */
const LIBELLES_FORME: Readonly<Record<ModeleSaisie['forme'], string>> = {
  rectangulaire: 'rectangulaire',
  circulaire: 'circulaire',
};

export const LIBELLES_POSITION: Readonly<Record<PositionPoteau, string>> = {
  interieur: 'intérieur',
  rive: 'rive',
  angle: 'angle',
};

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
        { symbole: 'forme', libelle: 'forme du poteau', valeur: LIBELLES_FORME[m.forme] },
        ...geometrie,
        { symbole: 'position', libelle: 'position dans la dalle', valeur: LIBELLES_POSITION[m.position] },
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
export function blocsDeResultat(sortie: EtatExportable): BlocExport[] {
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
          symbole: 'constat',
          libelle: 'verdict',
          valeur: titreDuVerdict(sortie.resultat.verdict),
        },
      ],
      note: sortie.resultat.motif,
    },
  ];
}

/** Hypotheses et limites rappelees dans la note de calcul. */
export const HYPOTHESES: readonly string[] = [
  'Dalle pleine d epaisseur constante : ni chapiteau, ni dalle allegee, ni precontrainte.',
  'Coefficient beta par valeurs simplifiees du §6.4.3(6) ou impose ; pas de calcul par W1.',
  'Aucune ouverture a proximite du poteau (§6.4.2(3)).',
  'Dispositions constructives des armatures de poinconnement (§9.4.3) non verifiees.',
  'Valeurs recommandees de l EN 1992-1-1 ; une annexe nationale peut les modifier.',
];

/** Les mises en garde a placer en evidence dans la note. */
export function avertissementsDeLaNote(sortie: EtatExportable): string[] {
  const a = avertissementPerimetre(sortie.modele.position);
  return a === null ? [] : [a];
}
