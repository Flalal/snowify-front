# Search History — Historique des recherches

## Objectif

Sauvegarder les recherches récentes et les afficher dans la SearchView quand l'input est vide (avant de taper). Permet de relancer une recherche en un tap.

---

## Comportement attendu

- Quand l'utilisateur valide une recherche, le terme est sauvegardé dans l'historique
- À l'ouverture de SearchView (input vide), afficher la liste des recherches récentes
- Chaque entrée a un bouton × pour la supprimer individuellement
- Bouton "Clear all" pour vider tout l'historique
- Tap sur une entrée → relance la recherche avec ce terme
- Pas de doublons : si le même terme est recherché, il remonte en haut
- Limite : ~20 entrées max (FIFO)
- Persisté dans localStorage (via `saveState`)

---

## UI

```
┌─────────────────────────────┐
│ 🔍  [                    ]  │
├─────────────────────────────┤
│ Recent searches    Clear all│
│                              │
│ Joé Dwèt Filé           ×  │
│ Theodora                 ×  │
│ Des mythos               ×  │
│ afrobeats playlist       ×  │
└─────────────────────────────┘
```

---

## Architecture proposée

### State

```js
// src/renderer/state/index.js (existant)
export const searchHistory = signal(
  JSON.parse(localStorage.getItem('searchHistory') || '[]')
);
```

### Helpers

```js
export function addSearchTerm(term) {
  const trimmed = term.trim();
  if (!trimmed) return;
  // Supprimer le doublon s'il existe, ajouter en tête
  const filtered = searchHistory.value.filter(t => t !== trimmed);
  searchHistory.value = [trimmed, ...filtered].slice(0, 20);
  saveState();
}

export function removeSearchTerm(term) {
  searchHistory.value = searchHistory.value.filter(t => t !== term);
  saveState();
}

export function clearSearchHistory() {
  searchHistory.value = [];
  saveState();
}
```

---

## Fichiers à modifier

| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/renderer/state/index.js` | Ajouter signal `searchHistory` + helpers (`addSearchTerm`, `removeSearchTerm`, `clearSearchHistory`) |
| 2 | `src/renderer/components/views/SearchView.jsx` | Afficher l'historique quand query vide, appeler `addSearchTerm` à la validation |
| 3 | `src/renderer/styles/search.css` | Styles pour la liste d'historique + boutons × et Clear all |
| 4 | `mobile/src/mobile-overrides.css` | Éventuel ajustement mobile (touch targets sur les ×) |

---

## Points d'attention

- **Persistance** : Ajouter `searchHistory` dans `saveState()` / `loadState()` comme les autres signaux
- **Pas de résultats sauvegardés** : On sauvegarde uniquement le terme de recherche (string), pas les résultats
- **Dédoublonnage** : Rechercher "theo" puis "Theo" → garder la casse la plus récente
- **Cloud Sync** : Optionnel — ajouter `searchHistory` au payload de sync si on veut partager entre desktop et mobile
