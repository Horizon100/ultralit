<script lang="ts">
    import { fly, fade } from 'svelte/transition';
    import { currentUser } from '$lib/pocketbase';
    import horizon100 from '$lib/assets/horizon100.svg';
    import Auth from '../lib/components/auth/Auth.svelte';
    import { Brain, Menu, LogIn, User, LogOut } from 'lucide-svelte';
    import { navigating } from '$app/stores';
    import { isNavigating } from '$lib/stores/navigationStore';
    import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
    import { onMount } from 'svelte';

    let isMenuOpen = false;
    let showAuth = false;
    let innerWidth: number;

    $: isNarrowScreen = innerWidth <= 700;

    onMount(() => {
        const unsubscribe = navigating.subscribe((navigationData) => {
            if (navigationData) {
                isNavigating.set(true);
            } else {
                // Add a small delay before hiding the spinner to ensure content is ready
                setTimeout(() => {
                    isNavigating.set(false);
                }, 300);
            }
        });

        return () => {
            unsubscribe();
        };
    });

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
    }

    function toggleAuth() {
        showAuth = !showAuth;
    }

    function handleAuthSuccess() {
        showAuth = false;
    }

    function handleLogout() {
        // Any additional logout logic can go here
        showAuth = false;
    }
</script>

<svelte:window bind:innerWidth />

