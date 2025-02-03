// src/lib/stores/fileStore.ts
import { writable } from 'svelte/store';

export const uploadedFiles = writable<Array<{ file: File; x: number; y: number }>>([]);
