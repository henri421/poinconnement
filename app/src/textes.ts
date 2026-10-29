/**
 * Les textes affiches, en francais et en anglais. PUR.
 *
 * Deux sources :
 * - les textes de l'app (`FR`, `EN`), types : une cle oubliee en anglais ne
 *   compile pas ;
 * - les phrases du noyau (`src/`), ecrites en francais, traduites a
 *   l'affichage par `phrase`.
 *
 * ⚠ Aucun texte ne se lit au chargement d'un module : toujours `textes()` ou
 * `phrase()` AU MOMENT DU RENDU, apres `definirLangue` (main.ts).
 */

import { langueCourante, traducteur } from 'aedificium-ui';

type Position = 'interieur' | 'rive' | 'angle';

const FR = {
  avertissementPerimetre: (position: 'rive' | 'angle') =>
    `Poteau ${position === 'rive' ? 'de rive' : "d'angle"} : le périmètre de contrôle retenu ici est l'offset à 2d, écrêté au bord ` +
    "libre. L'EN 1992-1-1 prévoit, pour cette position, de retenir un périmètre PLUS COURT " +
    "lorsque sa figure en donne un ; cette disposition n'est pas implémentée. Ne pas " +
    "l'appliquer surestime u1, donc sous-estime v_Ed : le résultat ci-dessous peut être " +
    'NON CONSERVATIF. À vérifier à la main, en particulier sur un poteau allongé.',
  verdicts: {
    'aucune-armature-requise': 'Aucune armature de poinçonnement requise',
    'dalle-trop-mince': 'Dalle trop mince : écrasement du béton au nu du poteau',
    'armatures-necessaires': 'Armatures de poinçonnement à prévoir',
  },
  grandeurs: {
    d: 'hauteur utile moyenne (d_y + d_z)/2',
    beta: "coefficient d'excentrement",
    u0: 'périmètre au nu du poteau',
    u1: 'périmètre de contrôle de base, à 2d',
    vEdU0: 'contrainte sollicitante au nu',
    vEdU1: 'contrainte sollicitante sur u1',
    vRdc: 'résistance sans armatures, eq. (6.47)',
    vRdmax: 'écrasement admissible au nu du poteau, §6.4.5(3)',
    Asw: "aire d'armatures par cours satisfaisant l'eq. (6.52)",
    uOut: 'périmètre au-delà duquel les armatures sont inutiles',
  },
  noteU0: (u0: string, contour: string) =>
    `u0 retenu = ${u0} mm : c'est la valeur du §6.4.5(3), plus courte que le contour du poteau en contact avec la dalle (${contour} mm) ` +
    'que montre le tracé. Le calcul retient la plus petite des deux.',
  calculImpossible: (detail: string) => `Calcul impossible : ${detail}`,
  causeInconnue: 'cause inconnue. Vérifiez les valeurs saisies.',
  trace: {
    cote: (nom: string) => `Le tracé demande ${nom} strictement positif (mm).`,
    hauteur: 'Le tracé demande une hauteur utile d strictement positive (mm).',
    aria: 'Tracé en plan du poteau et de ses périmètres de contrôle',
  },
  positions: {
    noms: { interieur: 'poteau intérieur', rive: 'poteau de rive', angle: "poteau d'angle" } as Record<Position, string>,
    conditions: [
      '§6.4.3(6) — ces trois valeurs ne valent que si la stabilité latérale de la structure',
      "ne dépend pas d'un effet de cadre entre dalles et poteaux, ET si les portées adjacentes",
      'ne diffèrent pas de plus de 25 %. Hors de ces conditions, β se calcule par W1',
      '(§6.4.3(3) à (5)), calcul hors du domaine de cet outil : imposez alors votre valeur.',
    ],
    aria: 'Les trois positions de poteau et leur coefficient beta simplifié',
    bords: 'bords libres de la dalle',
  },
  sorties: {
    formes: { rectangulaire: 'rectangulaire', circulaire: 'circulaire' },
    positions: { interieur: 'intérieur', rive: 'rive', angle: 'angle' } as Record<Position, string>,
    dalle: 'Dalle',
    poteau: 'Poteau',
    sollicitation: 'Sollicitation',
    verification: 'Vérification (§6.4)',
    verdict: 'Verdict',
    constat: 'constat',
    libelleVerdict: 'verdict',
    D: 'diamètre du poteau',
    c1: 'côté perpendiculaire au bord libre',
    c2: 'côté parallèle au bord libre',
    dy: 'hauteur utile, direction y',
    dz: 'hauteur utile, direction z',
    fck: 'résistance caractéristique du béton',
    rhoLy: "taux d'armature longitudinale, direction y",
    rhoLz: "taux d'armature longitudinale, direction z",
    forme: 'forme',
    formeLibelle: 'forme du poteau',
    position: 'position',
    positionLibelle: 'position dans la dalle',
    VEd: 'effort de poinçonnement',
    hypotheses: [
      "Dalle pleine d'épaisseur constante : ni chapiteau, ni dalle allégée, ni précontrainte.",
      'Coefficient beta par valeurs simplifiées du §6.4.3(6) ou imposé ; pas de calcul par W1.',
      'Aucune ouverture à proximité du poteau (§6.4.2(3)).',
      'Dispositions constructives des armatures de poinçonnement (§9.4.3) non vérifiées.',
      "Valeurs recommandées de l'EN 1992-1-1 ; une annexe nationale peut les modifier.",
    ],
  },
  note: {
    element: { interieur: 'Poteau intérieur', rive: 'Poteau de rive', angle: "Poteau d'angle" } as Record<Position, string>,
    ecrasement: 'Écrasement du béton au nu du poteau',
    clauseEcrasement: '§6.4.5(3)',
    clauseSansArmatures: '§6.4.4, (6.47)',
    verificationTitre: 'Vérification (§6.4)',
    dalle: 'Dalle',
    poteau: 'Poteau',
    sollicitation: 'Sollicitation',
    sansArmatures: 'Résistance sans armatures de poinçonnement',
    norme: 'EN 1992-1-1:2004, §6.4',
    outil: 'poinçonnement',
    armatures: 'Armatures de poinçonnement envisagées',
    sr: 'espacement radial des cours',
    alpha: 'angle avec le plan de la dalle',
    legendePositions: "Positions du poteau et coefficients d'excentrement",
    legendePerimetres: 'Périmètres de contrôle u0 et u1',
    materiaux: 'Béton et armatures longitudinales',
    gammaC: 'coefficient partiel du béton',
    alphaCc: 'coefficient des effets à long terme',
    fywd: 'limite élastique de calcul des armatures de poinçonnement',
    excentrement: "Coefficient d'excentrement",
    impose: 'imposé',
    simplifie: 'valeur simplifiée du §6.4.3(6)',
  },
  saisie: {
    champ: (champ: string) => `Saisie invalide : le champ ${champ} doit être un nombre.`,
    forme: (forme: string) => `Saisie invalide : forme de poteau inconnue « ${forme} ».`,
    position: (position: string) => `Saisie invalide : position de poteau inconnue « ${position} ».`,
  },
  messages: {
    rienAExporter: 'Aucun calcul valide à exporter. Les sorties décrivent le dernier calcul réussi : corriger la saisie, puis réessayer.',
    nouvelleVersion: 'Une nouvelle version est disponible. Recharger maintenant ?',
  },
};

