Développe Kelenix, une application de gestion de projets destinée à un freelance qui crée des applications web, mobiles et SaaS, et qui travaille seul ou avec une petite équipe.

L’objectif est de savoir rapidement :
- Où en est chaque projet.
- Quelles tâches réaliser ensuite.
- Qui est responsable de chaque tâche.
- Quels éléments sont en retard ou bloqués.

L’application doit être fonctionnelle, intuitive et agréable à utiliser au quotidien. Privilégie la simplicité et évite les fonctionnalités superflues.

1. STRUCTURE : EXACTEMENT DEUX PAGES

L’application comporte uniquement :
- Une page de connexion.
- Un dashboard accessible après connexion.

Toutes les fonctionnalités se trouvent dans le dashboard. Utilise des sections internes, des onglets, des fenêtres modales et des panneaux latéraux pour consulter ou modifier les informations.

Ne crée aucune page supplémentaire pour les projets, tâches, clients, membres ou paramètres. Aucun site vitrine, blog ou page de présentation.

2. PAGE DE CONNEXION

Créer une page sobre et soignée comprenant :
- Le nom Kelenix.
- La signature « Gérez vos projets, simplement. »
- Un champ e-mail.
- Un champ mot de passe avec affichage/masquage.
- Un bouton « Se connecter ».
- Les états de chargement et les messages d’erreur utiles.

Après connexion, rediriger vers le dashboard. Prévoir une déconnexion fonctionnelle et protéger l’accès aux données.

3. ORGANISATION DU DASHBOARD

Prévoir une barre latérale compacte avec :
- Vue d’ensemble.
- Projets.
- Mes tâches.
- Clients.

Ces éléments changent le contenu de la zone centrale sans ouvrir de nouvelles pages.

En bas de la barre latérale :
- Équipe et paramètres, accessibles dans une fenêtre modale.
- Profil et déconnexion.

Dans la barre supérieure :
- Le titre de la section active.
- Une recherche sur les projets et les tâches.
- Une action de création adaptée au contexte.

La vue d’ensemble affiche :
- Le nombre de projets actifs.
- Le nombre de tâches en cours.
- Le nombre de tâches en retard.
- Les projets actifs avec leur progression.
- Mes prochaines tâches, classées par échéance.

Garder une hiérarchie visuelle claire et éviter de surcharger l’écran de statistiques.

4. GESTION DES PROJETS

Permettre de créer, modifier et archiver un projet.

Informations :
- Nom obligatoire.
- Description facultative.
- Client facultatif.
- Échéance facultative.
- Statut : Prévu, En cours, En pause ou Terminé.
- Membres autorisés à accéder au projet.

Afficher les projets dans une liste lisible avec recherche et filtres par statut et client.

Au clic sur un projet, afficher son espace de travail dans la zone centrale du dashboard avec :
- Son résumé.
- Ses membres.
- Son avancement.
- Ses tâches.
- Un retour facile à la liste des projets.

Afficher l’avancement sous la forme « 8 tâches terminées sur 12 ». Si un pourcentage est utilisé, il correspond uniquement à la proportion de tâches terminées. Un projet sans tâches affiche « Aucune tâche ».

La clôture d’un projet est une action manuelle. Signaler les tâches encore ouvertes avant de confirmer.

5. GESTION DES TÂCHES

Proposer un tableau Kanban avec trois colonnes :
- À faire.
- En cours.
- Terminé.

Permettre le déplacement des tâches entre les colonnes. Le statut doit aussi pouvoir être changé depuis les détails d’une tâche, notamment sur mobile.

Prévoir également une vue liste simple.

Une tâche contient :
- Un titre obligatoire.
- Une description facultative.
- Un responsable unique ou « À assigner ».
- Une priorité : Basse, Normale ou Haute.
- Une échéance facultative.
- Une checklist simple.
- Des commentaires.
- Des liens utiles.

Les détails s’ouvrent dans un panneau latéral.

Permettre de créer, modifier et supprimer une tâche, avec confirmation avant suppression.

Une tâche peut être marquée « Bloquée » avec une explication, indépendamment de son statut.

Une tâche est en retard lorsque son échéance est dépassée et qu’elle n’est pas terminée.

La section « Mes tâches » rassemble les tâches attribuées à l’utilisateur connecté, tous projets confondus.

6. CLIENTS ET ÉQUIPE

Pour les clients, conserver uniquement :
- Nom.
- Entreprise facultative.
- E-mail facultatif.
- Notes.
- Projets associés.

La création et la modification se font dans une fenêtre modale.

Prévoir deux rôles :
- Propriétaire : gère les clients, projets, membres et paramètres.
- Collaborateur : consulte et modifie les tâches des projets auxquels il a accès.

La gestion des membres et de leurs accès se fait dans le dashboard. Appliquer réellement les permissions aux données, pas seulement à l’affichage.

En solo, assigner les nouvelles tâches à l’utilisateur connecté par défaut. En équipe, permettre de choisir un membre du projet.

7. DESIGN ET EXPÉRIENCE

Créer une identité visuelle cohérente pour Kelenix :
- Fond clair, surfaces blanches, texte anthracite et couleur d’accent bleue.
- Typographie lisible, espacements généreux et icônes cohérentes.
- Boutons et statuts immédiatement compréhensibles.
- Animations discrètes.
- Interface en français.
- Présentation adaptée à l’ordinateur, à la tablette et au mobile.

Sur mobile, rendre la navigation compacte et privilégier une présentation des tâches facile à manipuler.

Prévoir les états vides, les chargements, les erreurs et les confirmations. Les champs doivent avoir des libellés explicites et les interactions essentielles être accessibles au clavier.

8. QUALITÉ ATTENDUE

Construire une application utilisable, pas uniquement une maquette :
- Les actions visibles doivent fonctionner.
- Les données doivent persister après actualisation.
- Les changements doivent mettre à jour les listes, compteurs et progressions.
- Les formulaires doivent valider les informations nécessaires.
- Les données de démonstration éventuelles doivent être fictives et réservées à la démonstration.

Limiter cette première version à la gestion des projets, tâches, clients et collaborateurs. Réserver la facturation, le suivi du temps, le portail client et les automatisations à de futures évolutions.

Commence directement l’implémentation en tenant compte de l’environnement existant. Prends les décisions courantes nécessaires pour avancer.

À la fin, vérifie le parcours complet : connexion, création d’un client, création d’un projet, ajout et assignation de tâches, changement de statut, consultation de l’avancement, archivage et déconnexion.

Présente brièvement le résultat, les instructions pour lancer l’application et les éventuelles limites restantes.