<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import horizon100 from '$lib/images/horizon100.svg';
	import ArrowIndicator from '$lib/components/ArrowIndicator.svelte';
	import { navigate } from 'svelte-routing';
  
	let user: { provider: string; token: string } | null = null;
	let showArrow = true;
  
	onMount(() => {
	  // Code that should run on component mount
	});
  
	function signOut() {
	  user = null;
	  if (browser && window.google) window.google.accounts.id.disableAutoSelect();
	  // Add sign-out logic for Microsoft and Apple if needed
	}
  
	function hideArrow() {
	  showArrow = false;
	}
  
	// Function to navigate to the Assistant page
	function goToAssistant() {
	  navigate('/assistant');
	}
  </script>
  
  <section on:click={hideArrow}>
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
  
	<p>This is testing environment for horizon100 multi-ai-agent interactions on various discrete applications. Collaboration options are included to share projects.</p>
  
	<!-- Button to navigate to the Assistant page -->
	<button on:click={goToAssistant}>Go to Assistant</button>
  </section>
  
  {#if showArrow}
	<ArrowIndicator on:click={hideArrow} />
  {/if}
  
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
	  0% {
		transform: scale(1);
	  }
	  50% {
		transform: scale(1.05);
	  }
	  100% {
		transform: scale(1);
	  }
	}
  
	@keyframes rotate360 {
	  from {
		transform: rotate(0deg);
	  }
	  to {
		transform: rotate(360deg);
	  }
	}
  
	@keyframes glowBrighter {
	  to {
		filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.9));
	  }
	}
  </style>