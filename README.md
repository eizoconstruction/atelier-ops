# Atelier Ops — v2

App privée d'Eizo Construction pour gérer les jobs, les clients, les devis, les heures, le kilométrage, les documents et la rentabilité.
Elle fonctionne sur ordinateur et sur téléphone, et s'installe comme une app (PWA).

## Ce que fait la v2

| Écran | Admin | Employé |
|---|---|---|
| **Vue d'ensemble** | Contrats ouverts, à facturer, comptes à recevoir, heures, alertes (budget dépassé, factures en retard, heures à approuver) | Ses heures, ses jobs, ses km |
| **Jobs** | Créer, modifier, supprimer. Dossier complet : aperçu, coûts et marge réelle, heures, km, fichiers, journal de chantier, facturation et paiements | Ses jobs assignés (sans les prix), journal, photos |
| **Clients** | Fiches clients et historique des jobs | — |
| **Estimation et devis** | Calculateur (matériaux, main-d'oeuvre, imprévus, marge, TPS/TVQ), lignes de devis, devis PDF imprimable, conversion en job | — |
| **Calendrier** | Vue mensuelle des jobs et rendez-vous, agenda sur téléphone | Lecture |
| **Feuilles de temps** | Approbation (individuelle ou en lot), refus, heures sup. au-delà de 40 h/sem., export pour la paie | — |
| **Mes heures** | Pointage « Commencer / Terminer ma journée » ou saisie manuelle | Idem ; modification possible tant que ce n'est pas approuvé |
| **Kilométrage** | Trajet GPS réel, odomètre ou saisie manuelle, registre mensuel exportable | Ses trajets |
| **Documents** | Photos, plans, contrats, reçus téléversés par job, plus des liens Drive | Ajout de photos |
| **Comptabilité** | Rentabilité par job, comptes à recevoir, dépenses (export QuickBooks), estimation TPS/TVQ | — |
| **Employés et véhicules** | Rôles, coût horaire, désactivation, flotte | — |
| **Paramètres** | Coordonnées sur les devis, taux de taxes, allocation km, sauvegarde JSON | — |

**Mode démo :** sur l'écran de connexion, « Essayer en mode démo » ouvre l'app avec des données fictives gardées dans le navigateur. Rien n'est envoyé à Supabase. Un menu permet de voir l'app comme un employé.

## Mise en ligne (une seule fois)

### 1. Réactiver Supabase
Le projet `qjnuksrjdymakizznkiy` ne répondait plus le 13 novembre 2026. Il a probablement été mis en pause pour inactivité.
1. Va sur https://supabase.com/dashboard et ouvre le projet.
2. S'il est en pause, clique **Restore project** et attends quelques minutes.

### 2. Mettre à jour la base de données (aucune donnée effacée)
1. Dans Supabase : **SQL Editor** > **New query**.
2. Colle tout le contenu de `supabase/migrations/002_v2.sql`, puis clique **Run**.
3. Le script peut être relancé sans danger. Il ajoute des colonnes et des tables, et remplace les anciennes règles d'accès ouvertes (`mvp_anon_*`) par des règles avec connexion obligatoire.

> Si le projet a été supprimé plutôt que mis en pause : crée un nouveau projet, exécute `001_schema_initial.sql`, puis `002_v2.sql`, et mets la nouvelle adresse et la nouvelle clé dans Vercel (étape 3).

### 3. Publier sur Vercel
1. Sur https://vercel.com : **Add New** > **Project** > importe le dépôt GitHub `eizoconstruction/atelier-ops`.
2. Vercel détecte Vite tout seul : build `npm run build`, dossier `dist`.
3. (Facultatif) Dans **Environment Variables**, ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (voir `.env.example`). Sans ces variables, l'app utilise le projet Supabase actuel.
4. Dans Supabase, sous **Authentication** > **URL Configuration**, mets l'adresse Vercel dans *Site URL*. C'est ce qui fait fonctionner le lien « Mot de passe oublié ».

### 4. Ton compte admin
Le premier compte créé devient admin automatiquement. Si ton compte existait déjà avec le rôle admin, il le reste.

### 5. Ajouter un employé
1. Supabase > **Authentication** > **Users** > **Add user** > **Create new user**. Entre le courriel et un mot de passe temporaire, puis coche *Auto Confirm User*.
2. Recharge Atelier Ops : l'employé apparaît dans **Employés et véhicules**.
3. Clique sur sa fiche et remplis son nom, son poste et son **coût horaire**. Le coût horaire sert aux marges et n'est jamais visible par les employés.

## Développement

```bash
npm install
npm run dev        # http://localhost:5173  (ajoute ?demo=1 pour le mode démo)
npm run build
```

Structure :

```
index.html               page unique
src/main.js              connexion, menu, navigation
src/api.js               Supabase + moteur démo (même interface)
src/store.js             état, calculs (coût réel, marge, etc.)
src/forms.js             formulaires partagés
src/files.js             téléversement et affichage des fichiers
src/views/*.js           un fichier par écran
supabase/migrations/     schéma SQL
legacy/                  anciennes versions (démo, version Supabase jamais publiée)
```

## Limites connues
- **GPS :** une app web ne peut pas suivre la position quand le téléphone est verrouillé. L'app garde l'écran allumé pendant un trajet. Si l'app est fermée en route, le suivi reprend à la réouverture et la portion manquée compte en ligne droite. On peut corriger le km avant d'enregistrer.
- **Données financières et employés :** l'interface cache aux employés les prix des jobs et les coûts horaires. Par contre, les tables `jobs` et `profiles` restent lisibles par tout compte connecté, donc un employé qui s'y connaît pourrait les lire directement dans la base. Si c'est important, la prochaine étape est de créer des vues « employé » sans les colonnes financières.
- **QuickBooks et Google Drive :** pas encore de connexion directe. On colle les liens Drive, on note le numéro de facture QuickBooks, et on exporte les dépenses en CSV.