type Textes = typeof FR;

const EN: Textes = {
  avertissementPerimetre: (position) =>
    `${position === 'rive' ? 'Edge' : 'Corner'} column: the control perimeter used here is the offset at 2d, cut at the free ` +
    'edge. EN 1992-1-1 requires, for this position, a SHORTER perimeter where its figure gives one; this provision is ' +
    'not implemented. Not applying it overestimates u1, hence underestimates v_Ed: the result below may be ' +
    'NOT CONSERVATIVE. Check by hand, in particular for an elongated column.',
  verdicts: {
    'aucune-armature-requise': 'No punching shear reinforcement required',
    'dalle-trop-mince': 'Slab too thin: concrete crushing at the column face',
    'armatures-necessaires': 'Punching shear reinforcement to be provided',
  },
  grandeurs: {
    d: 'mean effective depth (d_y + d_z)/2',
    beta: 'eccentricity factor',
    u0: 'perimeter at the column face',
    u1: 'basic control perimeter, at 2d',
    vEdU0: 'shear stress at the column face',
    vEdU1: 'shear stress on u1',
    vRdc: 'resistance without reinforcement, expression (6.47)',
    vRdmax: 'maximum crushing stress at the column face, 6.4.5(3)',
    Asw: 'area of reinforcement per perimeter satisfying expression (6.52)',
    uOut: 'perimeter beyond which reinforcement is not required',
  },
  noteU0: (u0, contour) =>
    `u0 used = ${u0} mm: this is the value of 6.4.5(3), shorter than the outline of the column in contact with the slab (${contour} mm) ` +
    'shown in the drawing. The calculation uses the smaller of the two.',
  calculImpossible: (detail) => `Calculation impossible: ${detail}`,
  causeInconnue: 'unknown cause. Check the values entered.',
  trace: {
    cote: (nom) => `The drawing requires a strictly positive ${nom} (mm).`,
    hauteur: 'The drawing requires a strictly positive effective depth d (mm).',
    aria: 'Plan view of the column and its control perimeters',
  },
  positions: {
    noms: { interieur: 'internal column', rive: 'edge column', angle: 'corner column' },
    conditions: [
      '6.4.3(6) — these three values only apply where the lateral stability of the structure',
      'does not depend on frame action between the slabs and the columns, AND where the adjacent spans',
      'do not differ in length by more than 25 %. Otherwise, β is calculated with W1',
      '(6.4.3(3) to (5)), a calculation outside the scope of this tool: enter your own value.',
    ],
    aria: 'The three column positions and their simplified beta factor',
    bords: 'free edges of the slab',
  },
  sorties: {
    formes: { rectangulaire: 'rectangular', circulaire: 'circular' },
    positions: { interieur: 'internal', rive: 'edge', angle: 'corner' },
    dalle: 'Slab',
    poteau: 'Column',
    sollicitation: 'Action effect',
    verification: 'Verification (6.4)',
    verdict: 'Verdict',
    constat: 'finding',
    libelleVerdict: 'verdict',
    D: 'diameter of the column',
    c1: 'side perpendicular to the free edge',
    c2: 'side parallel to the free edge',
    dy: 'effective depth, direction y',
    dz: 'effective depth, direction z',
    fck: 'characteristic compressive strength of concrete',
    rhoLy: 'longitudinal reinforcement ratio, direction y',
    rhoLz: 'longitudinal reinforcement ratio, direction z',
    forme: 'shape',
    formeLibelle: 'shape of the column',
    position: 'position',
    positionLibelle: 'position in the slab',
    VEd: 'punching shear force',
    hypotheses: [
      'Solid slab of constant thickness: no column head, no voided slab, no prestressing.',
      'Factor beta from the simplified values of 6.4.3(6) or entered; no calculation with W1.',
      'No opening near the column (6.4.2(3)).',
      'Detailing of the punching shear reinforcement (9.4.3) not checked.',
      'Recommended values of EN 1992-1-1; a National Annex may modify them.',
    ],
  },
  note: {
    element: { interieur: 'Internal column', rive: 'Edge column', angle: 'Corner column' },
    ecrasement: 'Concrete crushing at the column face',
    clauseEcrasement: '6.4.5(3)',
    clauseSansArmatures: '6.4.4, (6.47)',
    verificationTitre: 'Verification (6.4)',
    dalle: 'Slab',
    poteau: 'Column',
    sollicitation: 'Action effect',
    sansArmatures: 'Resistance without punching shear reinforcement',
    norme: 'EN 1992-1-1:2004, 6.4',
    outil: 'poinconnement',
    armatures: 'Punching shear reinforcement considered',
    sr: 'radial spacing of the perimeters',
    alpha: 'angle with the plane of the slab',
    legendePositions: 'Column positions and eccentricity factors',
    legendePerimetres: 'Control perimeters u0 and u1',
    materiaux: 'Concrete and longitudinal reinforcement',
    gammaC: 'partial factor for concrete',
    alphaCc: 'coefficient for long term effects',
    fywd: 'design yield strength of the punching shear reinforcement',
    excentrement: 'Eccentricity factor',
    impose: 'entered',
    simplifie: 'simplified value of 6.4.3(6)',
  },
  saisie: {
    champ: (champ) => `Invalid input: the field ${champ} must be a number.`,
    forme: (forme) => `Invalid input: unknown column shape “${forme}”.`,
    position: (position) => `Invalid input: unknown column position “${position}”.`,
  },
  messages: {
    rienAExporter: 'No valid calculation to export. The outputs describe the last successful calculation: correct the input, then try again.',
    nouvelleVersion: 'A new version is available. Reload now?',
  },
};

