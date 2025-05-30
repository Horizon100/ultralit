// src/lib/utils/globalSwipe.ts
import { SwipeGestureHandler, type SwipeConfig } from './swipeGesture';
import { onMount, onDestroy } from 'svelte';

export function useGlobalSwipe(config: SwipeConfig) {
    let handler: SwipeGestureHandler;
    let cleanupFn: (() => void) | null = null;

    onMount(() => {
        console.log('🌍 Global swipe mounted with config:', config);
        handler = new SwipeGestureHandler(config);
        const eventHandlers = handler.getEventHandlers();

        // Create wrapper handlers that check for excluded elements
        const wrappedHandlers = {
            touchstart: (event: TouchEvent) => {
                // Check if touch started on sidenav or other excluded elements
                const target = event.target as HTMLElement;
                const isOnSidenav = target.closest('.sidenav');
                const isOnDrawer = target.closest('.drawer');
                
                // Only process global swipes if not on excluded elements
                if (!isOnSidenav && !isOnDrawer) {
                    eventHandlers.touchstart(event);
                } else {
                    console.log('🌍 Global swipe ignored - touch on excluded element');
                }
            },
            touchmove: (event: TouchEvent) => {
                // Only process if we started tracking this gesture
                if (handler && handler.state?.isDragging) {
                    eventHandlers.touchmove(event);
                }
            },
            touchend: (event: TouchEvent) => {
                // Only process if we started tracking this gesture
                if (handler && handler.state?.isDragging) {
                    eventHandlers.touchend(event);
                }
            },
            touchcancel: () => {
                // Only process if we started tracking this gesture
                if (handler && handler.state?.isDragging) {
                    eventHandlers.touchcancel();
                }
            }
        };

        // Add global event listeners with proper options
        const options = { passive: false };
        document.addEventListener('touchstart', wrappedHandlers.touchstart, options);
        document.addEventListener('touchmove', wrappedHandlers.touchmove, options);
        document.addEventListener('touchend', wrappedHandlers.touchend, options);
        document.addEventListener('touchcancel', wrappedHandlers.touchcancel, options);

        console.log('🌍 Global event listeners added with exclusions');

        // Cleanup function
        cleanupFn = () => {
            console.log('🌍 Global swipe cleanup');
            document.removeEventListener('touchstart', wrappedHandlers.touchstart);
            document.removeEventListener('touchmove', wrappedHandlers.touchmove);
            document.removeEventListener('touchend', wrappedHandlers.touchend);
            document.removeEventListener('touchcancel', wrappedHandlers.touchcancel);
            handler?.destroy();
        };
    });

    onDestroy(() => {
        cleanupFn?.();
    });

    return {
        updateConfig: (newConfig: Partial<SwipeConfig>) => {
            if (handler) {
                handler.updateConfig(newConfig);
            }
        }
    };
}