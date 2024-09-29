<script lang="ts">
	import { onMount } from 'svelte';
    import { fly, fade, slide } from 'svelte/transition';
    import { currentUser } from '$lib/pocketbase';
    import horizon100 from '$lib/assets/horizon100.svg';
    import Auth from '../lib/components/auth/Auth.svelte';
    import { Brain, Menu, LogIn, User, LogOut, MessageCircle, Drill, NotebookTabs } from 'lucide-svelte';
    import { navigating } from '$app/stores';
    import { isNavigating } from '$lib/stores/navigationStore';
    import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
    import TimeTracker from '$lib/components/features/TimeTracker.svelte';
	import GamePlay from '$lib/components/features/GamePlay.svelte';


    let isMenuOpen = false;
    let showAuth = false;
    let innerWidth: number;
    let activeLink = '/'; 
	let showGamePlay = false;


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

	function setActiveLink(path: string) {
        activeLink = path;
    }

	function toggleGamePlay() {
        showGamePlay = !showGamePlay;
    }
	
</script>

<svelte:window bind:innerWidth />

<div class="app-container">
	<header>
        <nav>
            <a href="/" class="header-logo" on:click={() => setActiveLink('/')}>
                <img src={horizon100} alt="Horizon100" class="logo" />
                <h1 class="h1">vRAZUM</h1>
            </a>
            {#if isNarrowScreen}
                <button class="menu-button" transition:fly={{ y: -200, duration: 300 }} on:click={toggleMenu}>
                    <Menu size={20} />
                </button>
            {:else}
                <div class="nav-links" transition:fly={{ y: -200, duration: 300 }}>
                    <a href="/ask" class="nav-link" transition:fly={{ y: -200, duration: 300 }} class:active={activeLink === '/ask'} on:click={() => setActiveLink('/ask')}>
                        <MessageCircle size={20} />
                        Ask
                    </a>
                    <a href="/launcher" class="nav-link" transition:fly={{ y: -200, duration: 300 }}  class:active={activeLink === '/launcher'} on:click={() => setActiveLink('/launcher')}>
                        <Drill size={20} />
                        Build
                    </a>
					<a href="/notes" class="nav-link" transition:fly={{ y: -200, duration: 300 }} class:active={activeLink === '/notes'} on:click={() => setActiveLink('/notes')}>
						<NotebookTabs size={20} />

						Notes
					</a>
                    <a href="/canvas" class="nav-link" transition:fly={{ y: -200, duration: 300 }} class:active={activeLink === '/canvas'} on:click={() => setActiveLink('/canvas')}>Draw</a>
                    <a href="/html-canvas" class="nav-link" transition:fly={{ y: -200, duration: 300 }} class:active={activeLink === '/html-canvas'} on:click={() => setActiveLink('/html-canvas')}>HTML</a>
					<a href="/map" class="nav-link" transition:fly={{ y: -200, duration: 300 }} class:active={activeLink === '/map'} on:click={() => setActiveLink('/map')}>Map</a>

                   
					<button class="nav-link" on:click={toggleGamePlay}>
						<Brain size={20} />
						GamePlay
					</button>
					<button class="menu-button" on:click={toggleAuth}>
                        {#if $currentUser}
                            <User size={20} />
                            <span class="user-name">{$currentUser.name || $currentUser.email}</span>
                        {:else}
                            <LogIn size={24} />
                        {/if}
                    </button>
                </div>
            {/if}
        </nav>
    </header>
	<TimeTracker />

    {#if showAuth}
        <div class="auth-overlay" on:click|self={toggleAuth}  transition:fly={{ y: -200, duration: 300 }}>
            <Auth on:success={handleAuthSuccess} on:logout={handleLogout} />
        </div>
    {/if}

	{#if showGamePlay}
		<div class="gameplay-overlay" transition:fade={{duration: 300}} on:click|self={toggleGamePlay}>
		<div class="gameplay-content" transition:fly={{y: 50, duration: 300}}>
			<GamePlay />
			<button class="close-button" on:click={toggleGamePlay}>Close</button>
		</div>
		</div>
	{/if}

    {#if isNarrowScreen && isMenuOpen}
        <div class="mobile-menu" transition:fly={{ y: -200, duration: 300 }}>
			<a href="/ask" class="svg-container">
				<MessageCircle size={24} />
			</a>
            <a href="/launcher" class="svg-container">
				<Drill size={24} />
			</a>
            <a href="/launcher" class="svg-container">Launcher</a>
            <a href="/html-canvas" class="svg-container">html</a>



            <button class="menu-button" on:click={toggleAuth}>
                {#if $currentUser}
                    <User size={24} />
                    <!-- <span class="user-name">{$currentUser.name || $currentUser.email}</span> -->
                {:else}
                    <LogIn size={24} />
                    <!-- <span>Login</span> -->
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
	  justify-content: center;
	  align-items: center;
	  height: 40px;
	  /* align-items: center; */
	  /* width: 100%; */
	  /* height: 60px; */
	  /* padding: 5px 5px; */
	  border-bottom-left-radius: 0px; 
	  border-bottom-right-radius: 0px;
	  border-top-left-radius: 8px;
	  border-top-right-radius: 8px;
	  /* z-index: 100;; */
	  transition: all 0.3s ease;
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
	  display: none;
	  flex-direction: row;
	  /* position: absolute; */
	  /* margin-left: 10%; */
	  /* border: 1px solid #000000; */
	  border-radius: 16px;
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
	  padding: 5px 10px;
	  background-color: #151515;
	  border-radius: 20px;
	  /* background-color: black; */
		/* height: 80px; */
	  gap: 1rem;
	  /* margin-right: 10%; */
	  /* padding: 10px; */
	}
  
	nav a {
		justify-content: center;
		align-items: center;
		font-weight: bold;
		color: black;
		text-decoration: none;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		font-family: 'Merriweather', serif;

	}

	  
	nav a:hover {
	  opacity: 0.8;
	  background-color: blue;
	}

	  
	 a {
		justify-content: center;
		align-items: center;
		padding: 20px;

		text-decoration: none;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

	}
  


	.nav-links {
		display: flex;
		gap: 20px;
		align-items: center;
		justify-content: center;

	}

	.nav-link {
		display: flex;
		gap: 8px;
		justify-content: center;
		align-items: center;
		/* background-color: red; */
		border-radius: 10px;
		padding: 5px 10px;
        color: white;
        text-decoration: none;
        font-size: 16px;
        /* padding: 5px 10px; */
        /* border-radius: 20px; */
        transition: all 0.3s ease;
		/* border-left: 1px solid rgb(130, 130, 130); */
		
    }

	.nav-link:hover {
        background-color: rgba(255, 255, 255, 0.1);
		transform: translateY(-2px);

    }

	.nav-link.active {
        background-color: #365040;  /* Different color for active state */
        font-weight: bold;
		/* height: 100px; */
		/* width: 100px; */
		/* border-radius: 50%; */
		/* scale: 1.2; */

    }
  
	.svg-container {
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		color: white;
		font-size: 20px;
		border-radius: 8px;
		/* border: 2px solid #4b4b4b; */
		cursor: pointer;
		text-decoration: none;
		transition: all 0.3s ease;
		width: 100px;
		/* background-color: #352e2e; */
		height: 30px;
		width: 40px;
	}

	.svg-container:hover {
		/* opacity: 0.8; */
		background-color: #222222;
		border: none;
	}

	.menu-button {
        display: flex;
        align-items: center;
		position: absolute;
		right: 10px;
		margin-right: 0;
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
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		position: absolute;
		bottom: 20px;
		width: 100%;
		gap: 1rem;
		/* bottom: calc(100% - 280px); */
		/* width: calc(100% - 60px); */
		/* padding: 20px; */
		z-index: 99;
		/* border: 1px solid #000000; */
		background: linear-gradient(to top, #3f4b4b, #333333);
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

	.auth-overlay {
        position: absolute;
        top: 50px;
		width: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

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


		.nav-links, h1 {
			display: none;
		}

		header {
			justify-content: center;
		}

		.header-logo {
			display: flex;
		}

		.menu-button {
			position: relative;
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