<div class="app-container">
    <header>
        <nav>
            <a href="/" class="header-logo">
                <img src={horizon100} alt="Horizon100" class="logo" />
                <h1 class="h1">vRAZUM</h1>
            </a>
            {#if isNarrowScreen}
                <button class="menu-button" on:click={toggleMenu}>
                    <Menu size={24} />
                </button>
            {:else}
                <div class="nav-links">
                    <!-- <a href="/launcher" class="svg-container">
                        <Brain size={24} />
                    </a> -->
                    <button class="menu-button" on:click={toggleAuth}>
                        {#if $currentUser}
                            <User size={24} />
                            <span class="user-name">{$currentUser.name || $currentUser.email}</span>
                        {:else}
                            <LogIn size={24} />
                        {/if}
                    </button>
                </div>
            {/if}
        </nav>
    </header>

    {#if showAuth}
        <div class="auth-overlay" on:click|self={toggleAuth}>
            <Auth on:success={handleAuthSuccess} on:logout={handleLogout} />
        </div>
    {/if}

    {#if isNarrowScreen && isMenuOpen}
        <div class="mobile-menu" transition:fly={{ y: -200, duration: 300 }}>
            <a href="/canvas" class="svg-container">SVG</a>
            <a href="/launcher" class="svg-container">Launcher</a>
            <a href="/html-canvas" class="svg-container">html</a>
            <button class="menu-button" on:click={toggleAuth}>
                {#if $currentUser}
                    <User size={24} />
                    <span class="user-name">{$currentUser.name || $currentUser.email}</span>
                {:else}
                    <LogIn size={24} />
                    <span>Login</span>
                {/if}
            </button>
        </div>
    {/if}

	{#if $isNavigating}
		<LoadingSpinner />
	{/if}

    <main>
        <slot />
    </main>
	<footer>
	  <!-- <p>&copy; 2024 vRAZUM. All rights reserved.</p> -->
	</footer>
  </div>
  
  <style>
	@import url('https://fonts.googleapis.com/css2?family=Source+Code+Pro&display=swap');
  
	* {
	  font-family: 'Source Code Pro', monospace;
	  
	}

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
	.app-container {
	  display: flex;
	  flex-direction: column;
	  /* justify-content: center; */
	  /* align-items: center; */
	  overflow: hidden;
	  /* height: 100vh; */
	  /* width: 100vw; */;
	  
	  
	}
  
	header {
	  display: flex;
	  flex-direction: row;
	  justify-content: right;
	  height: 40px;
	  /* align-items: center; */
	  /* width: 100%; */
	  /* height: 60px; */
	  /* padding: 5px 5px; */
	  border-bottom-left-radius: 0px; 
	  border-bottom-right-radius: 0px;
	  border-top-left-radius: 8px;
	  border-top-right-radius: 8px;
	  z-index: 100;;
	  /* box-shadow: 0 0 10px rgba(0, 0, 0, 0.2); */
	  /* background: linear-gradient(to bottom, #3f4b4b, #333333); */

      /* background: linear-gradient(
        to bottom, 
        rgba(117, 118, 114, 0.9) 0%,
        rgba(117, 118, 114, 0.85) 5%,
        rgba(117, 118, 114, 0.8) 10%,
        rgba(117, 118, 114, 0.75) 15%,
        rgba(117, 118, 114, 0.7) 20%,
        rgba(117, 118, 114, 0.65) 25%,
        rgba(117, 118, 114, 0.6) 30%,
        rgba(117, 118, 114, 0.55) 35%,
        rgba(117, 118, 114, 0.5) 40%,
        rgba(117, 118, 114, 0.45) 45%,
        rgba(117, 118, 114, 0.4) 50%,
        rgba(117, 118, 114, 0.35) 55%,
        rgba(117, 118, 114, 0.3) 60%,
        rgba(117, 118, 114, 0.25) 65%,
        rgba(117, 118, 114, 0.2) 70%,
        rgba(117, 118, 114, 0.15) 75%,
        rgba(117, 118, 114, 0.1) 80%,
        rgba(117, 118, 114, 0.05) 85%,
        rgba(117, 118, 114, 0) 100%
        
      ); */
      /* backdrop-filter: blur(3px); */
	  /* padding: 1rem 0; */
	}
  
	.header-logo {
	  display: flex;
	  flex-direction: row;
	  /* position: absolute; */

	  /* margin-left: 10%; */
	  /* border: 1px solid #000000; */
	  border-radius: 16px;
		margin-top: 10px;
	  /* background-color: #2a3130; */
	  /* box-shadow: #000000 5px 5px 5px 1px; */
	  text-decoration: none;
	  transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
	  justify-content: center;
	  align-items: center;
	  height: auto;
	  user-select: none;

	}
  
	.header-logo:hover {
	  transform: scale(1.1);
	}
  
	.logo {
	  width: 30px;
	  height: 30px;
	  margin-right: 10px;
	}
  
	.h1 {
	  color: white;
	  font-size: 20px;
	  line-height: 1.5;
	}
  
	nav {
	  display: flex;
	  flex-direction: row;
	  justify-content: center;
	  align-items: center;
	  padding: 5px;
		
	  gap: 1rem;
	  /* margin-right: 10%; */
	  align-items: center;
	  justify-content: center;
	  /* padding: 10px; */
	}
  
	nav a {
		justify-content: center;
		align-items: center;
		margin-left: 20px;
		font-weight: bold;
		font-size: 24px;
		color: black;
		text-decoration: none;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

	}

	  
	nav a:hover {
	  opacity: 0.8;
	  background-color: blue;
	}

	  
	 a {
		justify-content: center;
		align-items: center;
		margin-left: 20px;
		margin-bottom: 10px;
		font-weight: bold;
		width: 90%;
		font-size: 24px;
		color: black;
		text-decoration: none;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

	}
  


	.nav-links {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: center;
		align-items: center;
	}
  
	.svg-container {
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		color: white;
		font-size: 20px;
		border-radius: 8px;
		border: 2px solid #4b4b4b;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.3s ease;
		width: 100px;
		background-color: #352e2e;
		height: 30px;
		width: 40px;
	}

	.svg-container:hover {
		opacity: 0.8;
		background-color: black;
	}

	.menu-button {
        display: flex;
        align-items: center;
        gap: 8px;
        background: none;
        border: none;
		/* background-color: red; */
        cursor: pointer;
        font-size: 14px;
    }

    .user-name {
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

 

	.mobile-menu {
		position: absolute;
		bottom: calc(100% - 280px);
		width: calc(100% - 60px);
		left: 10px;
		right: 0;
		padding: 20px;
		z-index: 99;
		border: 1px solid #000000;
		background: linear-gradient(to top, #3f4b4b, #333333);
	}
	@media (max-width: 700px) {
		.nav-links {
			display: none;
		}
	}

	/* .auth-button {
	  background-color: rgb(4, 4, 4);
	  padding: 20px 40px;
	  border-radius: 20px;
	  color: white;
	  
	  font-size: 30px;
	  cursor: pointer;
	  transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
	  
	}
  
	.auth-button:hover {
	  opacity: 0.9;
	  transform: scale(1.05);
	} */
  
	/* main {
	  /* flex-grow: 1; */
	  /* padding: 2rem 10%; */
	  /* width: 100%; */
	  
	
	/* .svg-container { */
		/* display: flex; */
		/* justify-content: center; */
		/* text-align: center; */
		/* background: linear-gradient(to top, #3f4b4b, #333333); */
		/* color: white; */
		/* font-size: 1rem; */
		/* height: 40px; */
		/* border-radius: 8px; */
		/* border: 2px solid #222222; */
		/* padding: 5px; */
		/* cursor: pointer; */
		/* margin-left: 200px; */

	/* } */

	/* .svg-container:hover { */
	  /* opacity: 0.8; */
	  /* background-color: blue; */
	/* } */
	

	button {
		display: flex;
		justify-content: center;
		text-align: center;
		background-color: #222222;
		color: white;
		font-size: 1rem;
		border-radius: 8px;
		border: 2px solid #222222;
		padding: 5px;
		cursor: pointer;
	}

	button:hover {
	  opacity: 0.8;
	  background-color: red;
	}
  
	footer {
	  /* background-color: #1d2026; */
	  color: white;
	  text-align: center;
	  justify-content: center;
	  align-items: center;
	  /* padding: 1rem; */
	  width: 100%;
	  position: fixed;
	  bottom: 0;
	  height: 0;
	}

	/* .auth-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    } */

	.user-button {
        background-color: #3c3c3c;
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 14px;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .user-button:hover {
        background-color: #4a4a4a;
    }

	@media (max-width: 700px) {
		.nav-links {
			display: none;
		}

	main {
		flex-grow: 1;
		padding-top: 1rem;
	}

	footer {
		color: white;
		text-align: center;
		width: 100%;
		padding: 1rem 0;
	}
	}



  </style>