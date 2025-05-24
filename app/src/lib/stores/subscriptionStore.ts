// stores/subscriptionStore.ts
import { writable } from 'svelte/store';
import PocketBase from 'pocketbase';
import { pocketbaseUrl } from '$lib/pocketbase';
import type { Subscription } from '$lib/types/types.subscriptions';

// Create PocketBase instance
const pb = new PocketBase(pocketbaseUrl);

export interface SubscriptionPreferences {
	newsletter: boolean;
	events: boolean;
	premium: boolean;
}

const TIER_FEATURES = {
	tier1: [], // Define your tier1 features
	tier2: [], // Define your tier2 features
	tier3: [] // Define your tier3 features
};

function generateToken(): string {
	return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function sendVerificationEmail(email: string, token: string) {
	// Implement your email sending logic here
	console.log(`Sending verification email to ${email} with token ${token}`);
}

function createSubscriptionStore() {
	const { subscribe, update } = writable<Subscription[]>([]);

	return {
		subscribe,
		async createSubscription(email: string, preferences: SubscriptionPreferences) {
			try {
				const subscription: Subscription = await pb.collection('subscriptions').create({
					user: '', // Will be populated when user completes registration
					tier: 'tier1',
					status: 'pending',
					start_date: new Date().toISOString(),
					end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
					auto_renew: true,
					monthly_tokens: 1000,
					features: TIER_FEATURES.tier1,
					metadata: {
						payment_method: 'stripe',
						email,
						verificationToken: generateToken(),
						unsubscribeToken: generateToken(),
						verified: false,
						...preferences
					}
				});

				update((subs) => [...subs, subscription]);
				await sendVerificationEmail(email, subscription.metadata.verificationToken!);
				return subscription;
			} catch (err) {
				console.error('Subscription creation failed:', err);
				throw new Error('Failed to create subscription');
			}
		},
		async verify(token: string) {
			try {
				const subscription = await pb
					.collection('subscriptions')
					.getFirstListItem(`metadata.verificationToken="${token}"`);

				if (!subscription) {
					throw new Error('Invalid verification token');
				}

				const updated = (await pb.collection('subscriptions').update(subscription.id, {
					status: 'active',
					metadata: {
						...subscription.metadata,
						verified: true,
						verificationToken: null
					}
				})) as Subscription;

				update((subs) => subs.map((sub) => (sub.id === updated.id ? updated : sub)));

				return true;
			} catch (err) {
				console.error('Verification failed:', err);
				throw new Error('Failed to verify subscription');
			}
		},
		async unsubscribe(token: string) {
			try {
				const subscription = await pb
					.collection('subscriptions')
					.getFirstListItem(`metadata.unsubscribeToken="${token}"`);

				if (!subscription) {
					throw new Error('Invalid unsubscribe token');
				}

				const updated = (await pb.collection('subscriptions').update(subscription.id, {
					status: 'canceled',
					metadata: {
						...subscription.metadata,
						cancel_reason: 'User unsubscribed'
					}
				})) as Subscription;

				update((subs) => subs.map((sub) => (sub.id === updated.id ? updated : sub)));

				return true;
			} catch (err) {
				console.error('Unsubscribe failed:', err);
				throw new Error('Failed to unsubscribe');
			}
		}
	};
}

export const subscriptionStore = createSubscriptionStore();
