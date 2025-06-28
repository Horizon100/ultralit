// src/lib/utils/toastUtils.ts
import { writable } from 'svelte/store';

export type ToastMessage = {
	id: string;
	message: string;
	type: 'success' | 'error' | 'warning' | 'info';
	duration?: number;
};

export const toasts = writable<ToastMessage[]>([]);

export function showToast(
	message: string,
	type: 'success' | 'error' | 'warning' | 'info' = 'info',
	duration: number = 3000
): void {
	const id = Math.random().toString(36).substring(2, 9);

	toasts.update((all) => [{ id, message, type, duration }, ...all]);

	if (duration > 0) {
		setTimeout(() => dismissToast(id), duration);
	}
}

export function dismissToast(id: string): void {
	toasts.update((all) => all.filter((t) => t.id !== id));
}

// Shortcut functions
export const toast = {
	success: (message: string, duration?: number) => showToast(message, 'success', duration),
	error: (message: string, duration?: number) => showToast(message, 'error', duration),
	warning: (message: string, duration?: number) => showToast(message, 'warning', duration),
	info: (message: string, duration?: number) => showToast(message, 'info', duration)
};
