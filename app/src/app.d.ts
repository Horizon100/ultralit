/// <reference types="@sveltejs/kit" />

declare global {
	namespace App {
	//   interface Locals {}
	//   interface PageData {}
	//   interface Error {}
	//   interface Platform {}
	}
  
	interface ImportMetaEnv {
	  VITE_OPENAI_API_KEY: string;
	}
  

  }
  
  export {};