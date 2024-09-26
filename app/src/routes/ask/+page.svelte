<script lang="ts">
  import { onMount } from 'svelte';
  import Dialog from '$lib/components/ai/Dialog.svelte';
  import { fade, fly, blur, scale } from 'svelte/transition';
  import Auth from '$lib/components/auth/Auth.svelte';
  import { elasticOut } from 'svelte/easing';
  import greekImage from '$lib/assets/illustrations/greek.png';

  let showDialog = true;  // Changed to true to show dialog by default
  
  function openDialog() {
      showDialog = true;
  }
  
  function closeDialog() {
      showDialog = false;
  }
  
  onMount(() => {
    // Automatically open the dialog after a short delay
    setTimeout(openDialog, 500);
  });
</script>
  
  <main transition:fade={{ duration: 300 }}>
  
    {#if showDialog}
      <div class="dialog-overlay" transition:fade={{ duration: 300 }}>
        <div 
          class="dialog-container"
          in:scale={{
            duration: 700,
            delay: 300,
            opacity: 0,
            start: 0.5,
            easing: elasticOut,
          }}
          out:scale={{
            duration: 300,
            opacity: 0,
            start: 1.2
          }}
        >
          <div in:blur={{ amount: 10, duration: 500, delay: 700 }}>
            <Dialog on:close={closeDialog}>
              <div in:fly={{ y: 50, duration: 500, delay: 1000 }}>
                <h2>Dialog Content</h2>
                <p>This is the content of the dialog.</p>
              </div>
            </Dialog>
          </div>
        </div>
      </div>
    {/if}
    <img src={greekImage} alt="Greek illustration" class="illustration" />

  </main>
  
  <style>
      main {
        display: flex;
        flex-direction: column;
        position: absolute;
        width: 96%;
        right: 2%;
        bottom: 50px;
        height: 94vh;
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
          background: #000000;
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
  
      @media (min-width: 640px) {
          main {
              max-width: none;
          }
      }
  </style>