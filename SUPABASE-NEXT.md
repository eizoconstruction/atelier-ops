# Prochaine étape Supabase

Le schéma principal a été exécuté.

Pour que la version statique privée puisse lire et écrire pendant le MVP, exécute aussi :

`supabase-mvp-access.sql`

Dans Supabase :

1. Ouvre ton projet.
2. Va dans `SQL Editor`.
3. Clique `New query`.
4. Colle le contenu de `supabase-mvp-access.sql`.
5. Clique `Run`.

## Pourquoi ce fichier existe

Le premier schéma active la sécurité RLS. C'est bien pour la production, mais l'app actuelle n'a pas encore la vraie connexion Supabase admin/employés. Le fichier MVP ajoute des permissions temporaires pour le site privé.

## Important

Cette approche est temporaire. Quand l'authentification Supabase sera branchée, on remplacera ces politiques par des accès stricts :

- admin : gestion complète
- employé : ses heures, ses trajets, ses jobs assignés
