<script lang="ts">
  import { onMount } from 'svelte';

  let user: any = null;

  onMount(() => {
    // Load Google Identity Services library
    const googleScript = document.createElement('script');
    googleScript.src = "https://accounts.google.com/gsi/client";
    googleScript.async = true;
    googleScript.defer = true;
    document.head.appendChild(googleScript);

    googleScript.onload = () => {
      window.google.accounts.id.initialize({
        client_id: 'YOUR_GOOGLE_CLIENT_ID', // Replace with your actual Google Client ID
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
          clientId: "YOUR_MICROSOFT_CLIENT_ID", // Replace with your actual Microsoft Client ID
          authority: "https://login.microsoftonline.com/common"
        }
      };
      const msalInstance = new msal.PublicClientApplication(msalConfig);
      
      document.getElementById("microsoft-signin-button").onclick = () => {
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
        clientId: 'YOUR_APPLE_CLIENT_ID', // Replace with your actual Apple Client ID
        scope: 'name email',
        redirectURI: 'https://your-redirect-uri.com',
        state: 'origin:web',
        usePopup: true
      });
      
      document.getElementById('apple-signin-button').addEventListener('click', () => {
        AppleID.auth.signIn().then(handleAppleSignIn).catch(console.error);
      });
    };
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
    if (window.google) window.google.accounts.id.disableAutoSelect();
    // Add sign-out logic for Microsoft and Apple if needed
  }
</script>

<main>
  <h1>Welcome to UltraLit</h1>
  
  {#if user}
    <p>Welcome, you're signed in with {user.provider}!</p>
    <button on:click={signOut}>Sign Out</button>
  {:else}
    <div class="signin-container">
      <div id="google-signin-button"></div>
      <button id="microsoft-signin-button">Sign in with Microsoft</button>
      <button id="apple-signin-button" on:click={handleAppleSignIn}>Sign in with Apple</button>
    </div>
  {/if}
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 300px;
    margin: 0 auto;
  }

  h1 {
    color: #ffffff;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
    will-change: filter;
    transition: filter 300ms;
  }

  h1:hover {
    filter: drop-shadow(0 0 3em #ffffff);
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
    border-radius: 5px;
    transition: filter 300ms;
  }

  button:hover {
    filter: drop-shadow(0 0 1em #444444);
  }

  @media (min-width: 640px) {
    main {
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
</style>