<script lang="ts">
  import { currentUser, pocketbaseUrl } from '$lib/pocketbase';
  import Google from '$lib/assets/icons/auth/google.svg';
  import { authenticateWithGoogleOAuth } from '$lib/pocketbase';
  
  let loading = false;
  let error: string | null = null;
  
 async function handleSignIn() {
    loading = true;
    error = null;
    
    try {
      await authenticateWithGoogleOAuth();
      // This code won't be reached due to the redirect
    } catch (err) {
      console.error('Google sign-in error:', err);
      error = err instanceof Error ? err.message : 'Authentication failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="button-expand">
  <button 
    type="button" 
    class="round-btn"
    on:click={handleSignIn} 
    disabled={loading}
  >    
    {#if loading}
      <div class="button-expand">
        <div class="spinner">
        </div>
      </div>
    {:else}
      <img src={Google} alt="Google" class="auth-icon" />
      <span> Sign In with Google</span>
    {/if}
  </button>
</div>

<!-- {#if popupBlocked}
  <div class="popup-blocked-message">
    <p>Popup window was blocked. Please either:</p>
    <ol>
      <li>Allow popups for this site in your browser settings and try again</li>
      <li>
        <button on:click={handleDirectSignIn} class="direct-signin-btn">
          Continue with redirect instead
        </button>
      </li>
    </ol>
  </div>
{/if} -->

{#if error}
  <p class="error">{error}</p>
{/if}



  <style lang="scss">
	@use 'src/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}    
  .button-expand button {
    span {
      display: none;
    }
    &:hover {
      width: auto !important;
      border-radius: 1rem !important;
      span {
        display: inline-block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
    .button {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        width: 100%;
        // padding: 10px;
        border: none;
        cursor: pointer;
        background: transparent;
        transition: background-color 0.3s;
      
      
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
        .popup-blocked-message {
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid #ffcc00;
    background-color: #fffbe6;
    border-radius: 0.5rem;
    
    p {
      margin-top: 0;
      font-weight: bold;
    }
    
    ol {
      margin-bottom: 0;
    }
  }
  
  .direct-signin-btn {
    background-color: transparent;
    border: none;
    color: #4285f4;
    font-weight: bold;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    
    &:hover {
      color: #3367d6;
    }
  }
  
  .error {
    color: red;
    margin-top: 1rem;
  }
    </style>