// stores/newsletterStore.ts
import { writable, get } from 'svelte/store';
import PocketBase from 'pocketbase';
import { pocketbaseUrl } from '$lib/stores/pocketbase';
import type { NewsletterSubscription, NewsletterPreferences } from '$lib/types/types.subscriptions';

const pb = new PocketBase(get(pocketbaseUrl));

function createNewsletterStore() {
	const { subscribe: storeSubscribe, update } = writable<NewsletterSubscription[]>([]);

	const store = {
		subscribe: storeSubscribe,
		subscribeToNewsletter: async (email: string, preferences: NewsletterPreferences) => {
			try {
				const subscription = await pb.collection('subscriptions').create<NewsletterSubscription>({
					email,
					newsletter: preferences.newsletter,
					events: preferences.events,
					verified: false
				});

				update((subs) => [...subs, subscription]);
				return subscription;
			} catch (err) {
				console.error('Newsletter subscription failed:', err);
				throw new Error('Failed to subscribe to newsletter');
			}
		},
		unsubscribe: async (email: string) => {
			try {
				const subscription = await pb
					.collection('subscriptions')
					.getFirstListItem<NewsletterSubscription>(`email="${email}"`);

				if (subscription) {
					await pb.collection('subscriptions').delete(subscription.id);
					update((subs) => subs.filter((sub) => sub.id !== subscription.id));
				}
				return true;
			} catch (err) {
				console.error('Newsletter unsubscribe failed:', err);
				throw new Error('Failed to unsubscribe from newsletter');
			}
		}
	};

	return store;
}

export const newsletterStore = createNewsletterStore();
