# Atelier Ops

Démo autonome d'un tableau de bord de gestion pour une entreprise de construction. Elle a été reconstruite à partir de la description disponible : le code original du site publié n'était pas accessible.

## Ce qui est inclus

- tableau de bord, chantiers, calendrier, clients, équipe et galerie ;
- design responsive, adapté au téléphone ;
- création de chantiers et de tâches ;
- sauvegarde automatique dans le navigateur ;
- export d'une sauvegarde JSON via **Paramètres**.

## Lancer le projet

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Ouvrir ensuite l'adresse affichée dans le navigateur. Pour préparer une version de production :

```bash
npm run build
```

## Publier sur GitHub

1. Créez un nouveau dépôt vide nommé `atelier-ops` sur GitHub.
2. Dans ce dossier, exécutez :

```bash
git init
git add .
git commit -m "Initial Atelier Ops demo"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/atelier-ops.git
git push -u origin main
```

Le projet ne contient aucune clé privée ni dépendance à une base de données. Les données de démonstration sont stockées uniquement dans le navigateur.

## Évolution recommandée

Pour passer de la démo à un produit utilisable par une équipe, ajoutez l'authentification et une base de données (par exemple Supabase), puis le stockage d'images et la génération de devis PDF.
