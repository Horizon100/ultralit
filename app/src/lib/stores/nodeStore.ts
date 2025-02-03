import { writable } from 'svelte/store';
import type { Node } from '../types/types';

function createNodeStore() {
	const { subscribe, set, update } = writable<Node[]>([]);

	return {
		subscribe,
		addNode: (node: Node) => update((nodes) => [...nodes, node]),
		updateNode: (id: string, changes: Partial<Node>) =>
			update((nodes) => nodes.map((n) => (n.id === id ? { ...n, ...changes } : n))),
		removeNode: (id: string) => update((nodes) => nodes.filter((n) => n.id !== id)),
		reset: () => set([])
	};
}

export const nodeStore = createNodeStore();
