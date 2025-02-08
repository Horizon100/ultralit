import { writable } from 'svelte/store';

interface TooltipPosition {
  x: number;
  y: number;
}

interface NavState {
  isOpen: boolean;
  isPinned: boolean;
  tooltip: string;
  tooltipVisible: boolean;
  tooltipPosition: TooltipPosition;
}

export const navState = writable<NavState>({
  isOpen: false,
  isPinned: false,
  tooltip: '',
  tooltipVisible: false,
  tooltipPosition: { x: 0, y: 0 }
});

export function handleMouseEnter() {
    navState.update(state => ({
    ...state,
    isOpen: !state.isPinned ? true : state.isOpen
  }));
}

export function handleMouseLeave() {
    navState.update(state => ({
    ...state,
    isOpen: !state.isPinned ? false : state.isOpen,
    tooltipVisible: false
  }));
}

export function handleNavClick(event: MouseEvent) {
  if ((event.target as HTMLElement).tagName === 'NAV') {
    navState.update(state => {
      const newPinned = !state.isPinned;
      return {
        ...state,
        isPinned: newPinned,
        isOpen: newPinned,
        tooltip: newPinned ? 'Menu on' : 'Menu off',
        tooltipVisible: true,
        tooltipPosition: {
          x: event.clientX,
          y: event.clientY
        }
      };
    });

    setTimeout(() => {
        navState.update(state => ({
        ...state,
        tooltipVisible: false
      }));
    }, 1500);
  }
}