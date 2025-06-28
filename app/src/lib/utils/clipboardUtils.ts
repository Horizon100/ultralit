/**
 * Clipboard utilities with fallback support
 */

export interface ClipboardResult {
	success: boolean;
	method: 'clipboard' | 'execCommand' | 'execCommand-input' | 'failed';
	error?: string;
}

/**
 * Copy text to clipboard with fallback for older browsers or non-secure contexts
 */
/**
 * Copy text to clipboard with multiple fallback approaches
 */
export async function copyToClipboard(text: string): Promise<ClipboardResult> {
	console.log('🔗 Attempting to copy to clipboard:', text.substring(0, 50) + '...');

	// Method 1: Modern Clipboard API
	if (navigator.clipboard && window.isSecureContext) {
		try {
			await navigator.clipboard.writeText(text);
			console.log('✅ Clipboard API copy successful');
			return { success: true, method: 'clipboard' };
		} catch (err) {
			if (!(err instanceof DOMException && err.name === 'NotAllowedError')) {
				console.warn('❌ Clipboard API failed with unexpected error:', err);
			} else {
				console.log('ℹ️ Clipboard API not allowed, trying fallback...');
			}
		}
	} else {
		console.log('ℹ️ No modern clipboard API available, using fallback directly');
	}

	// Method 2: execCommand fallback
	const fallbackResult = fallbackCopyTextToClipboard(text);
	if (fallbackResult.success) {
		return fallbackResult;
	}

	// Method 3: Alternative fallback for mobile/newer browsers
	console.log('🔄 Trying alternative fallback method...');
	const alternativeResult = alternativeCopyMethod(text);
	if (alternativeResult.success) {
		return alternativeResult;
	}

	// All methods failed
	console.log('❌ All copy methods failed');
	return {
		success: false,
		method: 'failed',
		error: 'All clipboard copy methods failed'
	};
}

/**
 * Alternative copy method for cases where execCommand doesn't work
 */
function alternativeCopyMethod(text: string): ClipboardResult {
	try {
		// Create a more visible element that some browsers might handle better
		const input = document.createElement('input');
		input.type = 'text';
		input.value = text;
		input.style.position = 'absolute';
		input.style.left = '-9999px';
		input.style.top = '-9999px';
		input.style.opacity = '0';

		document.body.appendChild(input);

		// Try different selection methods
		input.focus();
		input.select();

		// For mobile browsers
		if (input.setSelectionRange) {
			input.setSelectionRange(0, text.length);
		}

		const successful = document.execCommand('copy');
		document.body.removeChild(input);

		if (successful) {
			console.log('✅ Alternative copy method successful');
			return { success: true, method: 'execCommand-input' };
		} else {
			console.log('❌ Alternative copy method failed: execCommand returned false');
			return {
				success: false,
				method: 'failed',
				error: 'execCommand returned false'
			};
		}
	} catch (err) {
		console.log('❌ Alternative copy method failed with error:', err);
		return {
			success: false,
			method: 'failed',
			error: err instanceof Error ? err.message : 'Unknown error'
		};
	}
}

/**
 * Fallback copy method using document.execCommand with improved reliability
 */
function fallbackCopyTextToClipboard(text: string): ClipboardResult {
	console.log('🔄 Using fallback copy method...');

	// Create a more robust textarea element
	const textArea = document.createElement('textarea');
	textArea.value = text;

	// Enhanced positioning and styling to avoid any visual artifacts
	textArea.style.position = 'fixed';
	textArea.style.top = '-9999px';
	textArea.style.left = '-9999px';
	textArea.style.width = '1px';
	textArea.style.height = '1px';
	textArea.style.padding = '0';
	textArea.style.border = 'none';
	textArea.style.outline = 'none';
	textArea.style.boxShadow = 'none';
	textArea.style.background = 'transparent';
	textArea.style.opacity = '0';
	textArea.style.pointerEvents = 'none';
	textArea.style.zIndex = '-1';

	// Prevent any user-agent stylesheet interference
	textArea.setAttribute('readonly', '');
	textArea.setAttribute('tabindex', '-1');

	document.body.appendChild(textArea);

	try {
		// Enhanced selection for better cross-browser compatibility
		textArea.focus();
		textArea.select();

		// Additional selection method for iOS Safari
		if (textArea.setSelectionRange) {
			textArea.setSelectionRange(0, text.length);
		}

		// For mobile devices, especially iOS
		if (navigator.userAgent.match(/ipad|iphone/i)) {
			const range = document.createRange();
			range.selectNodeContents(textArea);
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
			textArea.setSelectionRange(0, text.length);
		}

		const successful = document.execCommand('copy');
		document.body.removeChild(textArea);

		if (successful) {
			console.log('✅ Fallback copy successful');
			return { success: true, method: 'execCommand' };
		} else {
			console.log('❌ Fallback copy failed: execCommand returned false');
			return {
				success: false,
				method: 'failed',
				error: 'execCommand copy returned false'
			};
		}
	} catch (err) {
		document.body.removeChild(textArea);
		console.log('❌ Fallback copy failed with error:', err);
		return {
			success: false,
			method: 'failed',
			error: err instanceof Error ? err.message : 'Unknown error during fallback copy'
		};
	}
}

/**
 * Check if clipboard API is available
 */
export function isClipboardSupported(): boolean {
	return !!(navigator.clipboard && window.isSecureContext);
}

/**
 * Check if fallback copy method is available
 */
export function isExecCommandSupported(): boolean {
	return document.queryCommandSupported && document.queryCommandSupported('copy');
}

/**
 * Get comprehensive information about clipboard support
 */
export function getClipboardSupport() {
	const modernSupport = !!(navigator.clipboard && window.isSecureContext);
	const fallbackSupport = !!(
		document.queryCommandSupported && document.queryCommandSupported('copy')
	);

	return {
		modern: modernSupport,
		fallback: fallbackSupport,
		supported: modernSupport || fallbackSupport,
		secureContext: window.isSecureContext,
		protocol: window.location.protocol,
		userAgent: navigator.userAgent.includes('iPhone')
			? 'iOS'
			: navigator.userAgent.includes('Android')
				? 'Android'
				: 'Desktop'
	};
}

/**
 * Get user-friendly message about clipboard limitations
 */
export function getClipboardMessage(): string {
	const support = getClipboardSupport();

	if (!support.secureContext) {
		return 'Clipboard access requires HTTPS. Please copy the link manually.';
	}

	if (support.userAgent === 'iOS') {
		return 'Clipboard may require user permission on iOS. If automatic copy fails, please copy manually.';
	}

	if (!support.supported) {
		return 'Clipboard access is not supported by your browser. Please copy the link manually.';
	}

	return 'Link will be copied to clipboard';
}
