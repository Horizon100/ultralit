<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import { MessageSquare, X, PanelLeftClose, PanelLeftOpen, Drill, NotebookTabs, 
           Sun, Moon, Languages, Camera, Plus, LogIn, LogOut, User, Sunrise, Sunset, Focus, Bold, Gauge, Component, 
           Bone} from 'lucide-svelte';
  import { currentUser, pb } from '$lib/pocketbase';
  import { currentTheme } from '$lib/stores/themeStore';
  import { currentLanguage, setLanguage, languages } from '$lib/stores/languageStore';
  import ModelSelector from '$lib/components/ai/ModelSelector.svelte';
  import PromptSelector from '$lib/components/ai/PromptSelector.svelte';
  import { threadsStore } from '$lib/stores/threadsStore';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { fly, fade, slide } from 'svelte/transition';
  import { t } from '$lib/stores/translationStore';
  import { tick } from 'svelte';
  import Profile from '$lib/components/ui/Profile.svelte';
  import Auth from '$lib/components/auth/Auth.svelte';
  import StyleSwitcher from '$lib/components/ui/StyleSwitcher.svelte';
  import type { SlideParams } from 'svelte/transition';


  let showLanguageNotification = false;
  let selectedLanguageName = '';
  let isStylesOpen = false;
  let showThreadList: boolean;
  let placeholderText = '';


  let innerWidth: number;

  let showAuth = false;
  let showProfile = false;
  let showStyles = false;
  let currentStyle = 'default';

  function getRandomQuote() {
    const quotes = $t('extras.quotes');
    return quotes[Math.floor(Math.random() * quotes.length)];
  }
  



  $: placeholderText = getRandomQuote();
  $: showThreadList = $threadsStore.showThreadList;
  $: currentPath = $page.url.pathname;
  $: showBottomButtons = currentPath === '/';
  $: isNarrowScreen = innerWidth <= 768;


  const dispatch = createEventDispatcher<{
    promptSelect: any;
    promptAuxclick: any;
    threadListToggle: void;
  }>();

  const styles = [
    { name: 'Daylight Delight', value: 'default', icon: Sun },
    { name: 'Midnight Madness', value: 'dark', icon: Moon },
    { name: 'Sunrise Surprise', value: 'light', icon: Sunrise },
    { name: 'Sunset Serenade', value: 'sunset', icon: Sunset },
    { name: 'Laser Focus', value: 'focus', icon: Focus },
    { name: 'Bold & Beautiful', value: 'bold', icon: Bold },
    { name: 'Turbo Mode', value: 'turbo', icon: Gauge },
    { name: 'Bone Tone', value: 'bone', icon: Bone },
    { name: 'Ivory Tower', value: 'ivory', icon: Component }

  ];

  // Handle style changes
  function handleStyleClick() {
    showStyles = !showStyles;
  }

  async function handleLanguageChange() {
    showLanguageNotification = true;

    const currentLang = $currentLanguage;
    const currentIndex = languages.findIndex(lang => lang.code === currentLang);
    const nextIndex = (currentIndex + 1) % languages.length;
    const nextLanguage = languages[nextIndex];

    await setLanguage(nextLanguage.code);
    selectedLanguageName = nextLanguage.name;
    
    await tick();
    
    setTimeout(() => {
      showLanguageNotification = true;
    }, 0);
    setTimeout(() => {
      showLanguageNotification = false;
    }, 600);
  }

  $: showThreadList = $threadsStore.showThreadList; 


  export function toggleThreadList() {
    threadsStore.toggleThreadList();
}
  function toggleStyles() {
    showStyles = !showStyles;
  }

  function handleStyleClose() {
    showStyles = false;
  }

  async function handleStyleChange(event: CustomEvent) {
    const { style } = event.detail;
    await currentTheme.set(style);
    showStyles = false;
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

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      showAuth = false;
      showProfile = false;
      showStyles = false;
    }
  }

  function navigateTo(path: string) {
    goto(path);
  }

  function handlePromptSelect(event: CustomEvent) {
    dispatch('promptSelect', event.detail);
  }
