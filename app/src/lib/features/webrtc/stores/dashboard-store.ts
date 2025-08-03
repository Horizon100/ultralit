// src/lib/features/webrtc/stores/dashboard-store.ts
import { writable } from 'svelte/store';

interface GridItem {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

const defaultLayout: GridItem[] = [
    { id: 'video', x: 0, y: 0, w: 6, h: 4 },
    { id: 'chat', x: 9, y: 0, w: 3, h: 6 },
    { id: 'moderator', x: 6, y: 0, w: 3, h: 4 },
    { id: 'automator', x: 6, y: 4, w: 3, h: 3 },
    { id: 'projects', x: 0, y: 4, w: 6, h: 3 }
];

function checkCollision(currentItemId: string, layout: GridItem[], x: number, y: number, w: number, h: number): boolean {
    return layout.some(item => {
        if (item.id === currentItemId) return false;
        return !(
            x >= item.x + item.w ||
            x + w <= item.x ||
            y >= item.y + item.h ||
            y + h <= item.y
        );
    });
}

function findAvailablePosition(layout: GridItem[], item: GridItem, currentItemId: string): {x: number, y: number} {
    // Try original position first
    if (!checkCollision(currentItemId, layout, item.x, item.y, item.w, item.h)) {
        return {x: item.x, y: item.y};
    }

    // Try nearby positions
    const directions = [
        {dx: 1, dy: 0},  // right
        {dx: -1, dy: 0}, // left
        {dx: 0, dy: 1},  // down
        {dx: 0, dy: -1}, // up
        {dx: 1, dy: 1},  // right-down
        {dx: -1, dy: 1}, // left-down
        {dx: 1, dy: -1}, // right-up
        {dx: -1, dy: -1} // left-up
    ];

    for (const dir of directions) {
        const newX = Math.max(0, Math.min(12 - item.w, item.x + dir.dx));
        const newY = Math.max(0, Math.min(8 - item.h, item.y + dir.dy));
        
        if (!checkCollision(currentItemId, layout, newX, newY, item.w, item.h)) {
            return {x: newX, y: newY};
        }
    }

    // Fallback: find first available position
    for (let y = 0; y <= 8 - item.h; y++) {
        for (let x = 0; x <= 12 - item.w; x++) {
            if (!checkCollision(currentItemId, layout, x, y, item.w, item.h)) {
                return {x, y};
            }
        }
    }

    // If no position found, return original (will overlap)
    return {x: item.x, y: item.y};
}

function createDashboardStore() {
    const { subscribe, set, update } = writable<GridItem[]>(defaultLayout);
    
    return {
        subscribe,
        toggleComponent: (componentId: string) => {
            update(layout => {
                const exists = layout.find(item => item.id === componentId);
                if (exists) {
                    return layout.filter(item => item.id !== componentId);
                } else {
                    const defaultItem = defaultLayout.find(item => item.id === componentId);
                    if (defaultItem) {
                        const position = findAvailablePosition(layout, defaultItem, componentId);
                        return [...layout, {...defaultItem, ...position}];
                    }
                    return layout;
                }
            });
        },
        updateComponentSize: (componentId: string, newSize: { w: number; h: number }) => {
            update(layout => {
                const currentItem = layout.find(item => item.id === componentId);
                if (!currentItem) return layout;

                // Check if new size would cause collision
                if (!checkCollision(componentId, layout, currentItem.x, currentItem.y, newSize.w, newSize.h)) {
                    return layout.map(item => 
                        item.id === componentId 
                            ? { ...item, ...newSize }
                            : item
                    );
                }
                return layout;
            });
        },
        updateComponentPosition: (componentId: string, newPosition: { x: number; y: number }) => {
            update(layout => {
                const currentItem = layout.find(item => item.id === componentId);
                if (!currentItem) return layout;

                // Find non-colliding position
                const position = findAvailablePosition(
                    layout.filter(item => item.id !== componentId),
                    {...currentItem, ...newPosition},
                    componentId
                );

                return layout.map(item => 
                    item.id === componentId 
                        ? { ...item, ...position }
                        : item
                );
            });
        },
        updateComponent: (componentId: string, updates: Partial<GridItem>) => {
            update(layout => {
                const currentItem = layout.find(item => item.id === componentId);
                if (!currentItem) return layout;

                const newItem = {...currentItem, ...updates};
                
                // Check for collisions
                if (!checkCollision(componentId, layout, newItem.x, newItem.y, newItem.w, newItem.h)) {
                    return layout.map(item => 
                        item.id === componentId ? newItem : item
                    );
                }

                // If collision, try to find new position
                const position = findAvailablePosition(
                    layout.filter(item => item.id !== componentId),
                    newItem,
                    componentId
                );

                return layout.map(item => 
                    item.id === componentId 
                        ? {...newItem, ...position}
                        : item
                );
            });
        },
        resetToDefault: () => {
            set([...defaultLayout]);
        },
        getLayout: () => {
            let currentLayout: GridItem[] = [];
            const unsubscribe = subscribe(layout => {
                currentLayout = layout;
            });
            unsubscribe();
            return currentLayout;
        }
    };
}

export const dashboardLayoutStore = createDashboardStore();