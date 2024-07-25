<script lang="ts">
  import { Router, Link, Route } from 'svelte-routing';
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import Login from "./lib/Login.svelte";
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

<Login/>

<Router>
  <nav>
    <Link to="/">Home</Link>
    <Link to="/assistant">Assistant</Link>
  </nav>

  <main>
    <!-- Define the routes here -->
    <Route path="/" component={Login} />
    <Route path="/assistant" component={Assistant} />
  </main>
</Router>

<style>
  :global(body) {
    background-color: var(--color-bg-1);
    color: var(--color-text);
    transition: background-color 0.3s, color 0.3s;
  }
</style>