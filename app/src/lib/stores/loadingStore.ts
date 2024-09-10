// src/lib/stores/loadingStore.ts
import { writable } from 'svelte/store';

export const isLoading = writable(false);

export function showLoading() {
  isLoading.set(true);
}

export function hideLoading() {
  isLoading.set(false);
}