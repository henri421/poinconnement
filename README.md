# Poinçonnement des dalles — EN 1992-1-1:2004 §6.4

Vérification du poinçonnement d'une dalle pleine au droit d'un poteau, selon
l'**EN 1992-1-1:2004** (Eurocode 2, 1ʳᵉ génération), §6.4.

> ⚠ **Aide au calcul.** Cet outil constate, il ne prescrit pas. Il rend des
> contraintes, des périmètres et l'aire d'armatures qui satisfait l'inéquation
> de la norme — jamais un plan de ferraillage. Les résultats relèvent de la
> responsabilité de l'ingénieur qui les emploie, et doivent être vérifiés.

## Ce que fait l'outil

À partir d'une géométrie de poteau, d'une épaisseur utile, d'un béton, de taux
d'armature longitudinale et d'un effort de poinçonnement, il rend **trois
verdicts distincts**, qui n'appellent pas la même correction :

| Verdict | Condition | Ce qu'il faut en faire |
| --- | --- | --- |
| `aucune-armature-requise` | `v_Ed(u₁) ≤ v_Rd,c` | rien de plus |
| `dalle-trop-mince` | `v_Ed(u₀) > v_Rd,max` | épaissir la dalle, élargir le poteau ou monter en résistance — **aucune armature n'y remédie** |
| `armatures-necessaires` | entre les deux | disposer des armatures de poinçonnement, jusqu'au périmètre `u_out,ef` |

Le résultat porte aussi toutes les grandeurs intermédiaires (`d`, `β`, `u₀`,
`u₁`, `v_Ed`, `v_Rd,c`, `v_Rd,max`), pour que le calcul soit relisible.

### Le périmètre de contrôle est construit, pas tabulé

L'EC2 définit `u₁` comme le contour situé à **2d** de l'aire chargée, tronqué
aux bords libres. Plutôt que de recopier la table des cas usuels — intérieur,
rive, angle, rectangulaire, circulaire —, l'outil implémente cette **définition
géométrique** : un seul décalage écrêté aux bords libres. Les formes fermées
connues en découlent et servent de tests :

- poteau intérieur rectangulaire : `2(c₁ + c₂) + 4πd` ;
- poteau intérieur circulaire : `π(D + 4d)`.

## Expressions employées

```
v_Ed     = β · V_Ed / (u · d)                        §6.4.3
v_Rd,c   = C_Rd,c · k · (100 · ρ_l · f_ck)^(1/3) + k₁ · σ_cp
         ≥ v_min + k₁ · σ_cp                         §6.4.4(1), éq. (6.47)
v_Rd,max = 0,5 · ν · f_cd,  ν = 0,6·(1 − f_ck/250)   §6.4.5(3)
v_Rd,cs  = 0,75 · v_Rd,c + 1,5 · (d/s_r) · A_sw · f_ywd,ef · sin α / (u₁·d)
                                                     éq. (6.52)
u_out,ef = β · V_Ed / (v_Rd,c · d)                   éq. (6.54)
```

avec `C_Rd,c = 0,18/γ_c`, `k = 1 + √(200/d) ≤ 2,0`,
`v_min = 0,035 · k^1,5 · √f_ck`, `σ_cp = (σ_cy + σ_cz)/2`,
`f_ywd,ef = 250 + 0,25·d ≤ f_ywd`, et `d = (d_y + d_z)/2`.

Deux points qui se confondent facilement, et que les tests fixent :

- **`k₁ = 0,1`** au poinçonnement (§6.4.4(1)), et **non `0,15`** comme à
  l'effort tranchant (§6.2.2) : les deux expressions de `v_Rd,c` se ressemblent,
  seul le coefficient de l'effort normal diffère ;
- **`ρ_l = √(ρ_ly · ρ_lz)`** est la moyenne **géométrique** des deux directions,
  et non l'arithmétique.

## Limites assumées

- **Dalles pleines** d'épaisseur constante : ni chapiteaux, ni dalles allégées,
  ni précontrainte.
- **`β`** par les valeurs simplifiées du §6.4.3(6) — 1,15 intérieur, 1,4 rive,
  1,5 angle — ou imposé par l'utilisateur. **Pas de calcul par `W₁`.** Les
  valeurs simplifiées ne sont licites que si la stabilité latérale n'est pas
  assurée par un effet de cadre et si les portées adjacentes ne diffèrent pas de
  plus de 25 %.
- **Pas d'ouverture** à proximité du poteau (§6.4.2(3) non couvert).
- **Dispositions constructives des armatures de poinçonnement non vérifiées**
  (§9.4.3) : ni `A_sw,min`, ni espacements radiaux et tangentiels, ni nombre de
  cours. L'aire rendue satisfait l'éq. (6.52), rien de plus.
- Le poteau est supposé **affleurant** le ou les bords libres. Un poteau en
  retrait offrirait un périmètre plus long : l'hypothèse est conservative.
- **La réduction du périmètre de la Figure 6.15 n'est pas implémentée.** Pour
  certaines géométries de rive ou d'angle, l'EC2 permet de retenir un périmètre
  plus court que celui de l'offset à 2d ; ne pas l'appliquer peut ici
  surestimer `u₁`. À vérifier à la main sur les poteaux de rive très allongés.
- **`u₀` d'un poteau circulaire de rive ou d'angle** : le §6.4.5(3) n'en donne
  pas l'expression. L'outil refuse le cas plutôt que d'inventer une formule ou
  de rendre le contour géométrique, qui serait non conservatif.
- Norme visée : **EN 1992-1-1:2004**. Le poinçonnement a été refondu dans la
  2ᵈᵉ génération de l'Eurocode 2 : ce module ne s'y applique pas.

## Développement

```bash
npx vitest run     # tests
npx tsc --noEmit   # typage
```
