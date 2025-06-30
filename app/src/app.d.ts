// / <reference types="@sveltejs/kit" />

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
  
	interface ImportMetaEnv {
	  VITE_OPENAI_API_KEY: string;
	  VITE_POCKETBASE_URL: string;
	}
  }
  
  export {};