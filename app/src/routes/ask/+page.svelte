<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { threadsStore } from '$lib/stores/threadsStore';
  import AIChat from '$lib/components/ai/AIChat.svelte';
  import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
  import { Bot } from 'lucide-svelte';
  import { fade } from 'svelte/transition';

  let threadId: string | null = null;
  let messageId: string | null = null;
  let isLoading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      threadId = $page.url.searchParams.get('threadId');
      messageId = $page.url.searchParams.get('messageId');

      // Don't load messages here, just set the current thread in store
      if (threadId) {
        threadsStore.setCurrentThread(threadId);
      }
    } catch (e) {
      error = "Failed to load thread. Please try again.";
      console.error(e);
    } finally {
      setTimeout(() => {
        isLoading = false;
      }, 500);
    }
  });
</script>

<main>
  {#if isLoading}
    <div class="center-container" transition:fade={{ duration: 300 }}>
      <div class="loading-overlay">
        <div class="spinner">
          <Bot size={80} class="bot-icon" />
        </div>
      </div>
    </div>
  {:else if error}
    <div class="error" transition:fade>{error}</div>
  {:else}
    <div transition:fade={{ duration: 300 }}>
      <AIChat 
        threadId={threadId}
        initialMessageId={messageId}
      />
    </div>
  {/if}
</main>



  
<style lang="scss">
	@use "src/themes.scss" as *;
  :global(.loading-spinner) {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 9999;
    }
    main {
      display: flex;
      flex-direction: column;
      position: absolute;
      width: 98%;
      right: 1%;
      height: 90vh;
        text-align: center;
        justify-content: right;
        align-items: right;
        /* padding: 1em; */
        /* height: 94vh; */
        /* width: 59%; */
        /* margin-left: 50%; */
        /* margin-top: 25%; */
        /* max-width: 240px; */
        /* margin: 0 auto; */
        color: #FFD700;
        border-radius: 50px;
        transition: all ease 0.3s;

        background-color: var(--primary-color);
        animation: pulsate 1.5s infinite alternate;

    }

      @keyframes pulsate {
    0% { box-shadow: 0 0 5px #f8f8f8, 0 0 2px #39ff88; }

    100% { box-shadow: 0 0 5px #bcbcbc, 0 0 1px #b5b5b5; }
  }
  
      h1 {
          color: #ff3e00;
          text-transform: uppercase;
          font-size: 4em;
          font-weight: 100;
      }

      .dialog-overlay {
        /* background-color:#92dcdc; */
        /* border-radius: 30px; */
        

      }

      .illustration {
        position: absolute;
        width: 90%;
        height: auto;
        left: 5%;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.009;
        z-index: 1;
        pointer-events: none;
      }

      .loading, .error {
        font-size: 1.2rem;
        color: #333;
        text-align: center;
      }

      .error {
        color: #ff3e00;
      }

      .center-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        width: 100%;
        position: fixed;
        top: 0;
        left: 0;
        z-index: 9999;
        background-color: rgba(0, 0, 0, 0.5);
    }

    .loading-overlay {
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        /* top: 40px; */
        /* left: calc(50% - 40px); */
    box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        position: fixed;
        right: calc(50% - 40px);
        top: calc(50% - 40px);
        color: #363f3f;

        /* bottom: 0; */


    }

    .spinner {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 60px;
        height: 60px;
        color: rgb(71, 69, 69);
        border: 20px dashed #363f3f;
        border-radius: 50%;
        position: relative;
        /* background-color: yellow; */
        animation: nonlinearSpin 4.2s infinite;
        animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);



    }

    .bot-icon {
        width: 100%;
        height: 100%;
    }

    @keyframes nonlinearSpin {
        0% {
            transform: rotate(0deg);
        }
        25% {
            transform: rotate(1080deg);
        }
        50% {
            transform: rotate(0deg);
        }
        75% {
            transform: rotate(1080deg);
        }
        100% {
            transform: rotate(2160deg);
        }
    }
  
      @media (min-width: 640px) {
          main {
              max-width: none;
          }
      }
  </style>