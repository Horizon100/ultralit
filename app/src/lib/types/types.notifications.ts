import { Save } from 'lucide-svelte';

export type NotificationType = 'loading' | 'success' | 'error' | 'info';

export interface IdeNotification {
	id: string;
	message: string;
	type: NotificationType;
	timestamp: number;
	autoClose?: boolean;
	action?: {
		label: string;
		icon?: typeof Save;
		onClick: () => void;
	};
}
export interface TaskNotification {
	id: string;
	message: string;
	type: NotificationType;
	timestamp: number;
	autoClose?: boolean;
	link?: {
		url: string;
		text: string;
	};
}
