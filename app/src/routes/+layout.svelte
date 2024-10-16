<script lang="ts">
    import { onMount } from 'svelte';
    import { fly, fade, slide } from 'svelte/transition';
    import { currentUser } from '$lib/pocketbase';
    import horizon100 from '$lib/assets/horizon100.svg';
    import Auth from '../lib/components/auth/Auth.svelte';
    import Profile from '$lib/components/ui/Profile.svelte';
    import { Brain, Menu, LogIn, User, LogOut, MessageCircle, Drill, NotebookTabs, X, Code } from 'lucide-svelte';
    import { navigating } from '$app/stores';
    import { isNavigating } from '$lib/stores/navigationStore';
    import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
    import TimeTracker from '$lib/components/features/TimeTracker.svelte';
    import { pb } from '$lib/pocketbase';
    import { Camera } from 'lucide-svelte';
    import { goto } from '$app/navigation';

    let isMenuOpen = true;
    let showAuth = false;
    let showProfile = false;
    let innerWidth: number;
    let activeLink = '/';

    $: isNarrowScreen = innerWidth <= 1000;

    onMount(() => {
        const unsubscribe = navigating.subscribe((navigationData) => {
            if (navigationData) {
                isNavigating.set(true);
            } else {
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

    function toggleAuthOrProfile() {
        if ($currentUser) {
            showProfile = !showProfile;
            showAuth = false;
        } else {
            showAuth = !showAuth;
            showProfile = false;
        }
    }

    function handleAuthSuccess() {
        showAuth = false;
    }

    function handleLogout() {
        showProfile = false;
        showAuth = false;
        goto('/');
    }

	function setActiveLink(path: string) {
		goto(path);
		activeLink = path;
	}

	function handleLogoClick(event: MouseEvent) {
        event.preventDefault();
        setActiveLink('/');
    }

    function handleOverlayClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            showAuth = false;
            showProfile = false;
        }
    }

    function scrollToSection(id: string) {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    }

	
</script>

<svelte:window bind:innerWidth />

<div class="app-container">
    <header>
        <nav>
            <div class="logo-container" on:click={handleLogoClick}>
                <a href="/" class="logo-link">
                    <img src={horizon100} alt="Horizon100" class="logo" />
                    <h2>vRAZUM</h2>
                </a>
            </div>
            {#if isNarrowScreen}
                <button class="menu-button" on:click={toggleAuthOrProfile}>
                    {#if $currentUser}
                        <User size={24} />
                    {:else}
                        <LogIn size={24} />
                    {/if}
                </button>
            {:else}
			<div class="nav-links" transition:fly={{ y: -200, duration: 300 }}>
				{#if $currentUser}
				  <TimeTracker />
				  <a
					href="/ask"
					class="nav-link"
					class:active={activeLink === '/ask'}
					on:click|preventDefault={() => setActiveLink('/ask')}
				  >
					<MessageCircle size={20} />
					Ask
				  </a>
				  <a
					href="/launcher"
					class="nav-link"
					class:active={activeLink === '/launcher'}
					on:click|preventDefault={() => setActiveLink('/launcher')}
				  >
					<Drill size={20} />
					Build
				  </a>
				  <a
					href="/notes"
					class="nav-link"
					class:active={activeLink === '/notes'}
					on:click|preventDefault={() => setActiveLink('/notes')}
				  >
					<NotebookTabs size={20} />
					Notes
				  </a>
				{:else}
					<a href="#features" class="nav-link" on:click|preventDefault={() => scrollToSection('features')}>
						Features
					</a>
					<a href="#pricing" class="nav-link" on:click|preventDefault={() => scrollToSection('pricing')}>
						Pricing
					</a>
					<a href="#blog" class="nav-link" on:click|preventDefault={() => scrollToSection('blog')}>
						Blog
					</a>
					<a href="#blog" class="nav-link" on:click|preventDefault={() => scrollToSection('blog')}>
						Help
					</a>
				{/if}
			</div>
                <button class="menu-button" on:click={toggleAuthOrProfile} transition:fly={{ y: -200, duration: 300}}>
                    {#if $currentUser}
                        <div class="profile-button" transition:fly={{ y: -200, duration: 300}}>
                            <span class="user-name">{$currentUser.name || $currentUser.email}</span>
                            <div class="avatar-container">
                                {#if $currentUser.avatar}
                                    <img src={pb.getFileUrl($currentUser, $currentUser.avatar)} alt="User avatar" class="avatar" />
                                {:else}
                                    <div class="avatar-placeholder">
                                        <Camera size={24} />
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {:else}
                        <LogIn size={24} />
                    {/if}
                </button>
            {/if}
        </nav>
    </header>

    {#if showAuth}
        <div class="auth-overlay" on:click={handleOverlayClick}                                  
			in:fly="{{ y: -50, duration: 250, delay: 200 }}" out:fly="{{ y: -50, duration: 500, delay: 400 }}"
		>
            <div class="auth-content">
                <button 
					on:click={() => showAuth = false}
					class="close-button" 
					in:fly="{{ y: 50, duration: 500, delay: 400 }}" out:fly="{{ y: 50, duration: 500, delay: 400 }}"

				>
                    <X size={24} />
                </button>
                <Auth on:success={handleAuthSuccess} on:logout={handleLogout} 
				/>
            </div>
        </div>
    {/if}

    {#if showProfile}
        <div class="profile-overlay" on:click={handleOverlayClick}  transition:fly={{ y: -200, duration: 300}} >
            <div class="profile-content" transition:fly={{ y: -20, duration: 300}} >
                <button class="close-button" transition:fly={{ y: -200, duration: 300}}  on:click={() => showProfile = false}>
                    <X size={24} />
                </button>
                <Profile user={$currentUser} onClose={() => showProfile = false} on:logout={handleLogout} />
            </div>
        </div>
    {/if}


	<!-- {#if showGamePlay}
		<div class="gameplay-overlay" transition:fade={{duration: 300}} on:click|self={toggleGamePlay}>
		<div class="gameplay-content" transition:fly={{y: 50, duration: 300}}>
			<GamePlay />
			<button class="close-button" on:click={toggleGamePlay}>Close</button>
		</div>
		</div>
	{/if} -->

	{#if isNarrowScreen && isMenuOpen}
	<div class="mobile-menu" transition:fly={{ y: 200, duration: 300 }}>
		<div class="mobile-btns">
			{#if $currentUser}
				<a href="/ask" class="nav-link">
					<MessageCircle size={24} />
					Ask
				</a>
				<a href="/launcher" class="nav-link">
					<Drill size={24} />
					Build
				</a>
				<a href="/notes" class="nav-link">
					<NotebookTabs size={24} />
					Notes
				</a>
				{:else}
					<a href="#features" class="nav-link" on:click|preventDefault={() => scrollToSection('features')}>
						Features
					</a>
					<a href="#pricing" class="nav-link" on:click|preventDefault={() => scrollToSection('pricing')}>
						Pricing
					</a>
				{/if}
		</div>
	</div>
{/if}
	{#if $isNavigating}
	<LoadingSpinner />
{/if}

	<main>
		<slot />
	</main>

	<footer>
		<!-- Footer content -->
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
	  /* width: 100vw;; */
	  
	  
	}
    .auth-content {
        position: fixed;
		top: 0;
        /* background-color: #2b2a2a; */
        /* padding: 2rem; */
        width: 100%;
        /* max-width: 500px; */
        height: auto;
        overflow-y: auto;
    }
	.profile-content {
        position: absolute;
		top: 0;
		width: 94%;
        /* background-color: #2b2a2a; */
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
        backdrop-filter: blur(40px);         
		
        padding: 2rem;
        border-radius: 20px;
        /* width: 90%; */
        /* max-width: 500px; */
        /* max-height: 90vh; */
        overflow: none;
    }
	header {
	  display: flex;
	  flex-direction: row;
	  position: fixed;
	  top: 0;
	  left: 0;
	  width: 100%;
	  /* height: 80px; */
	  /* margin-top: 0; */
	  /* align-items: center; */
	  height: 60px;
	  /* padding: 5px 5px; */
		background: linear-gradient(to bottom, #2b2a2a, #353f3f);

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
	  display: flex;
	  flex-direction: row;
	  /* position: absolute; */
	  /* margin-left: 10%; */
	  /* border: 1px solid #000000; */
	  /* background-color: #2a3130; */
	  /* box-shadow: #000000 5px 5px 5px 1px; */
	  text-decoration: none;
	  transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
	  justify-content: center;
	  align-items: center;
	  height: auto;
	  user-select: none;
		gap: 8px;
		padding: 5px 10px;
        color: white;
        text-decoration: none;
        font-size: 16px;

	}
  
	.header-logo:hover {
        background-color: rgba(255, 255, 255, 0.1);
		transform: translateY(-2px);	
	}

	.logo-container {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		height: 60px;
		user-select: none;
	}
  
	.logo {
	  width: 30px;
	  height: 30px;
	  margin-right: 10px;
	}

	.logo-link {
        display: flex;
        flex-direction: row;
        align-items: center;
        text-decoration: none;
        color: inherit;
    }
  
	.h1 {
	  color: white;
	  font-size: 20px;
	  line-height: 1.5;
	}
  
	nav {
	  display: flex;
	  flex-direction: row;
	  justify-content: space-between;
	  align-items: center;
		width: 96%;
        margin-left: 2%;
        margin-right: 2%;	  
		/* padding: 5px 10px; */
	  /* background-color: #2b2a2a; */
	  /* border-radius: 20px; */
	  /* background-color: black; */
		/* height: 80px; */
	  gap: 1rem;
	  padding: 0 10px;
	  border-bottom-left-radius: 20px; 
	  border-bottom-right-radius: 20px;
	  border-top-left-radius: 20px;
	  border-top-right-radius: 20px;
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
		border-radius: 20px;

	}

	  
	nav a:hover {
	  opacity: 0.8;
	  /* background-color: rgba(255, 255, 255, 0.1); */
	  transform: scale(1.1);	
	}

	  
	 a {
		justify-content: center;
		align-items: center;
		/* padding: 20px; */

		text-decoration: none;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

	}
  


	.nav-links {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: center;
		/* padding: 10px; */
		width: 100%;

	}

	.nav-link {
		display: flex;
		gap: 8px;
		font-family: 'Courier New', Courier, monospace;
		font-weight: 400;
		justify-content: center;
		align-items: center;
		/* background-color: red; */
		border-radius: 10px;
		padding: 5px 10px;
		color: rgb(255, 255, 255);
        text-decoration: none;
        font-size: 20px;
        /* padding: 5px 10px; */
        /* border-radius: 20px; */
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		/* border-left: 1px solid rgb(130, 130, 130); */
		user-select: none;
    }

	.nav-link:hover {
        background-color: rgba(255, 255, 255, 0.1);
		transform: translateY(-2px);
        color: #6fdfc4;

    }

	.nav-link.active {
    background-color: #365040;
    font-weight: bold;
    color: #6fdfc4;
    transform: translateY(-2px);
  }
  
	.svg-container {
		display: flex;
		flex-direction: row;
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
		flex-direction: row;
		/* width: 200px; */
		/* min-width: 200px; */
        align-items: center;
		justify-content: center;
		/* padding: 10px; */
		background-color: transparent;
		border: none;
		/* position: absolute; */
		/* right: 2rem; */
		transition: all ease-in 0.2s;
		/* margin-right: 0; */
        gap: 10px;
		/* padding: 0 20px; */
        /* border: 20px; */
		/* background-color: red; */
        cursor: pointer;
        /* font-size: 20px; */
		
    }

	.profile-button {
		display: flex;
		flex-direction: row;
		justify-content: center;
        align-items: center;
		right: 2rem;
		gap: 20px;
		padding: 0 20px;

	}

	button.menu-button {
		/* display: flex; */
		/* flex-direction: row; */
	}

    .user-name {
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

 

	.mobile-menu {
		display: flex;

		align-items: center;
		position: fixed;
		bottom: 0;
		left:0;
		width: 100%;
		height: 80px;
		/* bottom: calc(100% - 280px); */
		/* width: calc(100% - 60px); */
		/* padding: 20px; */
		z-index: 99;
		/* border: 1px solid #000000; */
		/* background: linear-gradient(to top, #3f4b4b, #333333); */
		/* background-color: #2b2a2a; */
		background: linear-gradient(to top, #2b2a2a, #353f3f);

		/* border-radius: 20px; */
		/* background-color: black; */
		/* height: 80px; */
		border-bottom-left-radius: 0; 
		border-bottom-right-radius: 0;
		border-top-left-radius: 20px;
		border-top-right-radius: 20px;
	}

	.mobile-btns {
		display: flex;
		flex-direction: row;
		justify-content: space-between;	
		align-items: center;
		width: 90%;
		margin-left: 5%;
		padding: 20px;

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
	
	h2 {
        font-size: 1.5rem;
        color: #fff;
    }
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
	  background-color: rgb(62, 137, 194);
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
	.profile-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.2);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1002;
		
    }


	.auth-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        /* background-color: rgba(0, 0, 0, 0.5); */
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


    .avatar-container {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        overflow: hidden;
        margin-right: 10px;
    }

    .avatar {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #444;
        color: #fff;
    }

    .close-button {
        position: fixed;
        top: 10px;
        left: 10px;
        width: 30px;
        height: 30px;
        border: none;
        color: white;
        cursor: pointer;
        background: none;
        display: flex;
		justify-content: center;
		text-align: center;
		font-size: 1rem;
		border-radius: 8px;
		padding: 5px;
        transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);

    }

    .close-button:hover {
	  opacity: 0.8;
	  background-color: rgb(62, 137, 194);
    }

	.no-user-message {
        text-align: center;
        padding: 2rem;
    }
	@media (max-width: 1000px) {


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
			position: absolute;
			right: 2rem;
		}

		main {
			flex-grow: 1;
			padding-top: 1rem;
		}

		nav {
			justify-content: center;
		}

		footer {
			color: white;
			text-align: center;
			width: 100%;
			padding: 1rem 0;
		}
	}



  </style>