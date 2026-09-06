/**
 * Le seul point de l'application qui touche au navigateur pour faire sortir un
 * fichier. Tout ce qui compose les documents est pur et vit dans `export.ts`.
 */
export function telecharger(nomFichier: string, contenu: string, typeMime: string): void {
  const blob = new Blob([contenu], { type: typeMime });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}
