<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/pocketbase';
  
  let loading = false;
  let error: string | null = null;
  let debugInfo = null;
  
  async function handleSignIn() {
    loading = true;
    error = null;
    
    try {
      console.log('Starting Google auth process...');
      
      // Call your server API endpoint to get the Google auth URL
      const response = await fetch('/api/auth/google', {
        method: 'GET',
        credentials: 'include'
      });
      
      // Get full response text for debugging
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('Invalid server response');
      }
      
      if (!response.ok) {
        console.error('Server returned error:', data);
        throw new Error(data.error || 'Failed to start authentication');
      }
      
      console.log('Auth response:', data);
      
      if (data.success && data.authUrl) {
        // Log before redirect
        console.log('Redirecting to:', data.authUrl);
        
        // Redirect to the Google auth URL
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to start authentication');
      }
    } catch (err) {
      console.error('Failed to start Google auth:', err);
      error = err instanceof Error ? err.message : 'Authentication failed';
      loading = false;
    }
  }
</script>
  
<button 
  type="button" 
  class="auth-button" 
  on:click={handleSignIn} 
  disabled={loading}
>    
  {#if loading}
    <div class="spinner-container">
      <div class="spinner">
      </div>
    </div>
  {:else}
    <!-- Sign in with Google -->
  {/if}
</button>
  
{#if error}
  <p class="error">{error}</p>
{/if}

  <style lang="scss">
	@use 'src/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}    
    .auth-button {
          font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,"Fira Sans","Droid Sans","Helvetica Neue",sans-serif;
          background-image: url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48cGF0aCBkPSJNMTcuNiA5LjJsLS4xLTEuOEg5djMuNGg0LjhDMTMuNiAxMiAxMyAxMyAxMiAxMy42djIuMmgzYTguOCA4LjggMCAwIDAgMi42LTYuNnoiIGZpbGw9IiM0Mjg1RjQiIGZpbGwtcnVsZT0ibm9uemVybyIvPjxwYXRoIGQ9Ik05IDE4YzIuNCAwIDQuNS0uOCA2LTIuMmwtMy0yLjJhNS40IDUuNCAwIDAgMS04LTIuOUgxVjEzYTkgOSAwIDAgMCA4IDV6IiBmaWxsPSIjMzRBODUzIiBmaWxsLXJ1bGU9Im5vbnplcm8iLz48cGF0aCBkPSJNNCAxMC43YTUuNCA1LjQgMCAwIDEgMC0zLjRWNUgxYTkgOSAwIDAgMCAwIDhsMy0yLjN6IiBmaWxsPSIjRkJCQzA1IiBmaWxsLXJ1bGU9Im5vbnplcm8iLz48cGF0aCBkPSJNOSAzLjZjMS4zIDAgMi41LjQgMy40IDEuM0wxNSAyLjNBOSA5IDAgMCAwIDEgNWwzIDIuNGE1LjQgNS40IDAgMCAxIDUtMy43eiIgZmlsbD0iI0VBNDMzNSIgZmlsbC1ydWxlPSJub256ZXJvIi8+PHBhdGggZD0iTTAgMGgxOHYxOEgweiIvPjwvZz48L3N2Zz4=);
          background-repeat: no-repeat;
          background-position: 1rem 1rem;
          background-size: 2rem 2rem; /* Adjust this value to make the image bigger */
          width: 4rem;
          display: flex;
          height: auto;
          font-size: 1.2rem;
          border-radius: 1rem;
          border: none;
      
      &:hover {
          box-shadow: 0 -1px 0 rgba(0, 0, 0, .04), 0 10px 4px rgba(0, 0, 0, .25);
          cursor: pointer;
      }
      
      &:active {
          background-color: #eeeeee;
      }
      
      &:focus {
          outline: none;
          box-shadow: 
          0 -1px 0 rgba(0, 0, 0, .04),
          0 2px 4px rgba(0, 0, 0, .25),
          0 0 0 3px #c8dafc;
      }
      
      &:disabled {
          filter: grayscale(100%);
          background-color: #ebebeb;
          box-shadow: 0 -1px 0 rgba(0, 0, 0, .04), 0 1px 1px rgba(0, 0, 0, .25);
          cursor: not-allowed;
      }
      }
    </style>