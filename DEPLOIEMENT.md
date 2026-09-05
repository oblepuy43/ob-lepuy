# Mise en ligne — landing page L'Orange bleue Le Puy-en-Velay

Ordre à respecter : chaque étape dépend de la précédente.
Compter environ 2 heures au total, réparties sur deux jours à cause des délais de propagation DNS.

---

## 1. Le domaine

1. Acheter `ob-lepuy.fr` chez OVH ou Gandi (~10-15 €/an). Activer le renouvellement automatique.
2. Créer un compte sur **cloudflare.com** (gratuit), *Add a site*, saisir `ob-lepuy.fr`, choisir le plan **Free**.
3. Cloudflare affiche deux serveurs de noms. Les saisir chez OVH à la place de ceux d'origine
   (OVH : *Domaines > ob-lepuy.fr > Serveurs DNS > Modifier*).
4. Attendre la validation. Comptez de quelques minutes à quelques heures.

> Tant que Cloudflare n'affiche pas le domaine comme actif, les étapes 3 et 5 échoueront.

---

## 2. L'hébergement

Le plus simple pour pouvoir modifier la page à chaque campagne sans tout réenvoyer.

1. Créer un compte **github.com** (gratuit), puis un dépôt **privé** nommé `ob-lepuy`.
2. Y déposer le contenu de ce dossier en conservant la structure :

   ```
   index.html
   functions/api/lead.js
   ```

   Le dossier `functions` doit être à la racine, sinon le formulaire ne fonctionnera pas.
   Les fichiers `DEPLOIEMENT.md` et `google-apps-script.gs` peuvent être déposés aussi,
   ils ne sont pas publiés.
3. Dans Cloudflare : *Workers & Pages > Create > Pages > Connect to Git*, choisir le dépôt.
4. Réglages de compilation : **framework preset = None**, commande de build vide,
   répertoire de sortie = `/`. Déployer.
5. *Custom domains* > ajouter `ob-lepuy.fr` et `www.ob-lepuy.fr`.

---

## 3. La Google Sheet

1. Créer une Google Sheet nommée « Leads landing page » sur le compte
   lorangebleue.lepuyenvelay@gmail.com.
2. *Extensions > Apps Script*, coller le contenu de `google-apps-script.gs`.
3. Remplacer `REMPLACER_PAR_UN_MOT_DE_PASSE_LONG` par une chaîne aléatoire longue.
   **Conserver cette valeur**, elle servira à l'étape 5.
4. *Déployer > Nouveau déploiement > Application Web*
   - Exécuter en tant que : **moi**
   - Qui a accès : **tout le monde**
5. Autoriser l'accès quand Google le demande (l'avertissement « application non vérifiée »
   est normal : c'est ton propre script — *Paramètres avancés > Accéder au projet*).
6. Copier l'URL du déploiement.

---

## 4. L'envoi des emails

1. Créer un compte sur **resend.com** (offre gratuite).
2. *Domains > Add domain* : `ob-lepuy.fr`.
3. Resend affiche des enregistrements DNS (SPF, DKIM, DMARC). Les recopier dans Cloudflare
   (*DNS > Records*). Vérification en quelques minutes.
4. *API Keys > Create* : droit **Sending access** uniquement. Copier la clé,
   elle ne sera plus affichée ensuite.

> Cette étape est ce qui évite que les notifications de leads arrivent en spam.
> Un envoi depuis un domaine non authentifié est filtré par Gmail dans la majorité des cas.

---

## 5. Les variables d'environnement

Cloudflare > le projet Pages > *Settings > Environment variables > Production* :

| Nom | Type | Valeur |
|---|---|---|
| `RESEND_API_KEY` | Secret | la clé de l'étape 4 |
| `MAIL_FROM` | Texte | `L'Orange bleue Le Puy <contact@ob-lepuy.fr>` |
| `MAIL_TO` | Texte | `lorangebleue.lepuyenvelay@gmail.com` |
| `SHEET_URL` | Texte | l'URL de l'étape 3 |
| `SHEET_SECRET` | Secret | le mot de passe de l'étape 3 |

Redéployer après l'enregistrement (*Deployments > … > Retry deployment*) :
les variables ne sont prises en compte qu'au déploiement suivant.

---

## 6. Test complet

1. Ouvrir `https://ob-lepuy.fr`, remplir le formulaire avec une adresse personnelle.
2. Vérifier trois choses : le message de confirmation, la ligne dans la Google Sheet,
   l'email dans la boîte Gmail (regarder aussi les spams la première fois).
3. Si l'email n'arrive pas mais que la ligne apparaît dans la Sheet, le problème vient
   de Resend (étape 4) et aucun lead n'est perdu entre-temps.

---

## 7. Meta

À faire seulement une fois les étapes 1 à 6 validées.

1. **Vérification du domaine** : Business Manager > *Paramètres de l'entreprise >
   Sécurité de la marque > Domaines* > ajouter `ob-lepuy.fr`, méthode **enregistrement TXT DNS**,
   à créer dans Cloudflare (*DNS > Records*).
2. **Nouveau pixel** : Gestionnaire d'événements > *Connecter des données > Web*.
   Ne pas réutiliser le pixel STBK.
3. Coller le code du pixel dans `index.html`, juste avant `</head>`.
   Le code de la page appelle déjà `fbq('track','Lead')` à la validation du formulaire :
   rien d'autre à ajouter.
4. **Conversion personnalisée** : basée sur l'événement `Lead`, avec une règle sur l'URL
   contenant `ob-lepuy.fr`.
5. Laisser tourner en parallèle du système STBK pendant une à deux semaines et comparer
   les volumes avant de basculer les campagnes.

---

## Modifier la page à chaque campagne

Trois endroits à changer dans `index.html`, rien d'autre :

- le montant et le texte du bloc offre ;
- la date limite : `data-deadline="2026-09-06T23:59:59"` (le décompte se recalcule seul) ;
- le champ `offre:` dans le script, en bas de page, qui étiquette les leads dans la Sheet.

Après modification, envoyer le fichier sur GitHub : Cloudflare redéploie automatiquement
en une trentaine de secondes.