</script>

<div class="sidenav" transition:slide={{ duration: 300 }}>
    <!-- Authentication/Profile Button -->
    <div class="navigation-buttons" class:hidden={isNarrowScreen} in:fly="{{ x: -200, duration: 300}}" out:fly="{{ x:  200, duration: 300}}">
      {#if $currentUser}

      <button class="nav-button" on:click={toggleAuthOrProfile}>
        
        <div class="profile-button" in:fly="{{ x: -200, duration: 300}}" out:fly="{{ x:  200, duration: 300}}">
          <div class="avatar-container">
              {#if $currentUser.avatar}
                <img src={pb.getFileUrl($currentUser, $currentUser.avatar)} alt="User avatar" class="avatar" />
              {:else}
                <Camera size={24} />
              {/if}
            </div>
          </div>
          

      </button>
      <button 
        class="nav-button" 
        class:active={currentPath === '/'} 
        on:click={() => navigateTo('/')}
      >
        <MessageSquare />
      </button>
      <!-- <button 
        class="nav-button" 
        class:active={currentPath === '/launcher'}
        on:click={() => navigateTo('/launcher')}
      >
        <Drill />
      </button> -->
      <button 
        class="nav-button" 
        class:active={currentPath === '/notes'}
        on:click={() => navigateTo('/notes')}
      >
        <NotebookTabs/>
      </button>
      {:else}
      <LogIn />
    {/if}
    </div>


    <!-- Navigation Buttons -->
     


  <div class="middle-buttons">
    
  </div>

  
  
  <div class="bottom-buttons">
    {#if showBottomButtons}


      <!-- Language Toggle -->
      <!-- <button class="nav-button" on:click={handleLanguageChange}> -->
        <!-- <Languages size={24} /> -->
        <!-- <span class="language-code">{$currentLanguage.toUpperCase()}</span> -->
        <!-- <span>{$t('lang.flag')}</span> -->

      <!-- </button> -->
  
      <!-- Theme Toggle -->
      <!-- <button class="nav-button" on:click={toggleStyles} transition:fly={{ y: -200, duration: 300}}>
        <svelte:component this={styles.find(s => s.value === currentStyle)?.icon || Sun} size={24} />
    </button> -->
      <!-- <ModelSelector /> -->
      <!-- <PromptSelector on:select={handlePromptSelect} /> -->
      <button 
        class="nav-button toggle" 
        on:click={toggleThreadList}
      >
        {#if showThreadList}
          <PanelLeftClose size={24} />
        {:else}
          <PanelLeftOpen size={24} />
        {/if}
    </button>
{/if}
  </div>
</div>

{#if showLanguageNotification}
  <div class="language-notification" transition:fade={{ duration: 300 }}>
    {$t('lang.notification')}
  </div>
{/if}

{#if showAuth}
  <div class="auth-overlay" on:click={handleOverlayClick}                                  
        transition:fly={{ y: -20, duration: 300}}
      >
      <div class="auth-content" transition:fly={{ y: -20, duration: 300}} >
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
      <div class="profile-overlay" on:click={handleOverlayClick} transition:fly={{ y: -200, duration: 300 }}>
        <div class="profile-content" transition:fly={{ y: -20, duration: 300 }}>
          <button class="close-button" transition:fly={{ y: -200, duration: 300 }} on:click={() => showProfile = false}>
            <X size={24} />
          </button>
          <Profile 
            user={$currentUser} 
            onClose={() => showProfile = false}
            onStyleClick={handleStyleClick}
          />
        </div>
      </div>

    {/if}
    {#if showLanguageNotification}
    <div class="language-overlay" transition:fade={{ duration: 300 }}>
        <div class="language-notification" transition:fade={{ duration: 300 }}>
            {$t('lang.notification')}
            <div class="quote">
                {placeholderText}
            </div>
        </div>
    </div>
{/if}

{#if showStyles}
<div class="style-overlay" on:click={handleOverlayClick} transition:fly={{ x: -200, duration: 300}}>
    <!-- <button class="close-button" transition:fly={{ x: -200, duration: 300}} on:click={() => showStyles = false}>
        <X size={24} />
    </button> -->
    <div class="style-content"  on:click={handleOverlayClick} transition:fly={{ x: -20, duration: 300}}>

        <StyleSwitcher 
            on:close={handleStyleClose}
            on:styleChange={handleStyleChange} 
        />
        </div>
    </div>
{/if}

<svelte:window bind:innerWidth />


<style lang="scss">
	@use "src/styles/themes.scss" as *;
	* {
	//   font-family: 'Source Code Pro', monospace;
	font-family: var(--font-family);
	transition: all 0.3s ease;

	}
  .sidenav {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 10px;
    position: fixed;
    left: 0;
    top: 0;
    height: 3rem;
    bottom: 0;
    width: auto;
    align-items: left;
    z-index: 10;
    border-radius: 1rem;
    transition: all 0.3s ease-in;
  }

  // .sidenav:hover {
  //   /* backdrop-filter: blur(10px); */
  // }

  .navigation-buttons {
    display: flex;
    flex-direction: row;
    justify-content: left;
    width: 100%;
    margin-left: 1rem;
    gap: 2rem;
  }

  .navigation-buttons.hidden {
    display: none;
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



    .auth-container {
		background-color: #fff;
		padding: 2rem;
		border-radius: 10px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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
  .profile-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
		flex-grow: 1;
		/* box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);  */
    backdrop-filter: blur(10px);
    justify-content: center;
        align-items: center;
        z-index: 1002;
		transition: all 0.3s ease;
    }

	.profile-content {
    position: absolute;
		width: auto;
    height: auto;
		top: 0;
    bottom: auto;
    /* right: 0; */
    /* background-color: #2b2a2a; */
		/* box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);  */
    backdrop-filter: blur(40px);   
		border-bottom: 1px solid var(--secondary-color);
    background: var(--bg-gradient-r);
    border-bottom-left-radius: var(--radius-m);
    border-bottom-right-radius: var(--radius-m);
    width: 100%;
    /* max-width: 500px; */
    /* max-height: 90vh; */
    overflow: none;
		transition: all 0.3s ease;

    }


    .profile-button {
		display: flex;
		flex-direction: row;


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

    

    .style-switcher-container {
        display: flex;
        align-items: center;
        margin-right: 16px;
        z-index: 1001;
    }

    .style-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1002;
    }


    .style-content {
        background-color: #b11f1feb;
        padding: 1rem;
		border: 1px solid rgb(69, 69, 69);
        border-radius: 20px;
        position: relative;
        max-width: 90%;
        max-height: 90%;
        overflow: auto;
    }

    .nav-button.toggle {
      position: fixed;
      bottom: 0rem;
      left: 0.5rem;
      z-index: 5000;
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
      background: var(--secondary-color) !important;
      display: flex;
      justify-content: center;
      text-align: center;
      font-size: 1rem;
      border-radius: 8px;
      transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);

    }

    .close-button:hover {
	  opacity: 0.8;
	  background-color: rgb(62, 137, 194);
    }
    

  .avatar-container {

        overflow: hidden;
    }

    .avatar {
        border-radius: 50%;
        width: 90%;
        height: 90%;
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

  .top-buttons {
    display: flex;
    flex-direction: row;
    position: relative;
  }

  .bottom-buttons {
    display: flex;
    flex-direction: row;
    gap: 10px;
    margin-bottom: 1rem;
  }

  .nav-button,
  .thread-toggle,
  .close-button,
  .avatar-container {
    color: var(--text-color);
    background: var(--bg-gradient-right);
    padding: 4px;
    font-size: auto;
    border: none;
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0.25rem;
    transition: all 0.2s ease-in-out;
    overflow: hidden;
    user-select: none;
  }

  .nav-button.active {
    background: var(--tertiary-color);
    box-shadow: 0 0 10px rgba(74, 158, 255, 0.3);
  }

  .thread-list-visible .thread-toggle {
    left: 310px;
  }
  

  .nav-button:hover,
  .thread-toggle:hover {
    box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
    transform: scale(1.2);
  }

  :global(.sidenav .nav-button svg),
  :global(.sidenav .thread-toggle svg) {
    transition: transform 0.1s ease;
  }

  :global(.sidenav .nav-button:hover svg),
  :global(.sidenav .thread-toggle:hover svg) {
    transform: scale(1.1);
  }

  .language-overlay {
		position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1); 
        backdrop-filter: blur(40px);         
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1002;
	}

	.language-notification {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    /* background-color: var(--primary-color); */
    color: var(--text-color);
    padding: 20px;
    border-radius: var(--radius-m);
    z-index: 1000;
		/* border: 1px solid var(--tertiary-color); */
		display: flex;
		flex-direction: column;
		text-justify: center;
		justify-content: center;
		align-items: center;
		gap: 2rem;
		font-size: 2rem;
    }

    .language-notification p {
        margin: 0;
    }

	.quote {
		font-size: 16px;
		font-style: italic;
		line-height: 1.5;
	}




  @media (max-width: 768px) {
  .sidenav {
    display: flex;
    justify-content: left;
    flex-direction: column;
      height: auto;
      width: 0;
      bottom: 5rem;
      padding: 0.5rem;
      /* backdrop-filter: blur(10px); */
    }

    .navigation-buttons {
      flex-direction: column;
    }
    

    .bottom-buttons {
      flex-direction: column;
      margin: 0;
      gap: 8px;
    }

  .top-buttons {
      flex-direction: row;
      margin: 0;
      gap: 8px;
    }

    .nav-button,
    .thread-toggle,
    .avatar-container {
      width: 40px;
      height: 40px;
      padding: 0.3rem;
      border-radius: 50% !important;
      
    }

    .nav-button:hover,
    .thread-toggle:hover {
      transform: scale(1.1);
    }

    .nav-button.toggle {
      position: fixed;
      bottom: 0.5rem;
      left: 1.5rem;
      height: 60px;
      width: 60px;
      z-index: 5000;
      
    }

    .profile-content {
      position: absolute;
      width: auto;
      height: 83%;
      top: 3rem;
      /* background-color: #2b2a2a; */
      /* box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);  */
      backdrop-filter: blur(40px);  
      border-bottom-left-radius: var(--radius-xl); 
      border-bottom-right-radius: var(--radius-xl); 
      /* width: 90%; */
      /* max-width: 500px; */
      /* max-height: 90vh; */
      overflow: none;
      transition: all 0.3s ease;
    }

}

@media (max-width: 450px) {


    .navigation-buttons {
      flex-direction: column;
    }
    

    .bottom-buttons {
      flex-direction: column;
      margin: 0;
      gap: 8px;
    }

  .top-buttons {
      flex-direction: row;
      margin: 0;
      gap: 8px;
    }

    .nav-button,
    .thread-toggle,
    .avatar-container {
      width: 40px;
      height: 40px;
      padding: 0.3rem;

    }

    .nav-button:hover,
    .thread-toggle:hover {
      transform: scale(1.1);
    }

    .profile-content {
      position: absolute;
      width: auto;
      height: 83%;
      top: 3rem;
      /* background-color: #2b2a2a; */
      box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1); 
      backdrop-filter: blur(40px);  
      border-bottom-left-radius: var(--radius-xl); 
      border-bottom-right-radius: var(--radius-xl); 
      /* width: 90%; */
      /* max-width: 500px; */
      /* max-height: 90vh; */
      overflow: none;
      transition: all 0.3s ease;
    }

}

</style>

