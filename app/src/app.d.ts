// / <reference types="@sveltejs/kit" />
declare global {
	namespace App {
	  interface Locals {
		pb: import('pocketbase').default;
		user: import('$lib/types/types').User | null;
	  }
	  
	  // interface PageData {}
	  // interface Error {}
	  // interface Platform {}
	}
  
	interface ImportMetaEnv {
	  VITE_OPENAI_API_KEY: string;
	  VITE_POCKETBASE_URL: string;
	}
  }
  
  export {};