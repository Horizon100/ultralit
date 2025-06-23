// src/lib/utils/swipeGesture.ts

export interface SwipeConfig {
	threshold?: number;
	angleThreshold?: number;
	onSwipeLeft?: () => void;
	onSwipeRight?: () => void;
	onSwipeUp?: () => void;
	onSwipeDown?: () => void;
	enableVisualFeedback?: boolean;
}

export interface SwipeState {
	startX: number;
	startY: number;
	isDragging: boolean;
	element?: HTMLElement;
}

export class SwipeGestureHandler {
	private config: Required<SwipeConfig>;
	public state: SwipeState; // Make state public so we can access it

	constructor(config: SwipeConfig = {}) {
		this.config = {
			threshold: config.threshold ?? 100,
			angleThreshold: config.angleThreshold ?? 30,
			onSwipeLeft: config.onSwipeLeft ?? (() => {}),
			onSwipeRight: config.onSwipeRight ?? (() => {}),
			onSwipeUp: config.onSwipeUp ?? (() => {}),
			onSwipeDown: config.onSwipeDown ?? (() => {}),
			enableVisualFeedback: config.enableVisualFeedback ?? false
		};

		this.state = {
			startX: 0,
			startY: 0,
			isDragging: false
		};
	}

	handleTouchStart = (event: TouchEvent) => {
		console.log('🟡 Touch start detected');
		const touch = event.touches[0];
		this.state.startX = touch.clientX;
		this.state.startY = touch.clientY;
		this.state.isDragging = true;
		this.state.element = event.currentTarget as HTMLElement;
		console.log('🟡 Touch start - X:', this.state.startX, 'Y:', this.state.startY);

		// Prevent default to avoid conflicts with browser gestures
		if (this.config.enableVisualFeedback) {
			event.preventDefault();
		}
	};

	handleTouchMove = (event: TouchEvent) => {
		if (!this.state.isDragging) return;

		const touch = event.touches[0];
		const deltaX = touch.clientX - this.state.startX;
		const deltaY = touch.clientY - this.state.startY;

		console.log('🟡 Touch move - deltaX:', deltaX, 'deltaY:', deltaY);

		// Add smooth visual feedback if enabled
		if (this.state.element && this.config.enableVisualFeedback) {
			const maxTranslate = 100; // Maximum translate distance
			const resistance = 0.3; // Resistance factor for smooth movement

			// Calculate smooth translation with resistance
			let translateX = deltaX * resistance;
			let translateY = deltaY * resistance;

			// Apply max limits and add rubber band effect at edges
			if (Math.abs(translateX) > maxTranslate) {
				const overflow = Math.abs(translateX) - maxTranslate;
				const rubberBand = maxTranslate + overflow * 0.2; // Reduced movement after threshold
				translateX = translateX > 0 ? rubberBand : -rubberBand;
			}

			if (Math.abs(translateY) > maxTranslate) {
				const overflow = Math.abs(translateY) - maxTranslate;
				const rubberBand = maxTranslate + overflow * 0.2;
				translateY = translateY > 0 ? rubberBand : -rubberBand;
			}

			// Apply smooth transform
			this.state.element.style.transform = `translate(${translateX}px, ${translateY}px)`;
			this.state.element.style.transition = 'none';

			// Add subtle scale effect for better feedback
			const scale = 1 - Math.abs(deltaX) * 0.0001;
			const clampedScale = Math.max(0.98, Math.min(1, scale));
			this.state.element.style.transform = `translate(${translateX}px, ${translateY}px) scale(${clampedScale})`;
		}

		// Prevent scrolling if this is a horizontal swipe
		const angle = (Math.atan2(Math.abs(deltaY), Math.abs(deltaX)) * 180) / Math.PI;
		const isHorizontal = angle < this.config.angleThreshold;

		if (isHorizontal && Math.abs(deltaX) > 10) {
			event.preventDefault();
		}
	};

