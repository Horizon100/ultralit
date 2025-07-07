// stores/newsletterStore.ts
import { writable, get } from 'svelte/store';
import { pocketbaseUrl } from '$lib/stores/pocketbase'; // Use your existing PocketBase instance
import type { NewsletterSubscription, NewsletterPreferences } from '$lib/types/types.subscriptions';

function createNewsletterStore() {
	const { subscribe: storeSubscribe, set, update } = writable<NewsletterSubscription[]>([]);

	const store = {
		subscribe: storeSubscribe,
		
		subscribeToNewsletter: async (email: string, preferences: NewsletterPreferences) => {
			try {
				const pb = get(pocketbaseUrl);
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
				const pb = get(pocketbaseUrl);
				// Find the subscription by email
				const subscriptions = await pb.collection('subscriptions').getFullList<NewsletterSubscription>({
					filter: `email = "${email}"`
				});

				if (subscriptions.length === 0) {
					throw new Error('Subscription not found');
				}

				// Delete the subscription
				await pb.collection('subscriptions').delete(subscriptions[0].id);

				// Update local store
				update((subs) => subs.filter(sub => sub.email !== email));
				
				return true;
			} catch (err) {
				console.error('Newsletter unsubscribe failed:', err);
				throw new Error('Failed to unsubscribe from newsletter');
			}
		},
		
		updatePreferences: async (email: string, preferences: NewsletterPreferences) => {
			try {
				const pb = get(pocketbaseUrl);
				// Find the subscription by email
				const subscriptions = await pb.collection('subscriptions').getFullList<NewsletterSubscription>({
					filter: `email = "${email}"`
				});

				if (subscriptions.length === 0) {
					throw new Error('Subscription not found');
				}

				// Update the subscription
				const updatedSubscription = await pb.collection('subscriptions').update<NewsletterSubscription>(
					subscriptions[0].id,
					{
						newsletter: preferences.newsletter,
						events: preferences.events
					}
				);

				// Update local store
				update((subs) => 
					subs.map(sub => 
						sub.email === email ? updatedSubscription : sub
					)
				);
				
				return updatedSubscription;
			} catch (err) {
				console.error('Newsletter preferences update failed:', err);
				throw new Error('Failed to update newsletter preferences');
			}
		},
		
		verifySubscription: async (email: string, token: string) => {
			try {
				const pb = get(pocketbaseUrl);
				// Find the subscription by email
				const subscriptions = await pb.collection('subscriptions').getFullList<NewsletterSubscription>({
					filter: `email = "${email}"`
				});

				if (subscriptions.length === 0) {
					throw new Error('Subscription not found');
				}

				// Verify the subscription (you'll need to implement token validation logic)
				const verifiedSubscription = await pb.collection('subscriptions').update<NewsletterSubscription>(
					subscriptions[0].id,
					{
						verified: true
					}
				);

				// Update local store
				update((subs) => 
					subs.map(sub => 
						sub.email === email ? verifiedSubscription : sub
					)
				);
				
				return verifiedSubscription;
			} catch (err) {
				console.error('Newsletter verification failed:', err);
				throw new Error('Failed to verify newsletter subscription');
			}
		},
		
		loadSubscriptions: async () => {
			try {
				const pb = get(pocketbaseUrl);
				const subscriptions = await pb.collection('subscriptions').getFullList<NewsletterSubscription>();
				set(subscriptions);
				return subscriptions;
			} catch (err) {
				console.error('Failed to load subscriptions:', err);
				throw new Error('Failed to load newsletter subscriptions');
			}
		},
		
		checkSubscription: async (email: string): Promise<NewsletterSubscription | null> => {
			try {
				const pb = get(pocketbaseUrl);
				const subscriptions = await pb.collection('subscriptions').getFullList<NewsletterSubscription>({
					filter: `email = "${email}"`
				});

				return subscriptions.length > 0 ? subscriptions[0] : null;
			} catch (err) {
				console.error('Failed to check subscription:', err);
				return null;
			}
		}
	};

	return store;
}

export const newsletterStore = createNewsletterStore();