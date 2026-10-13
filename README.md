# Archivexa : site vitrine

Site animé d'Archivexa (archives, GED, plateformes numériques) avec :

- `/` : le site complet (services, méthode, plateformes, formations, blog, rendez-vous, espace admin) ;
- `/lancement` : la page d'attente avec inscription « Me prévenir » ;
- `/live` : Archivexa Live, la salle de formation en direct ;
- `/emplois` : la page Emplois, où les archivistes déposent leur fiche et leur CV ;
- une API qui enregistre les abonnés, les demandes de rendez-vous et les articles du blog.

Les pages sont en HTML statique (`public/`). L'API tourne en fonctions Vercel (`api/`). Les données sont stockées dans un **Blob store privé** Vercel, un fichier JSON par abonné, demande ou article.

## Déployer sur Vercel

1. **Mettre le code sur GitHub.** Crée un dépôt (par exemple `archivexa-site`) et pousse ce dossier :
   ```bash
   git init
   git add .
   git commit -m "Site Archivexa"
   git branch -M main
   git remote add origin https://github.com/DanitechChabi/archivexa-sites.git
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
   | `RESEND_API_KEY` | pour les offres | Envoi des e-mails : notifications pour toi, confirmations et offres pour les talents. |
   | `CONTACT_EMAIL` | non | Adresse qui reçoit ces notifications. |
   | `RESEND_FROM` | pour les offres | Expéditeur sur un domaine vérifié chez Resend, ex. `Archivexa <offres@archivexa.bj>`. Sans domaine vérifié, Resend n'envoie qu'à ta propre adresse : les offres ne peuvent pas partir vers les talents. |

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

## Emplois (fiches talents et offres)

La page `/emplois` présente les offres ouvertes et un formulaire de fiche : identité, spécialités, expérience, contrats et zones souhaités, parcours et CV (PDF ou Word, 3 Mo maximum). La fiche n'est jamais publiée. Chaque talent reçoit par e-mail un lien personnel « Modifier ma fiche » : une fiche existante ne peut être remplacée que par ce lien, pour que personne ne puisse écraser la fiche d'un autre. Sans envoi d'e-mails configuré, c'est toi qui supprimes l'ancienne fiche dans l'admin si quelqu'un veut repartir de zéro.

Dans l'espace admin :

- **Talents** : recherche, filtre par spécialité, téléchargement du CV, suppression, export CSV. Les fiches non mises à jour depuis 2 ans sont supprimées automatiquement à l'ouverture de cet onglet.
- **Offres** : publier une offre (poste, organisation, lieu, contrat, expérience minimale, spécialités, description, lien ou e-mail pour postuler, date limite). Elle apparaît aussitôt sur `/emplois` et disparaît après la date limite ou quand tu la fermes.
- **Profils** montre les talents qui correspondent : au moins une spécialité commune, contrat souhaité (ou aucun préféré), zone souhaitée (ou « Toutes les zones ») et expérience suffisante. Tu peux copier les adresses ou les exporter.
- **Envoyer** expédie l'offre par e-mail aux profils correspondants qui ne l'ont pas encore reçue. Chaque e-mail contient un lien qui supprime la fiche du talent.

Pour que l'envoi fonctionne, il faut un domaine à toi (par exemple `archivexa.bj`) vérifié chez Resend :

1. Crée un compte sur resend.com, puis *Domains → Add domain* et ajoute les enregistrements DNS indiqués chez ton registraire.
2. Crée une clé API (*API Keys*).
3. Dans Vercel, ajoute `RESEND_API_KEY` et `RESEND_FROM` (par exemple `Archivexa <offres@archivexa.bj>`), puis redéploie.

Tant que ce n'est pas fait, l'onglet Offres l'indique et tu peux contacter les profils toi-même avec la liste d'adresses.

## Mentions légales

La page `/legal` est un modèle rédigé à partir de ce que fait le site. Les durées de conservation (3 ans pour les demandes, 2 ans pour les fiches talents, 5 ans pour les émargements et attestations) et le délai de réponse d'un mois sont des propositions : ajuste-les, puis fais valider l'ensemble, idéalement au regard des exigences de l'APDP.

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
  emplois.html     offres et fiches talents
  legal.html       mentions légales et confidentialité
  desinscription.html  désinscription de la lettre
  config.js        réglages (contact, entreprise)
  favicon.svg, og.png, logos
api/
  index.js         point d'entrée unique de l'API (le plan Hobby limite à 12 fonctions) ;
                   vercel.json redirige /api/<route> vers lui
  _r/subscribe.js     POST  inscription à la lettre
  _r/unsubscribe.js   POST  désinscription par lien signé
  _r/requests.js      POST  demande de rendez-vous
  _r/posts.js         GET   articles publiés (?all=1 avec session admin : brouillons inclus)
  _r/admin/           connexion, abonnés + demandes, articles, retrait d'un abonné
  _r/live/            sessions, jetons d'accès, émargement, attestations
  _r/jobs.js, _r/talents.js, _r/admin/jobs.js, _r/admin/talents.js   emplois : offres, fiches, CV, envois
  _r/_lib/            stockage Blob, sécurité, notifications
```

Les animations chargent GSAP, Lenis, le client LiveKit et le générateur de QR code depuis jsDelivr, et les polices depuis Google Fonts.
