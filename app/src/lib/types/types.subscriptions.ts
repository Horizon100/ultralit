import type { Feature } from './types.features';
import type { PaymentMethod } from './types.transactions';
import type { User } from './types';

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
	created: string;
	upadete: string;
}

export interface NewsletterSubscription {
	id: string;
	email: string;
	newsletter: boolean;
	events: boolean;
	verified: boolean;
	verificationToken?: string;
	unsubscribeToken?: string;
	preferences: string[];
	user: User;
	created: string;
	upadete: string;
}

export interface NewsletterPreferences {
	newsletter: boolean;
	events: boolean;
}
