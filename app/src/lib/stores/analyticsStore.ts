// Create: src/lib/stores/analyticsStore.ts

import { browser } from '$app/environment';
import { 
	PUBLIC_UMAMI_ENABLED,
	PUBLIC_UMAMI_WEBSITE_ID 
} from '$env/static/public';

interface AnalyticsEvent {
	name: string;
	data?: Record<string, any>;
	timestamp?: Date;
}

class AnalyticsStore {
	private isEnabled: boolean;
	private isDebug: boolean = false; // Set to true for debugging

	constructor() {
		this.isEnabled = PUBLIC_UMAMI_ENABLED === 'true' && !!PUBLIC_UMAMI_WEBSITE_ID;
		
		if (this.isDebug) {
			console.log('🔍 Analytics Store initialized:', {
				enabled: this.isEnabled,
				website_id: PUBLIC_UMAMI_WEBSITE_ID
			});
		}
	}

	// Check if Umami is loaded and available
	private isUmamiAvailable(): boolean {
		if (!browser || !this.isEnabled) return false;
		
		const hasUmami = typeof window !== 'undefined' && !!(window as any).umami;
		
		if (this.isDebug && !hasUmami) {
			console.log('🔍 Umami not available, falling back to console logging');
		}
		
		return hasUmami;
	}

	// Track page views (called automatically by Umami)
	trackPageView(url?: string) {
		if (!browser) return;
		
		try {
			if (this.isUmamiAvailable()) {
				if (url) {
					(window as any).umami.track(url);
				}
			} else if (this.isDebug) {
				console.log('🔍 Analytics: Page view', { url });
			}
		} catch (error) {
			console.warn('Analytics: Failed to track page view', error);
		}
	}

	// Track custom events
	trackEvent(eventName: string, eventData?: Record<string, any>) {
		if (!browser) return;
		
		try {
			if (this.isUmamiAvailable()) {
				(window as any).umami.track(eventName, eventData);
				
				if (this.isDebug) {
					console.log('🔍 Analytics: Event tracked via Umami', { eventName, eventData });
				}
			} else {
				// Fallback: log to console or store locally
				console.log('🔍 Analytics: Event tracked (fallback)', { eventName, eventData });
				
				// Optional: Store events locally for later sending
				this.storeEventLocally(eventName, eventData);
			}
		} catch (error) {
			console.warn('Analytics: Failed to track event', error);
		}
	}

	// Store events locally when Umami is not available
	private storeEventLocally(eventName: string, eventData?: Record<string, any>) {
		if (!browser) return;
		
		try {
			const event: AnalyticsEvent = {
				name: eventName,
				data: eventData,
				timestamp: new Date()
			};
			
			const existingEvents = JSON.parse(localStorage.getItem('pending_analytics') || '[]');
			existingEvents.push(event);
			
			// Keep only last 100 events
			if (existingEvents.length > 100) {
				existingEvents.splice(0, existingEvents.length - 100);
			}
			
			localStorage.setItem('pending_analytics', JSON.stringify(existingEvents));
		} catch (error) {
			console.warn('Failed to store event locally:', error);
		}
	}

	// Send any pending events when Umami becomes available
	sendPendingEvents() {
		if (!this.isUmamiAvailable() || !browser) return;
		
		try {
			const pendingEvents = JSON.parse(localStorage.getItem('pending_analytics') || '[]');
			
			pendingEvents.forEach((event: AnalyticsEvent) => {
				this.trackEvent(event.name, event.data);
			});
			
			// Clear pending events
			localStorage.removeItem('pending_analytics');
			
			if (this.isDebug && pendingEvents.length > 0) {
				console.log(`🔍 Analytics: Sent ${pendingEvents.length} pending events`);
			}
		} catch (error) {
			console.warn('Failed to send pending events:', error);
		}
	}

	// Track user interactions
	trackInteraction(action: string, target: string, value?: string | number) {
		this.trackEvent('interaction', {
			action,
			target,
			value
		});
	}

	// Track agent interactions specifically
	trackAgentInteraction(action: 'assign' | 'unassign' | 'auto-reply', agentId: string, postId: string) {
		this.trackEvent('agent_interaction', {
			action,
			agent_id: agentId,
			post_id: postId
		});
	}

	// Track post interactions
	trackPostInteraction(action: 'upvote' | 'downvote' | 'share' | 'comment' | 'view', postId: string) {
		this.trackEvent('post_interaction', {
			action,
			post_id: postId
		});
	}

	// Set user properties (if supported)
	setUserProperties(properties: Record<string, any>) {
		if (!browser) return;
		
		try {
			// Umami doesn't have built-in user properties, but you can track them as events
			this.trackEvent('user_properties', properties);
		} catch (error) {
			console.warn('Analytics: Failed to set user properties', error);
		}
	}

	// Enable debug mode
	enableDebug(enabled: boolean = true) {
		this.isDebug = enabled;
		console.log(`🔍 Analytics debug mode: ${enabled ? 'enabled' : 'disabled'}`);
	}
}

export const analytics = new AnalyticsStore();