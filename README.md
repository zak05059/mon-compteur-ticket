# Mon Compteur de Ticket

Application mobile (PWA) de suivi des installations FTTH pour KBOWD Group.
Elle s'installe sur le téléphone comme une vraie application, fonctionne sans réseau et partage les données de l'équipe grâce à Firebase.

- Saisie des tickets avec heure de début et heure de fin (secondes comprises), sans chronomètre
- Compteur de performance par ticket : Excellent, Dans l'objectif, Hors objectif
- Objectifs de durée par type de ticket et par zone
- Compteurs : MDU, KO poteaux, Mauvaise adresse non traitée, Problème client, ID affecté
- 44 zones, ajout de zones, sous-zones nommées (ex. MMA 06/2)
- Objectif de 3 installations par jour travaillé, mois de travail du 17 au 16
- Tableau de bord, rapport global PDF, export CSV (Excel)
- Comptes avec rôles : technicien, chef d'équipe, administrateur

Tant que Firebase n'est pas configuré, l'application marche quand même : les tickets restent alors sur le téléphone.

---

## 1. Créer le projet Firebase (10 minutes, gratuit)

1. Allez sur https://console.firebase.google.com et cliquez sur **Créer un projet**. Nom conseillé : `mon-compteur-ticket`. Google Analytics n'est pas nécessaire.
2. **Authentification** : menu *Build > Authentication > Get started*, onglet *Sign-in method*, activez **E-mail/Mot de passe**.
3. **Base de données** : menu *Build > Firestore Database > Créer une base de données*. Choisissez l'emplacement `eur3 (europe-west)` puis le **mode production**.
4. **Règles de sécurité** : dans Firestore, onglet *Règles*, remplacez tout le texte par le contenu du fichier `firestore.rules` de ce dossier, puis cliquez sur **Publier**.
5. **Clés de l'application** : *Paramètres du projet* (roue dentée) > *Vos applications* > icône **Web `</>`**. Nom : `Compteur Ticket`. Ne cochez pas Firebase Hosting. Firebase affiche un bloc `firebaseConfig`.
6. Ouvrez le fichier `firebase-config.js` et remplacez chaque valeur `VOTRE_...` par celles affichées par Firebase.

Ces clés ne sont pas secrètes : elles peuvent être publiées sur GitHub. La sécurité vient des règles Firestore.

## 2. Mettre l'application en ligne avec GitHub Pages

1. Sur https://github.com, créez un dépôt **public** nommé par exemple `mon-compteur-ticket` (GitHub Pages gratuit exige un dépôt public).
2. Cliquez sur **Add file > Upload files** et déposez **tout le contenu** de ce dossier (les dossiers `css`, `js`, `icons` et les fichiers à la racine, y compris `.nojekyll`). Validez avec **Commit changes**.
3. Dans le dépôt : **Settings > Pages**. Source : *Deploy from a branch*, branche `main`, dossier `/ (root)`. Enregistrez.
4. Après une à deux minutes, l'adresse s'affiche, par exemple `https://votre-nom.github.io/mon-compteur-ticket/`.
5. Retournez dans Firebase : *Authentication > Settings > Domaines autorisés > Ajouter un domaine* et ajoutez `votre-nom.github.io`.

## 3. Créer le premier administrateur

1. Ouvrez l'adresse GitHub Pages, cliquez sur **Créer un compte** et inscrivez-vous. L'écran « Compte en attente » s'affiche : c'est normal.
2. Dans Firebase : *Firestore Database > Données > collection `users`*, ouvrez le document qui porte votre nom.
3. Modifiez le champ `role` : remplacez `attente` par `admin`. L'application s'ouvre toute seule.

Ensuite, chaque membre de l'équipe crée son compte, et vous le validez dans l'application : **Menu (votre avatar) > Équipe > Comptes et rôles**.

| Rôle | Ce qu'il peut faire |
|---|---|
| Technicien | Saisir et modifier ses propres tickets, ajouter des sous-zones, générer des rapports |
| Chef d'équipe | Modifier tous les tickets, gérer les zones et les sous-zones |
| Administrateur | Tout, plus les réglages (objectifs, calendrier, types) et les comptes |

## 4. Installer sur le téléphone

- **Android (Chrome)** : ouvrez l'adresse, puis touchez **Installer** dans l'application (ou menu ⋮ > *Installer l'application*).
- **iPhone (Safari)** : ouvrez l'adresse, touchez **Partager** puis **Sur l'écran d'accueil**.

L'icône Mon Compteur de Ticket apparaît sur l'écran d'accueil. L'application s'ouvre en plein écran.

## 5. Hors connexion

Sans réseau, la saisie continue : les tickets sont gardés sur le téléphone et envoyés automatiquement au retour de la connexion. L'indicateur en haut à droite affiche *Hors ligne · en attente d'envoi*, puis *Synchronisé*.

La première génération d'un PDF demande une connexion (chargement de la bibliothèque PDF).

## 6. Mettre à jour l'application

Après une modification des fichiers sur GitHub, changez le numéro `VERSION` au début de `sw.js` (`mct-v1.0.0` devient `mct-v1.0.1`). Les téléphones récupèrent la nouvelle version à la prochaine ouverture.

## Règles de calcul

- Mois de travail : du 17 au 16 du mois suivant (réglable).
- Objectif : 3 installations réussies par jour travaillé. Dimanche jamais travaillé ; un samedi sur deux à partir du 07/11/2026 (réglable). Fériés et congés à déclarer dans les réglages.
- Un ticket OK n'est compté qu'une fois. Un même numéro peut être ressaisi seulement si les tickets existants sont KO et le nouveau OK.
- Un KO demande au moins une difficulté ; « Autre imprévu » demande une observation.
- Objectif de durée appliqué : type + zone, sinon type, sinon zone, sinon objectif général (2h00 excellent, 3h00 objectif par défaut).
- Une installation sans heures compte dans la production mais pas dans les durées.

## Contenu du dossier

```
index.html              page de l'application
manifest.webmanifest    installation sur le téléphone
sw.js                   fonctionnement hors ligne
firebase-config.js      clés Firebase (à remplir)
firestore.rules         règles de sécurité à coller dans Firebase
firebase.json           pour un déploiement Firebase Hosting (optionnel)
css/style.css           design
js/app.js               écrans et actions
js/data.js              calculs (objectifs, durées, zones)
js/store.js             connexion Firebase ou stockage local
js/pdf.js               rapport PDF
icons/                  icônes et logo
```

Option : au lieu de GitHub Pages, vous pouvez héberger sur Firebase Hosting avec `firebase deploy` (Firebase CLI). Le fichier `firebase.json` est prêt.