export function textes(): Textes {
  return langueCourante() === 'en' ? EN : FR;
}

/** Nom d'une grandeur dans les messages d'erreur du noyau. */
const GRANDEURS: Record<string, string> = {
  'La hauteur utile d': 'The effective depth d',
  'Le coefficient beta': 'The factor beta',
  'Le périmètre u': 'The perimeter u',
  'Le périmètre u1': 'The perimeter u1',
  "L'espacement radial s_r": 'The radial spacing s_r',
  "Le taux d'armature rho_ly": 'The reinforcement ratio rho_ly',
  "Le taux d'armature rho_lz": 'The reinforcement ratio rho_lz',
  'Le coefficient k': 'The factor k',
  'Poteau rectangulaire : c1': 'Rectangular column: c1',
  'Poteau rectangulaire : c2': 'Rectangular column: c2',
  'Poteau circulaire : D': 'Circular column: D',
};
const grandeur = (nom: string): string => GRANDEURS[nom] ?? nom;

const EXACTES: Record<string, string> = {
  "La distance à l'aire chargée doit être un nombre positif ou nul (mm).": 'The distance to the loaded area must be a positive number or zero (mm).',
  "Le §6.4.5(3) de l'EN 1992-1-1:2004 ne donne pas u0 pour un poteau circulaire de rive ou d'angle : cas hors du domaine de l'outil.":
    'Clause 6.4.5(3) of EN 1992-1-1:2004 does not give u0 for a circular edge or corner column: case outside the scope of the tool.',
  'Chaque hauteur utile, d_y et d_z, doit être un nombre strictement positif (mm).': 'Each effective depth, d_y and d_z, must be a strictly positive number (mm).',
  "L'angle alpha des armatures doit être dans ]0 ; pi/2] (rad).": 'The angle alpha of the reinforcement must be in ]0 ; pi/2] (rad).',
  'Les contraintes normales sigma_cy et sigma_cz doivent être finies (MPa).': 'The normal stresses sigma_cy and sigma_cz must be finite (MPa).',
  'V_Ed doit être un effort positif ou nul (kN).': 'V_Ed must be a positive force or zero (kN).',
  'A_sw doit être une aire positive ou nulle (mm2).': 'A_sw must be a positive area or zero (mm2).',
};

