# Navigation History — Bouton Retour

## Objectif

Permettre de revenir en arrière dans l'historique de navigation (comme un navigateur web). Exemple : Home → Album → Artist → Library → **Back** → Artist → **Back** → Album.

---

## Comportement attendu

- **Bouton retour** visible dans le header/toolbar (flèche ←)
- Chaque navigation (`switchView`, `showAlbumDetail`, `openArtistPage`, `showPlaylistDetail`) empile la vue précédente dans un historique
- **Back** dépile et restaure la vue précédente avec son état (ex: quel album, quel artiste)
- Le bouton est grisé/masqué quand l'historique est vide (on est à la racine)
- **Swipe back** sur mobile (optionnel, gesture edge-left)

---

## Architecture proposée

### State

```js
// src/renderer/state/navigation.js (existant)
import { signal } from '@preact/signals';

export const navigationHistory = signal([]);
// Chaque entrée : { view: 'artist', state: { artistId: 'xxx' } }
```

### Modifier `switchView` dans `useAppNavigation.js`

Avant de changer de vue, empiler la vue courante :

```js
const switchView = useCallback((name) => {
  // Empiler la vue courante + son état
  const current = {
    view: currentView.value,
    state: {
      albumViewState: albumViewState.value,
      artistViewState: artistViewState.value,
      playlistViewState: playlistViewState.value,
    }
  };
  navigationHistory.value = [...navigationHistory.value, current];

  currentView.value = name;
  if (lyricsVisible.value) lyricsVisible.value = false;
  if (nowPlayingViewVisible.value) nowPlayingViewVisible.value = false;
}, []);
```

### Fonction `goBack`

```js
const goBack = useCallback(() => {
  const history = navigationHistory.value;
  if (!history.length) return;

  const prev = history[history.length - 1];
  navigationHistory.value = history.slice(0, -1);

  // Restaurer l'état de la vue précédente
  if (prev.state.albumViewState) albumViewState.value = prev.state.albumViewState;
  if (prev.state.artistViewState) artistViewState.value = prev.state.artistViewState;
  if (prev.state.playlistViewState) playlistViewState.value = prev.state.playlistViewState;

  currentView.value = prev.view;
}, []);
```

---

## Fichiers à modifier

| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/renderer/state/navigation.js` | Ajouter signal `navigationHistory` |
| 2 | `src/renderer/hooks/useAppNavigation.js` | Modifier `switchView` pour empiler, ajouter `goBack` |
| 3 | `src/renderer/components/App.jsx` | Ajouter bouton retour dans le header |
| 4 | `mobile/src/mobile-overrides.css` | Style du bouton retour sur mobile |

---

## Points d'attention

- **Limite de profondeur** : Cap l'historique à ~50 entrées pour éviter les fuites mémoire
- **Navigation par bottom nav** : Quand on clique Home/Explore/Library dans la nav, **vider l'historique** (c'est un "reset" de navigation, pas un empilement)
- **Now Playing View** : Ne pas empiler dans l'historique (c'est un overlay, pas une vue)
- **Scroll position** : Optionnel mais idéal — sauvegarder la position de scroll pour la restaurer au retour
