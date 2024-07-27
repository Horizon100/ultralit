<script lang="ts">
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import { page } from '$app/stores';
  import Login from "$lib/Login.svelte";
  import Assistant from "./routes/Assistant.svelte";

  import './app.css';

  // Define the theme store and updater function
  const theme = writable('skeleton'); // Change the default theme here
  
  function setTheme(newTheme: string) {
    theme.set(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme); // Apply theme to the root element
  }

  setContext('theme', { theme, setTheme });
</script>

<nav>
  <a href="/">Home</a>
  <a href="/assistant">Assistant</a>
</nav>

<main>
  {#if $page.url.pathname === '/'}
    <Login />
  {:else if $page.url.pathname === '/assistant'}
    <Assistant />
  {/if}
</main>

<style>
  :global(body) {
    background-color: var(--color-bg-1);
    color: var(--color-text);
    transition: background-color 0.3s, color 0.3s;
  }
</style>