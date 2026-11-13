# Plan de mise en production

## Phase 1 - Publication privée

Objectif : rendre l'app accessible sur ordinateur et mobile avec une adresse privée.

1. Créer un dépôt Git privé pour `fieldops-app`.
2. Publier le dossier sur Vercel, Netlify ou un hébergeur statique privé.
3. Activer HTTPS.
4. Ouvrir l'app sur mobile et l'installer comme PWA.
5. Tester le workflow réel avec les données de démo.

## Phase 2 - Données réelles

Objectif : remplacer les données codées en dur par une base de données.

1. Créer un projet Supabase.
2. Exécuter `supabase-schema.sql`.
3. Activer l'authentification courriel.
4. Créer ton utilisateur admin.
5. Ajouter les employés.
6. Brancher les écrans aux tables `jobs`, `time_entries`, `vehicles` et `mileage_trips`.

## Phase 3 - Usage terrain

Objectif : commencer l'utilisation quotidienne avec peu de friction.

Priorité recommandée :

1. Clients et jobs
2. Dossiers de jobs
3. Feuilles de temps
4. Kilométrage
5. Calendrier
6. Documents projet
7. Comptabilité

## Phase 4 - Intégrations

À ajouter après stabilisation du coeur :

- Google Drive pour dossiers, plans, photos et contrats
- QuickBooks pour factures, paiements, dépenses et profit par job
- GPS mobile réel pour le kilométrage
- Export comptable mensuel
- Permissions avancées employés/admin

## Décision technique recommandée

- Hébergement : Vercel
- Base de données : Supabase PostgreSQL
- Authentification : Supabase Auth
- Mobile : PWA installable
- Documents : Google Drive dans une phase suivante
- Comptabilité : QuickBooks dans une phase suivante
