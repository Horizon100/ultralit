// src/lib/stores/taskNotificationStore.ts
import { writable } from 'svelte/store';
import type { TaskNotification } from '$lib/types/types.notifications';

export const taskNotifications = writable<TaskNotification[]>([]);

function generateId(): string {
  return `notification_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function addNotification(
  message: string,
  type: 'loading' | 'success' | 'error' = 'loading',
  options: {
    autoClose?: boolean;
    link?: {
      url: string;
      text: string;
    };
  } = {}
): string {
  const id = generateId();
  const notification: TaskNotification = {
    id,
    message,
    type,
    timestamp: Date.now(),
    autoClose: options.autoClose !== undefined ? options.autoClose : true,
    link: options.link
  };
  
  taskNotifications.update(notifications => [notification, ...notifications]);
  return id;
}

export function updateNotification(
  id: string,
  updates: Partial<Omit<TaskNotification, 'id' | 'timestamp'>>
): void {
  taskNotifications.update(notifications => 
    notifications.map(notification => 
      notification.id === id
        ? { ...notification, ...updates }
        : notification
    )
  );
}

export function removeNotification(id: string): void {
  taskNotifications.update(notifications => 
    notifications.filter(notification => notification.id !== id)
  );
}

export function clearAllNotifications(): void {
  taskNotifications.set([]);
}