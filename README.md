# Archivexa : site vitrine

Site animé d'Archivexa (archives, GED, plateformes numériques) avec :

- `/` : le site complet (services, méthode, plateformes, formations, blog, rendez-vous, espace admin) ;
- `/lancement` : la page d'attente avec inscription « Me prévenir » ;
- `/live` : Archivexa Live, la salle de formation en direct ;
- une API qui enregistre les abonnés, les demandes de rendez-vous et les articles du blog.

Les pages sont en HTML statique (`public/`). L'API tourne en fonctions Vercel (`api/`). Les données sont stockées dans un **Blob store privé** Vercel, un fichier JSON par abonné, demande ou article.

## Déployer sur Vercel

1. **Mettre le code sur GitHub.** Crée un dépôt (par exemple `archivexa-site`) et pousse ce dossier :
   ```bash
   git init
   git add .
   git commit -m "Site Archivexa"
   git branch -M main
   git remote add origin https://github.com/DanitechChabi/archivexa-site.git
   git push -u origin main
   ```
2. **Importer le projet.** Sur vercel.com : *Add New → Project*, choisis le dépôt. Laisse *Framework Preset* sur **Other**. Ne change ni la commande de build ni le dossier de sortie.
3. **Créer le stockage.** Dans le projet : *Storage → Create → Blob*. Choisis l'accès **Private** et relie-le au projet. Vercel ajoute seul la variable `BLOB_READ_WRITE_TOKEN`.
4. **Ajouter les variables d'environnement** (*Settings → Environment Variables*) :

   | Variable | Obligatoire | Rôle |
   |---|---|---|
   | `ADMIN_PASSWORD` | oui | Mot de passe de l'espace admin (`/#admin`). Choisis-en un long. |
   | `ADMIN_SECRET` | oui | Clé qui signe les sessions admin : une longue chaîne aléatoire, par exemple le résultat de `openssl rand -hex 32`. |
   | `LIVEKIT_URL` | pour le live | Adresse `wss://…` de ton projet LiveKit. |
   | `LIVEKIT_API_KEY` | pour le live | Clé API du projet LiveKit. |
   | `LIVEKIT_API_SECRET` | pour le live | Secret API du projet LiveKit. |
   | `RESEND_API_KEY` | non | Pour recevoir un e-mail à chaque abonné ou demande de rendez-vous. |
   | `CONTACT_EMAIL` | non | Adresse qui reçoit ces notifications. |
   | `RESEND_FROM` | non | Expéditeur vérifié chez Resend, ex. `Archivexa <contact@archivexa.com>`. Par défaut : l'adresse de test de Resend. |

5. **Redéployer** (*Deployments → Redeploy*) pour que les variables soient prises en compte.

## Réglages (config.js)

Le fichier `public/config.js` regroupe les informations de contact et de l'entreprise : numéro WhatsApp, e-mail, téléphone, forme juridique, RCCM, IFU, adresse. Remplis-les puis redéploie.

- Le bouton WhatsApp flottant, les liens de contact directs et le lien WhatsApp de la page de lancement apparaissent dès que le numéro est renseigné.
- La page `/legal` affiche « [à compléter] » en orange tant qu'un champ est vide.

## Utiliser l'espace admin

Ouvre `https://<ton-site>/#admin`, ou le lien « Espace admin » en bas de page, puis saisis `ADMIN_PASSWORD`. La session dure 12 heures.

