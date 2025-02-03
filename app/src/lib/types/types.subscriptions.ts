// Additional interface for subscription management
import type { Feature } from './types.features';
import type { PaymentMethod } from './types.transactions';

export interface Subscription {
	id: string;
	user: string;
	tier: 'tier1' | 'tier2' | 'tier3';
	status: 'active' | 'canceled' | 'expired';
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
	};
}

export interface NewsletterSubscription {
	id: string;
	email: string;
	newsletter: boolean;
	events: boolean;
	verified: boolean;
	verificationToken?: string;
}

export interface NewsletterPreferences {
	newsletter: boolean;
	events: boolean;
}
