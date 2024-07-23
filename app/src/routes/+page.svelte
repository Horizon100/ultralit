<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import horizon100 from '$lib/images/horizon100.svg';

	let user: { provider: string; token: string } | null = null;
	
	onMount(() => {
	  if (browser) {
		// Load Google Identity Services library
		const googleScript = document.createElement('script');
		googleScript.src = "https://accounts.google.com/gsi/client";
		googleScript.async = true;
		googleScript.defer = true;
		document.head.appendChild(googleScript);
	
		googleScript.onload = () => {
		  window.google.accounts.id.initialize({
			client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, // Use environment variable
			callback: handleGoogleSignIn
		  });
	
		  window.google.accounts.id.renderButton(
			document.getElementById("google-signin-button"),
			{ theme: "inline", size: "large" }
		  );
		};
	
		// Load Microsoft Authentication library
		const msScript = document.createElement('script');
		msScript.src = "https://alcdn.msauth.net/browser/2.30.0/js/msal-browser.min.js";
		msScript.async = true;
		document.head.appendChild(msScript);
	
		msScript.onload = () => {
		  const msalConfig = {
			auth: {
			  clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID, // Use environment variable
			  authority: "https://login.microsoftonline.com/common"
			}
		  };
		  const msalInstance = new msal.PublicClientApplication(msalConfig);
		  
		  document.getElementById("microsoft-signin-button")!.onclick = () => {
			msalInstance.loginPopup().then(handleMicrosoftSignIn).catch(console.error);
		  };
		};
	
		// Load Apple Sign In JS
		const appleScript = document.createElement('script');
		appleScript.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
		appleScript.async = true;
		document.head.appendChild(appleScript);
	
		appleScript.onload = () => {
		  AppleID.auth.init({
			clientId: import.meta.env.VITE_APPLE_CLIENT_ID, // Use environment variable
			scope: 'name email',
			redirectURI: 'https://your-redirect-uri.com',
			state: 'origin:web',
			usePopup: true
		  });
		  
		  document.getElementById('apple-signin-button')!.addEventListener('click', () => {
			AppleID.auth.signIn().then(handleAppleSignIn).catch(console.error);
		  });
		};
	  }
	});
	
	function handleGoogleSignIn(response: any) {
	  console.log("Google Sign-In:", response.credential);
	  user = { provider: 'Google', token: response.credential };
	}
	
	function handleMicrosoftSignIn(response: any) {
	  console.log("Microsoft Sign-In:", response.accessToken);
	  user = { provider: 'Microsoft', token: response.accessToken };
	}
	
	function handleAppleSignIn(response: any) {
	  console.log("Apple Sign-In:", response.authorization.id_token);
	  user = { provider: 'Apple', token: response.authorization.id_token };
	}
	
	function signOut() {
	  user = null;
	  if (browser && window.google) window.google.accounts.id.disableAutoSelect();
	  // Add sign-out logic for Microsoft and Apple if needed
	}
</script>

<svelte:head>
  <title>Home</title>
  <meta name="description" content="UltraLit - Sign in to get started" />
</svelte:head>

<section>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>
	<br>

	<div class="row-container">
		<img src={horizon100} alt="Horizon100" class="horizon100-image" />

		<h1>UltraLit</h1>
	</div>
	<br>
	<br>
	<br>

	<div class="row-container">
		<p>This is testing environment for horizon100 multi-ai-agent interactions on various discrete applications. Collabarion options are included to share projects.</p>
		
		{#if user}
			<p>Welcome, you're signed in with {user.provider}!</p>
			<button on:click={signOut}>Sign Out</button>
		{:else}
			<div class="signin-container">
			<div id="google-signin-button"></div>
			<button id="microsoft-signin-button">Sign in with Microsoft</button>
			<button id="apple-signin-button">Sign in with Apple</button>
			</div>
		{/if}
	</div>

</section>

<style>


h1 {
	font-size: 3rem;
}
  
	.signin-container {
	  display: flex;
	  flex-direction: column;
	  align-items: center;
	  gap: 10px;
	  margin-top: 20px;
	}
  
	.signin-container > div,
	.signin-container > button {
	  width: 100%;
	  max-width: 180px;
	  height: 40px;
	  display: flex;
	  justify-content: center;
	  align-items: center;
	}
  
	button {
	  padding: 0;  
	  font-size: 14px;
	  cursor: pointer;
	  background-color: #000000;
	  color: #ffffff;
	  border: none;
	  border-radius: 5px;
	  transition: filter 300ms;
	}
  
	button:hover {
	  filter: drop-shadow(0 0 1em #444444);
	}
  
	@media (min-width: 640px) {
	  section {
		max-width: 400px;
	  }
	}
  
	/* Custom text highlight color */
	::selection {
	  background-color: #ff3e00;
	  color: #ffffff;
	}
  
	/* For Firefox */
	::-moz-selection {
	  background-color: #ff3e00;
	  color: #ffffff;
	}

	/* New styles for horizon100 image */
	.horizon100-image {
		animation: pulse 2s infinite ease-in-out;
		transition: transform 0.5s ease-in-out, filter 0.5s ease-in-out;
		width: 100px;
		filter: drop-shadow(0 2em 3em #2e2d2d);
		will-change: filter, transform;
	}

	.horizon100-image:hover {
	  animation: rotate360 0.7s forwards, glowBrighter 1s forwards;
	  transition: filter 300ms, transform 300ms ease-in-out;

	}

	@keyframes pulse {
	  0% { transform: scale(1); }
	  50% { transform: scale(1.05); }
	  100% { transform: scale(1); }
	}

	@keyframes rotate360 {
	  from { transform: rotate(0deg); }
	  to { transform: rotate(360deg); }
	}

	@keyframes glowBrighter {
	  to { filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.9)); }
	}
</style>