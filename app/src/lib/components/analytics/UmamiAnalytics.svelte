<!-- src/lib/components/analytics/UmamiAnalytics.svelte -->

<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { 
		PUBLIC_UMAMI_SCRIPT_URL, 
		PUBLIC_UMAMI_WEBSITE_ID, 
		PUBLIC_UMAMI_ENABLED 
	} from '$env/static/public';

	let scriptLoaded = false;

	onMount(() => {
		if (!browser) return;
		
		// Check if Umami is enabled and has required config
		const isEnabled = PUBLIC_UMAMI_ENABLED === 'true';
		const hasScriptUrl = PUBLIC_UMAMI_SCRIPT_URL && PUBLIC_UMAMI_SCRIPT_URL !== '';
		const hasWebsiteId = PUBLIC_UMAMI_WEBSITE_ID && PUBLIC_UMAMI_WEBSITE_ID !== '';

		if (!isEnabled || !hasScriptUrl || !hasWebsiteId) {
			console.log('🔍 Umami Analytics: Disabled or missing configuration');
			return;
		}

		// Check if script is already loaded
		const existingScript = document.querySelector(`script[src="${PUBLIC_UMAMI_SCRIPT_URL}"]`);
		if (existingScript) {
			console.log('🔍 Umami Analytics: Script already loaded');
			scriptLoaded = true;
			return;
		}

		// Load Umami script
		const script = document.createElement('script');
		script.defer = true;
		script.src = PUBLIC_UMAMI_SCRIPT_URL;
		script.setAttribute('data-website-id', PUBLIC_UMAMI_WEBSITE_ID);
		
		script.onload = () => {
			console.log('🔍 Umami Analytics: Script loaded successfully');
			scriptLoaded = true;
		};
		
		script.onerror = () => {
			console.error('🔍 Umami Analytics: Failed to load script');
		};

		document.head.appendChild(script);

		return () => {
			// Cleanup on component destroy
			const scriptToRemove = document.querySelector(`script[src="${PUBLIC_UMAMI_SCRIPT_URL}"]`);
			if (scriptToRemove) {
				scriptToRemove.remove();
			}
		};
	});

	// Export function to track custom events (optional)
	export function trackEvent(eventName: string, eventData?: Record<string, any>) {
		if (!browser || !scriptLoaded) return;
		
		// Check if umami is available on window
		if (typeof window !== 'undefined' && (window as any).umami) {
			(window as any).umami.track(eventName, eventData);
		}
	}
</script>

<!-- This component doesn't render anything visible -->
<div style="display: none;"></div>