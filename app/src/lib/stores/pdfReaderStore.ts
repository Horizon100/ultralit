// src/lib/stores/pdfReaderStore.ts
import { writable } from 'svelte/store';

export const isPDFReaderOpen = writable(false);

export const pdfReaderStore = {
	open: () => isPDFReaderOpen.set(true),
	close: () => isPDFReaderOpen.set(false),
	toggle: () => isPDFReaderOpen.update(value => !value)
};