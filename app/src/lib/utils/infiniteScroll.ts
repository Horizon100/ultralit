// src/lib/utils/infiniteScroll.ts
interface ObserverOptions {
	root?: Element | null;
	rootMargin?: string;
	threshold?: number | number[];
}
export interface InfiniteScrollConfig {
	// Required: function to load more data
	loadMore: () => Promise<unknown> | unknown;

	// Required: check if more data is available
	hasMore: () => boolean;

	// Required: check if currently loading
	isLoading: () => boolean;

	// Optional: custom trigger element ID (defaults to 'loading-trigger')
	triggerId?: string;

	// Optional: intersection observer options
	observerOptions?: ObserverOptions;

	// Optional: debug logging
	debug?: boolean;
}

export class InfiniteScrollManager {
	private observer: IntersectionObserver | null = null;
	private config: InfiniteScrollConfig;
	private isAttached = false;

	constructor(config: InfiniteScrollConfig) {
		this.config = {
			triggerId: 'loading-trigger',
			observerOptions: {
				rootMargin: '200px',
				threshold: [0, 0.1, 0.5, 1]
			},
			debug: false,
			...config
		};
	}

	private log(...args: unknown[]) {
		if (this.config.debug) {
			console.log('[InfiniteScroll]', ...args);
		}
	}

	setup(): void {
		if (this.observer) {
			this.observer.disconnect();
		}

		this.observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				this.log('🔍 Intersection event:', {
					isIntersecting: entry.isIntersecting,
					intersectionRatio: entry.intersectionRatio,
					target: entry.target.id,
					hasMore: this.config.hasMore(),
					isLoading: this.config.isLoading(),
					boundingRect: {
						top: entry.boundingClientRect.top,
						bottom: entry.boundingClientRect.bottom,
						height: entry.boundingClientRect.height
					}
				});

				if (entry.isIntersecting) {
					this.log('🎯 Element is visible!');

					if (this.config.hasMore() && !this.config.isLoading()) {
						this.log('🚀 Conditions met - triggering loadMore...');
						this.config.loadMore();
					} else {
						this.log('⛔ Conditions not met:', {
							hasMore: this.config.hasMore(),
							isLoading: this.config.isLoading()
						});
					}
				}
			});
		}, this.config.observerOptions);

		this.log('✅ Observer created');
	}

	attach(): boolean {
		const triggerId = this.config.triggerId;
		if (!triggerId) {
			this.log('❌ No trigger ID provided');
			return false;
		}

		const trigger = document.getElementById(triggerId);
		this.log('🎯 Looking for trigger:', triggerId, trigger);

		if (trigger && this.observer) {
			this.observer.observe(trigger);
			this.isAttached = true;
			this.log('✅ Observer attached to trigger');
			return true;
		} else {
			// this.log('❌ Trigger element not found or observer not created');
			return false;
		}
	}

	detach(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.isAttached = false;
			this.log('🧹 Observer detached');
		}
	}

	destroy(): void {
		this.detach();
		this.observer = null;
		this.log('🗑️ Observer destroyed');
	}

	// Try to attach with retries (useful for when DOM isn't ready)
	attachWithRetry(maxAttempts = 10, delayMs = 100): Promise<boolean> {
		return new Promise((resolve) => {
			let attempts = 0;

			const tryAttach = () => {
				attempts++;
				this.log(`🔄 Attempt ${attempts} to attach observer...`);

				if (this.attach()) {
					this.log('✅ Observer successfully attached!');
					resolve(true);
					return;
				}

				if (attempts < maxAttempts) {
					setTimeout(tryAttach, delayMs);
				} else {
					this.log('❌ Failed to attach observer after', maxAttempts, 'attempts');
					resolve(false);
				}
			};

			// Start trying after initial delay
			setTimeout(tryAttach, delayMs);
		});
	}

	get isObserverAttached(): boolean {
		return this.isAttached;
	}
}