/**
 * Traduit une phrase du noyau (motifs, erreurs). En francais, la phrase sort
 * intacte.
 */
export const phrase = traducteur(EXACTES, [
  [/^(.+) doit être une longueur strictement positive \((.+)\)\.$/, (_t, nom: string, u: string) => `${grandeur(nom)} must be a strictly positive length (${u}).`],
  [/^(.+) doit être un nombre strictement positif \((.+)\)\.$/, (_t, nom: string, u: string) => `${grandeur(nom)} must be a strictly positive number (${u}).`],
  [/^(.+) doit être un nombre positif ou nul \((.+)\)\.$/, (_t, nom: string, u: string) => `${grandeur(nom)} must be a positive number or zero (${u}).`],
  [
    /^Écrasement du béton au nu du poteau : v_Ed\(u0\) = (.+) MPa dépasse v_Rd,max = (.+) MPa\. La dalle est trop mince ; des armatures de poinçonnement n'y changeraient rien\. Il faut épaissir la dalle, élargir le poteau, ou monter en résistance de béton\.$/,
    'Concrete crushing at the column face: v_Ed(u0) = $1 MPa exceeds v_Rd,max = $2 MPa. The slab is too thin; punching shear reinforcement would not help. Increase the slab thickness, enlarge the column, or use a stronger concrete.',
  ],
  [
    /^v_Ed\(u1\) = (.+) MPa reste sous v_Rd,c = (.+) MPa : aucune armature de poinçonnement n'est requise\.$/,
    'v_Ed(u1) = $1 MPa remains below v_Rd,c = $2 MPa: no punching shear reinforcement is required.',
  ],
  [
    /^v_Ed\(u1\) = (.+) MPa dépasse v_Rd,c = (.+) MPa sans atteindre l'écrasement au nu du poteau : des armatures de poinçonnement sont nécessaires jusqu'au périmètre u_out,ef = (.+) mm\.$/,
    'v_Ed(u1) = $1 MPa exceeds v_Rd,c = $2 MPa without reaching crushing at the column face: punching shear reinforcement is required up to the perimeter u_out,ef = $3 mm.',
  ],
]);