- **Abonnés** : recherche, retrait manuel, et export CSV (séparateur `;`, s'ouvre dans Excel). L'export contient une colonne `lien_desinscription` : un lien signé, propre à chaque abonné. Importe-la dans ton outil d'envoi (Brevo, Resend…) et place-la en bas de chaque lettre. Le lien mène à `/desinscription`, qui retire l'adresse en un clic.
- **Demandes** : les bordereaux de rendez-vous validés.
- **Articles** : créer, modifier, passer en brouillon, supprimer. Tant qu'aucun article n'est enregistré, le blog affiche trois articles de départ. Le premier enregistrement les copie dans le stockage pour qu'ils restent modifiables.

## Archivexa Live (formations en direct)

La vidéo et le son passent par **LiveKit**, un service open source. L'interface, les sessions, l'émargement et les droits restent sur ton site.

1. Crée un compte sur cloud.livekit.io (offre gratuite pour démarrer), puis un projet.
2. Dans *Settings → Keys*, copie l'URL du projet (`wss://…`), la clé et le secret. Ajoute-les dans Vercel sous `LIVEKIT_URL`, `LIVEKIT_API_KEY` et `LIVEKIT_API_SECRET`, puis redéploie.
3. Dans l'espace admin, onglet **Live** : programme une session (titre, formation, date, durée). Un code du type `AXA-7KQ2-LM` est créé.
4. **Copier le lien** donne l'adresse à envoyer aux participants (`/live?s=CODE`).
5. **Animer** ouvre la salle dans le même onglet : tu y entres en formateur. Tu fais avancer le programme pour tout le monde, tu peux couper tous les micros, et tu exportes la feuille d'émargement. Elle est aussi enregistrée et téléchargeable depuis l'onglet Live.

Les participants ont : caméra, micro, partage d'écran, discussion, main levée, réactions, vues scène et mosaïque, programme synchronisé, et trois fonctions propres à Archivexa :

- **Économie de données** : trois niveaux (toutes les vidéos, formateur seulement, audio et présentation). La salle le propose d'elle-même quand la connexion devient faible.
- **Exercice de classement en direct** : depuis l'onglet Programme, le formateur lance un document. Chacun le glisse dans un dossier du plan de classement, les résultats s'affichent en direct, puis le formateur révèle la réponse et l'explication. Les exercices se trouvent dans `public/live.html` (tableau `EXERCISES`).
- **Attestation de présence** : la feuille d'émargement est enregistrée chaque minute pendant la session. Un participant présent au moins 80 % de la durée prévue obtient son attestation en fin de session. Le QR code renvoie à `/live?verif=NUMERO`, qui confirme l'authenticité. Le seuil se règle dans `api/live/certificate.js` (`THRESHOLD`). Tant que LiveKit n'est pas configuré, `/live` s'affiche en mode démonstration. Tu peux aussi forcer ce mode avec `/live?demo=1`.

Sur les consommations et limites de l'offre gratuite LiveKit, vérifie la page des tarifs avant les premières sessions avec beaucoup de participants.

## Mentions légales

La page `/legal` est un modèle rédigé à partir de ce que fait le site. Les durées de conservation (3 ans pour les demandes, 5 ans pour les émargements et attestations) et le délai de réponse d'un mois sont des propositions : ajuste-les, puis fais valider l'ensemble, idéalement au regard des exigences de l'APDP.

## Après la mise en ligne

- **Domaine** : *Settings → Domains* pour brancher `archivexa.com` ou `.bj`.
- **Image de partage** : l'image `og.png` est déclarée en chemin relatif. Une fois le domaine connu, remplace `/og.png` par l'adresse complète dans les balises `og:image` de `public/index.html` et `public/lancement.html` (LinkedIn et WhatsApp préfèrent une URL absolue).
- **Page d'attente en page d'accueil** : pour afficher `/lancement` à la racine le temps de finir le site, ajoute dans `vercel.json` :
  ```json
  "rewrites": [{ "source": "/", "destination": "/lancement" }]
  ```
  Retire cette ligne et redéploie le jour où le site complet doit prendre la place.

## Structure

```
public/            pages et fichiers statiques
  index.html       site complet
  live.html        salle de formation en direct
  lancement.html   page d'attente
  legal.html       mentions légales et confidentialité
  desinscription.html  désinscription de la lettre
  config.js        réglages (contact, entreprise)
  favicon.svg, og.png, logos
api/
  subscribe.js     POST  inscription à la lettre
  unsubscribe.js   POST  désinscription par lien signé
  requests.js      POST  demande de rendez-vous
  posts.js         GET   articles publiés (?all=1 avec session admin : brouillons inclus)
  admin/login.js   POST  connexion admin
  admin/data.js    GET   abonnés + demandes (admin)
  admin/posts.js   PUT / DELETE  articles (admin)
  admin/subscribers.js DELETE retrait d'un abonné (admin)
  live/sessions.js GET   sessions à venir (public)
  live/token.js    POST  jeton d'accès à la salle (formateur si session admin)
  live/admin.js    GET / PUT / DELETE  sessions et émargements (admin)
  live/attendance.js POST feuille d'émargement (admin)
  live/certificate.js POST / GET  émission et vérification des attestations
  _lib/            stockage Blob, sécurité, notifications
```

Les animations chargent GSAP, Lenis, le client LiveKit et le générateur de QR code depuis jsDelivr, et les polices depuis Google Fonts.
