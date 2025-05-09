// src/lib/stores/ideNotificationStore.ts
import { writable } from 'svelte/store';

// Define notification type
export type NotificationType = 'loading' | 'success' | 'error';

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

export const ideNotifications = writable<TaskNotification[]>([]);

function generateId(): string {
  return `notification_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function addNotification(
  message: string,
  type: NotificationType = 'loading',
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
  
  ideNotifications.update(notifications => [notification, ...notifications]);
  return id;
}

export function updateNotification(
  id: string,
  updates: Partial<Omit<TaskNotification, 'id' | 'timestamp'>>
): void {
  ideNotifications.update(notifications => 
    notifications.map(notification => 
      notification.id === id
        ? { ...notification, ...updates }
        : notification
    )
  );
}

export function removeNotification(id: string): void {
  ideNotifications.update(notifications => 
    notifications.filter(notification => notification.id !== id)
  );
}

export function clearAllNotifications(): void {
  ideNotifications.set([]);
}