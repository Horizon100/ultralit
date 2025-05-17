import { writable, derived } from 'svelte/store';

function createSidenavStore() {
  const { subscribe, set, update } = writable({
    showSidenav: true
  });

  return {
    subscribe,
    show: () => update(state => ({ ...state, showSidenav: true })),
    hide: () => update(state => ({ ...state, showSidenav: false })),
    toggle: () => update(state => ({ ...state, showSidenav: !state.showSidenav })),
    set: (value: boolean) => update(state => ({ ...state, showSidenav: value }))
  };
}

export const sidenavStore = createSidenavStore();

export const showSidenav = derived(
  sidenavStore,
  $sidenavStore => $sidenavStore.showSidenav
);