	handleTouchEnd = (event: TouchEvent) => {
		if (!this.state.isDragging) return;

		const touch = event.changedTouches[0];
		const deltaX = touch.clientX - this.state.startX;
		const deltaY = touch.clientY - this.state.startY;

		console.log('🔴 Touch end - deltaX:', deltaX, 'deltaY:', deltaY);

		// Calculate swipe direction and angle first
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		console.log('🔴 Distance:', distance, 'Threshold:', this.config.threshold);

		const angle = (Math.atan2(Math.abs(deltaY), Math.abs(deltaX)) * 180) / Math.PI;
		const isHorizontal = angle < this.config.angleThreshold;
		const isVertical = angle > 90 - this.config.angleThreshold;

		console.log('🔴 Angle:', angle, 'Is horizontal:', isHorizontal, 'Is vertical:', isVertical);

		// Determine if this is a valid swipe
		const isValidSwipe = distance >= this.config.threshold;

		// Apply smooth animation based on swipe result
		if (this.state.element && this.config.enableVisualFeedback) {
			if (isValidSwipe && isHorizontal) {
				// Animate to completion before snapping back
				const finalTranslate = deltaX > 0 ? 150 : -150;
				this.state.element.style.transition = 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
				this.state.element.style.transform = `translate(${finalTranslate}px, 0) scale(0.95)`;

				// Then snap back with a slight delay
				setTimeout(() => {
					if (this.state.element) {
						this.state.element.style.transition =
							'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
						this.state.element.style.transform = 'translate(0, 0) scale(1)';
					}
				}, 150);
			} else {
				// Smooth bounce back for invalid swipes
				this.state.element.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
				this.state.element.style.transform = 'translate(0, 0) scale(1)';
			}

			// Clean up after animations complete
			setTimeout(() => {
				if (this.state.element) {
					this.state.element.style.transition = '';
					this.state.element.style.transform = '';
				}
			}, 600);
		}

		// Execute swipe callbacks for valid swipes
		if (isValidSwipe) {
			if (isHorizontal) {
				if (deltaX > 0) {
					console.log('🟢 Swipe RIGHT detected!');
					this.config.onSwipeRight();
				} else {
					console.log('🟢 Swipe LEFT detected!');
					this.config.onSwipeLeft();
				}
			} else if (isVertical) {
				if (deltaY > 0) {
					console.log('🟢 Swipe DOWN detected!');
					this.config.onSwipeDown();
				} else {
					console.log('🟢 Swipe UP detected!');
					this.config.onSwipeUp();
				}
			}
		} else {
			console.log('🔴 Distance too small, ignoring swipe');
		}

		this.state.isDragging = false;
	};

	handleTouchCancel = () => {
		console.log('🟠 Touch cancelled');
		if (this.state.element && this.config.enableVisualFeedback) {
			// Smooth bounce back animation on cancel
			this.state.element.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
			this.state.element.style.transform = 'translate(0, 0) scale(1)';
			setTimeout(() => {
				if (this.state.element) {
					this.state.element.style.transition = '';
					this.state.element.style.transform = '';
				}
			}, 400);
		}
		this.state.isDragging = false;
	};

	// Method to get event handlers for easy binding
	getEventHandlers() {
		return {
			touchstart: this.handleTouchStart,
			touchmove: this.handleTouchMove,
			touchend: this.handleTouchEnd,
			touchcancel: () => this.handleTouchCancel()
		};
	}

	// Update configuration
	updateConfig(newConfig: Partial<SwipeConfig>) {
		this.config = { ...this.config, ...newConfig };
	}

	// Cleanup method
	destroy() {
		if (this.state.element && this.config.enableVisualFeedback) {
			this.state.element.style.transform = '';
			this.state.element.style.transition = '';
		}
		this.state.isDragging = false;
	}
}

// Svelte action for easy use
export function swipeGesture(node: HTMLElement, config: SwipeConfig = {}) {
	// console.log('🚀 Swipe gesture initialized on element:', node, 'Config:', config);
	const handler = new SwipeGestureHandler(config);
	const eventHandlers = handler.getEventHandlers();

	// Add event listeners with proper options
	const options = { passive: false }; // Changed to false to allow preventDefault
	node.addEventListener('touchstart', eventHandlers.touchstart, options);
	node.addEventListener('touchmove', eventHandlers.touchmove, options);
	node.addEventListener('touchend', eventHandlers.touchend, options);
	node.addEventListener('touchcancel', eventHandlers.touchcancel, options);

	// console.log('🚀 Event listeners added to element');

	return {
		update(newConfig: SwipeConfig) {
			// console.log('🔄 Swipe config updated:', newConfig);
			handler.updateConfig(newConfig);
		},
		destroy() {
			// console.log('🗑️ Swipe gesture destroyed');
			node.removeEventListener('touchstart', eventHandlers.touchstart);
			node.removeEventListener('touchmove', eventHandlers.touchmove);
			node.removeEventListener('touchend', eventHandlers.touchend);
			node.removeEventListener('touchcancel', eventHandlers.touchcancel);
			handler.destroy();
		}
	};
}
