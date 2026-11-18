/**
 * Annexe nationale (lot E, audit R4). Module PUR.
 *
 * gamma_c et alpha_cc sont preremplis par l'annexe choisie (valeurs recommandees ou
 * Luxembourg, table commune `AN_LU` d'aedificium-ui) et restent modifiables ; une
 * valeur differente de celle de l'annexe est marquee imposee par l'utilisateur.
 */

import { nombreAffiche, valeurLu, type AnnexeNationale } from 'aedificium-ui';
import { textes } from './textes';

export const COEFS = ['gamma_c', 'alpha_cc', 'k_vRd_max'] as const;
export type CleCoef = (typeof COEFS)[number];

const EN = 'EN 1992-1-1:2004, valeur recommandée';
const RECOMMANDEES: Record<CleCoef, { valeur: number; source: string }> = {
  gamma_c: { valeur: 1.5, source: `${EN}, tableau 2.1N` },
  alpha_cc: { valeur: 1, source: `${EN}, §3.1.6(1)P` },
  k_vRd_max: { valeur: 0.4, source: 'EN 1992-1-1:2004+AC:2010, valeur recommandée, §6.4.5(3), note' },
};
const CLE_LU: Record<CleCoef, string> = { gamma_c: 'gamma_C', alpha_cc: 'alpha_cc', k_vRd_max: 'k_vRd_max' };
const CLAUSES: Record<CleCoef, string> = { gamma_c: 'tableau 2.1N', alpha_cc: '3.1.6(1)P', k_vRd_max: '6.4.5(3)' };

/** Valeur et source de chaque coefficient selon l'annexe. */
export function valeursDeLAnnexe(a: AnnexeNationale): Record<CleCoef, { valeur: number; source: string }> {
  if (a !== 'lu') return { ...RECOMMANDEES };
  return {
    gamma_c: valeurLu('EN 1992-1-1', CLE_LU.gamma_c, RECOMMANDEES.gamma_c, CLAUSES.gamma_c),
    alpha_cc: valeurLu('EN 1992-1-1', CLE_LU.alpha_cc, RECOMMANDEES.alpha_cc, CLAUSES.alpha_cc),
    k_vRd_max: valeurLu('EN 1992-1-1', CLE_LU.k_vRd_max, RECOMMANDEES.k_vRd_max, CLAUSES.k_vRd_max),
  };
}

export function coefsDeLAnnexe(a: AnnexeNationale): Record<CleCoef, number> {
  const v = valeursDeLAnnexe(a);
  return { gamma_c: v.gamma_c.valeur, alpha_cc: v.alpha_cc.valeur, k_vRd_max: v.k_vRd_max.valeur };
}

/** Source d'un coefficient retenu : celle de l'annexe, ou « imposee » s'il en differe. */
export function sourceDuCoef(a: AnnexeNationale, cle: CleCoef, valeur: number): string {
  const b = valeursDeLAnnexe(a)[cle];
  return valeur === b.valeur ? b.source : textes().note.imposee(nombreAffiche(b.valeur, 3), b.source);
}
