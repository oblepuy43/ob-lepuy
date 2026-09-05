/**
 * Réception des leads dans une Google Sheet.
 *
 * Installation :
 *  1. Créer une Google Sheet, la nommer par ex. "Leads landing page".
 *  2. Extensions > Apps Script, coller ce code, enregistrer.
 *  3. Remplacer la valeur de SECRET ci-dessous par un mot de passe long
 *     (ex. 32 caractères aléatoires). Le même sera à saisir dans Cloudflare
 *     sous le nom SHEET_SECRET.
 *  4. Déployer > Nouveau déploiement > type "Application Web"
 *       - Exécuter en tant que : moi
 *       - Qui a accès : tout le monde
 *     Copier l'URL fournie : c'est la variable SHEET_URL de Cloudflare.
 *
 *  À chaque modification du code, il faut recréer un déploiement
 *  (ou choisir "Gérer les déploiements" > modifier > nouvelle version),
 *  sinon l'ancienne version reste en ligne.
 */

const SECRET = "REMPLACER_PAR_UN_MOT_DE_PASSE_LONG";

const COLONNES = [
  "Reçu le",
  "Prénom",
  "Nom",
  "Email",
  "Téléphone",
  "Offre",
  "Source",
  "Campagne",
  "Pays",
];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);

    if (d.secret !== SECRET) {
      return reponse({ ok: false, error: "Secret invalide" });
    }

    const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // En-têtes créés automatiquement au premier lead.
    if (feuille.getLastRow() === 0) {
      feuille.appendRow(COLONNES);
      feuille.getRange(1, 1, 1, COLONNES.length).setFontWeight("bold");
      feuille.setFrozenRows(1);
    }

    const recuLe = Utilities.formatDate(
      d.recu_le ? new Date(d.recu_le) : new Date(),
      "Europe/Paris",
      "dd/MM/yyyy HH:mm"
    );

    feuille.appendRow([
      recuLe,
      d.prenom || "",
      d.nom || "",
      d.email || "",
      d.tel || "",
      d.offre || "",
      d.source || "",
      d.campagne || "",
      d.pays || "",
    ]);

    return reponse({ ok: true });
  } catch (err) {
    return reponse({ ok: false, error: String(err) });
  }
}

function reponse(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(
    ContentService.MimeType.JSON
  );
}
