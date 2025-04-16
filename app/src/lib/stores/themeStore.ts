// src/lib/stores/themeStore.ts
import { writable, get, derived } from 'svelte/store';
import { currentUser } from '$lib/pocketbase';
import { browser } from '$app/environment';

export const availableThemes = ['light', 'dark', 'default', 'sunset', 'bone', 'focus', 'turbo', 'bold'] as const;
export type Theme = typeof availableThemes[number];

const DEFAULT_THEME: Theme = 'default';

interface ThemeStoreState {
  theme: Theme;
  isInitializing: boolean;
  isInitialized: boolean;
}

function createThemeStore() {
  const store = writable<ThemeStoreState>({
    theme: DEFAULT_THEME,
    isInitializing: false,
    isInitialized: false
  });

  const themeOnly = derived(store, ($state) => $state.theme);

const applyTheme = (theme: Theme) => {
  if (!browser) return;
  
  document.documentElement.classList.remove(...availableThemes);
  
  document.documentElement.classList.add(theme);
  
  store.update(state => ({ ...state, theme }));
  
  localStorage.setItem('theme', theme);
};

  const initialize = async () => {
    if (!browser) return;

    const state = get(store);
    if (state.isInitializing || state.isInitialized) return;
    
    store.update(state => ({ ...state, isInitializing: true }));

    // 1. Check localStorage first for fast initial render
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme && availableThemes.includes(savedTheme)) {
      applyTheme(savedTheme);
      store.update(state => ({ 
        ...state, 
        isInitializing: false, 
        isInitialized: true 
      }));
      return;
    }

    // 2. Check user preference if logged in
    const user = get(currentUser);
    if (user?.id) {
      try {
        // Use a controller to be able to abort this request if needed
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
        
        const response = await fetch(`/api/users/${user.id}/theme`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          const theme = data.theme;
          
          if (theme && availableThemes.includes(theme)) {
            applyTheme(theme);
            store.update(state => ({ 
              ...state, 
              isInitializing: false, 
              isInitialized: true 
            }));
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load user theme:', err);
        // Continue to fallback
      }
    }

    // 3. Fallback to default theme
    applyTheme(DEFAULT_THEME);
    store.update(state => ({ 
      ...state, 
      isInitializing: false, 
      isInitialized: true 
    }));
  };

  // Set new theme
  const setTheme = async (theme: Theme) => {
    if (!browser || !availableThemes.includes(theme)) return;

    // Apply theme immediately for responsive UI
    applyTheme(theme);

    // Update server if user is logged in - in the background
    const user = get(currentUser);
    if (user?.id) {
      try {
        // Use a controller to be able to abort this request if needed
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
        
        await fetch(`/api/users/${user.id}/theme`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
      } catch (err) {
        // Error is not critical as the theme is already applied locally
        console.error('Failed to save theme to server:', err);
      }
    }
  };

  return {
    subscribe: themeOnly.subscribe, // Expose only the theme part of the state
    set: setTheme,
    initialize,
    applyTheme,
    // Expose the full internal store for more complex operations
    _store: {
      subscribe: store.subscribe
    }
  };
}

export const currentTheme = createThemeStore();

// For more detailed state information (loading, etc.)
export const themeState = currentTheme._store;

// Create an effective theme store that simply mirrors the current theme
// No special handling for system preferences now
export const effectiveTheme = currentTheme;

// Handle auth changes - initialize only when necessary
if (browser) {
  let previousUserId: string | null = null;
  
  currentUser.subscribe((user) => {
    // Only reinitialize if the user ID changed
    if (user?.id !== previousUserId) {
      previousUserId = user?.id || null;
      currentTheme.initialize();
    }
  });
  
  // Initial load
  currentTheme.initialize();
}