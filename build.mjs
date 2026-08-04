# Activer la connexion sécurisée (admin + employés)

Suis ces étapes dans l'ordre. Tout se passe dans ton tableau de bord Supabase
(https://supabase.com/dashboard → ton projet `atelier-ops`).

## 1. Exécuter la migration SQL

1. Ouvre `SQL Editor` dans le menu de gauche.
2. Clique `New query`.
3. Colle le contenu du fichier `supabase-auth-migration.sql`.
4. Clique `Run`.

Ça retire l'accès anonyme temporaire et active les vraies règles de sécurité
(admin = tout, employé = ses propres heures et trajets).

⚠️ Fais cette étape APRÈS avoir créé au moins ton compte admin (étape 2),
sinon personne ne pourra plus se connecter à l'app tant que le compte
n'existe pas.

## 2. Créer ton compte admin

1. Va dans `Authentication` → `Users`.
2. Clique `Add user` → `Create new user`.
3. Entre ton courriel (ex. `shawn@eizoconstruction.com`) et un mot de passe.
4. Coche `Auto Confirm User` pour éviter d'avoir à confirmer par courriel.
5. Clique `Create user`.
6. Copie le `User UID` généré (tu en as besoin à l'étape suivante).

## 3. Créer ta fiche de profil (admin)

1. Va dans `Table Editor` → table `profiles`.
2. Clique `Insert` → `Insert row`.
3. Remplis :
   - `id` : colle le `User UID` copié à l'étape 2
   - `full_name` : ton nom
   - `role` : `admin`
   - `phone` : optionnel
4. Clique `Save`.

## 4. Ajouter tes employés (répéter pour chacun)

1. `Authentication` → `Users` → `Add user` → `Create new user`.
2. Courriel + mot de passe temporaire, coche `Auto Confirm User`.
3. Copie le `User UID`.
4. `Table Editor` → `profiles` → `Insert row` :
   - `id` : le `User UID` de l'employé
   - `full_name` : son nom
   - `role` : `employee`
5. Donne-lui son courriel + mot de passe temporaire pour sa première connexion.
   (Il pourra le changer plus tard dans Supabase si tu actives cette option.)

## 5. Tester

1. Ouvre l'app.
2. Connecte-toi avec ton compte admin → tu dois voir tout le menu.
3. Déconnecte-toi, connecte-toi avec un compte employé → le menu doit être
   réduit (Vue d'ensemble, Calendrier, Saisie employé, Kilométrage,
   Documents).

## Résumé des accès

| | Admin | Employé |
|---|---|---|
| Voir tous les jobs, clients, heures, trajets | ✅ | ✅ (lecture) |
| Créer/modifier jobs, clients, véhicules | ✅ | ❌ |
| Approuver les feuilles de temps | ✅ | ❌ |
| Entrer ses propres heures | ✅ | ✅ |
| Entrer ses propres trajets de kilométrage | ✅ | ✅ |
| Gérer les employés | ✅ | ❌ |
