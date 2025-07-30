/// <reference types="@sveltejs/kit" />

declare namespace svelteHTML {
	interface HTMLAttributes<T> {
		// This covers ALL data-* attributes automatically
		[key: `data-${string}`]: string | number | boolean | undefined;
		
		// This covers ALL aria-* attributes automatically  
		[key: `aria-${string}`]: string | number | boolean | undefined;
		
		// This covers ALL use:* actions automatically
		[key: `use:${string}`]: unknown;
	}
	
	// Add specific typing for elements you use with bind:this
	interface IntrinsicElements {
	'div': { this?: HTMLDivElement } & HTMLAttributes<HTMLDivElement>;
	'button': { this?: HTMLButtonElement } & HTMLAttributes<HTMLButtonElement>;
	'input': { this?: HTMLInputElement } & HTMLAttributes<HTMLInputElement>;
	'span': { this?: HTMLSpanElement } & HTMLAttributes<HTMLSpanElement>;
	}
}  
declare global {
namespace App {
	interface Locals {
	pb: import('pocketbase').default;
	user: import('$lib/types/types').User | null;
	}
	
		/*
		* interface PageData {}
		* interface Error {}
		* interface Platform {}
		*/
	}

// interface ImportMetaEnv {
//   VITE_POCKETBASE_URL: string;
// VITE_PUBLIC_UMAMI_ENABLED: string;
// VITE_PUBLIC_UMAMI_WEBSITE_ID: string;
// }
}
declare module '$env/dynamic/private' {
	export const env: {
		POCKETBASE_URL: string;
		OPENAI_API_KEY: string;
		ANTHROPIC_API_KEY: string;
		OLLAMA_DEV_URL: string;
		OLLAMA_PROD_URL: string;
		TTS_DEV_URL: string;
		TTS_PROD_URL: string;
		CV_DETECTION_URL: string;
		CV_DETECTION_WS: string;
		[key: string]: string | undefined;
	};
}


declare module '$env/dynamic/public' {
	export const env: {
		PUBLIC_UMAMI_ENABLED: string;
		PUBLIC_UMAMI_WEBSITE_ID: string;
		PUBLIC_UMAMI_SCRIPT_URL: string;
		PUBLIC_POCKETBASE_URL: string;
		[key: string]: string | undefined;
	};
}

export {};