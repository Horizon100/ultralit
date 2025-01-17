import { writable } from 'svelte/store';
import type { CursorPosition } from '$lib/types/types';
import { subscribeToCursorChanges, publishCursorPosition, unsubscribeFromChanges } from '../pocketbase';
import debounce from 'lodash/debounce';

export const cursorPositions = writable<CursorPosition[]>([]);

let unsubscribe: (() => void) | null = null;

export async function initializeCursorStore(): Promise<() => void> {
    try {
        unsubscribe = await subscribeToCursorChanges((data) => {
            if (data.action === 'create' || data.action === 'update') {
                cursorPositions.update(positions => {
                    const index = positions.findIndex(p => p.user === data.record.user);
                    if (index !== -1) {
                        positions[index] = data.record;
                    } else {
                        positions.push(data.record);
                    }
                    return positions;
                });
            }
        });
        return () => {
            if (unsubscribe) {
                unsubscribeFromChanges(unsubscribe);
                unsubscribe = null;
            }
        };
    } catch (error) {
        console.error('Failed to initialize cursor store:', error);
        if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        } else {
            console.error('Unexpected error:', error);
        }
        throw new Error('Cursor store initialization failed');
    }
}
export const updateCursorPosition = debounce((userId: string, x: number, y: number, name: string) => {
    publishCursorPosition(userId, x, y, name);
    
    cursorPositions.update(positions => {
        const index = positions.findIndex(p => p.user === userId);
        if (index !== -1) {
            positions[index].position = { x, y };
            positions[index].name = name;
        } else {
            positions.push({ user: userId, position: { x, y }, name } as CursorPosition);
        }
        return positions;
    });
}, 100); // Debounce for 100ms

export function cleanupCursorStore(): void {
    if (unsubscribe) {
        unsubscribeFromChanges(unsubscribe);
        unsubscribe = null;
    }
}