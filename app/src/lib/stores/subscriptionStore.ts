// stores/subscriptionStore.ts
import { writable } from 'svelte/store';
import { pb } from '$lib/pocketbase';
import type { Feature } from '$lib/types/types.features';
import type { PaymentMethod } from '$lib/types/types.transactions';

export interface SubscriptionPreferences {
	newsletter: boolean;
	events: boolean;
	premium: boolean;
}

export interface Subscription {
	id: string;
	user: string;
	tier: 'tier1' | 'tier2' | 'tier3';
	status: 'active' | 'canceled' | 'expired' | 'pending';
	start_date: string;
	end_date: string;
	auto_renew: boolean;
	monthly_tokens: number;
	features: Feature[];
	metadata: {
		last_renewal?: string;
		cancel_reason?: string;
		payment_method: PaymentMethod;
		payment_reference?: string;
		email?: string;
		verificationToken?: string;
		unsubscribeToken?: string;
		verified?: boolean;
	};
}

function generateToken(): string {
	return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function sendVerificationEmail(email: string, token: string) {
	// Implement your email sending logic here
	console.log(`Sending verification email to ${email} with token ${token}`);
}

function createSubscriptionStore() {
	const { subscribe, set, update } = writable<Subscription[]>([]);

	return {
		subscribe,
		async subscribe(email: string, preferences: SubscriptionPreferences) {
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

				const updated = await pb.collection('subscriptions').update(subscription.id, {
					status: 'active',
					metadata: {
						...subscription.metadata,
						verified: true,
						verificationToken: null
					}
				});

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

				const updated = await pb.collection('subscriptions').update(subscription.id, {
					status: 'canceled',
					metadata: {
						...subscription.metadata,
						cancel_reason: 'User unsubscribed'
					}
				});

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
