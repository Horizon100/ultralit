<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { Moon, Sun, Sunset, Sunrise, Focus, Bold, Gauge, Bone } from 'lucide-svelte';
    import { currentUser, pb } from '$lib/pocketbase';
    import { currentTheme } from '$lib/stores/themeStore';
    import { t } from '$lib/stores/translationStore';

    interface Style {
        name: string;
        value: string;
        icon: any;  // You might want to use a more specific type here
        description: string;
        dummyContent: string;

    }

    let hoveredStyle: Style | null = null;
    const dispatch = createEventDispatcher();

  
    const styles = [
      { 
        name: 'Classic', 
        value: 'default', 
        icon: Sun, 
        description: 'This style will brighten your day', 
        dummyContent: 'Sunshine and clear skies' 
      },
      { 
        name: 'Dark', 
        value: 'dark', 
        icon: Moon, 
        description: 'For night owls and stargazers', 
        dummyContent: 'Moonlit adventures await' 
      },
      { 
        name: 'Light', 
        value: 'light', 
        icon: Sunrise, 
        description: 'Start your day with a fresh look', 
        dummyContent: 'Early bird gets the worm' 
      },
      { 
        name: 'Sunset', 
        value: 'sunset', 
        icon: Sunset, 
        description: 'Wind down with warm hues', 
        dummyContent: 'Golden hour vibes' 
      },
      { 
        name: 'Focus', 
        value: 'focus', 
        icon: Focus, 
        description: 'Minimize distractions, maximize productivity', 
        dummyContent: 'Concentration intensifies' 
      },
      { 
        name: 'Bold', 
        value: 'bold', 
        icon: Bold, 
        description: 'Make a statement with vibrant colors', 
        dummyContent: 'Stand out from the crowd' 
      },
      {
        name: 'Turbo',
        value: 'turbo',
        icon: Gauge,
        description: 'Speed up your workflow',
        dummyContent: 'Faster than the speed of light'
      },
      {
        name: 'Bone',
        value: 'bone',
        icon: Gauge,
        description: 'Contrasts brights up.',
        dummyContent: 'Shake it, make it.'
      }
    ];
  
    function applyTheme(theme: string) {
    document.body.className = theme;
  }

  async function changeStyle(style: string) {
    await currentTheme.set(style);

    currentTheme.set(style);
    applyTheme(style);
    if ($currentUser) {
      try {
        await pb.collection('users').update($currentUser.id, { theme_preference: style });
      } catch (error) {
        console.error('Failed to save theme preference:', error);
      }
    }
    dispatch('styleChange', { style });
    dispatch('close');
  }

  onMount(async () => {
    if ($currentUser) {
      try {
        const user = await pb.collection('users').getOne($currentUser.id);
        if (user.theme_preference) {
          currentTheme.set(user.theme_preference);
          applyTheme(user.theme_preference);
        }
      } catch (error) {
        console.error('Failed to fetch user theme preference:', error);
      }
    }
  });

  $: selectedStyle = styles.find(style => style.value === $currentTheme) || styles[0];
  $: displayedStyle = hoveredStyle || selectedStyle;

  function handleHover(style: Style) {
        hoveredStyle = style;
        applyTheme(style.value);
    }

  function handleMouseLeave() {
    hoveredStyle = null;
    applyTheme($currentTheme);
  }
</script>

<div class="style-switcher">
  <!-- <div class="current-style"> -->
      <!-- <svelte:component this={displayedStyle.icon} size={24} /> -->
      <!-- <p>{displayedStyle.description}</p> -->
      <!-- <span class="dummy" style="background-color: var(--primary-color); color: var(--text-color);">
          {displayedStyle.dummyContent}
      </span> -->
  <!-- </div> -->
  <!-- <svelte:component this={displayedStyle.icon} size={24} /> -->
  <h1>Switch theme</h1>

  <div class="style-list">
    {#each $t('ui.styles') as style}
        <button
              class="style-button {style.value}"
              class:active={$currentTheme === style.value}
              on:click={() => changeStyle(style.value)}
              on:mouseenter={() => handleHover(style)}
              on:mouseleave={handleMouseLeave}
          >
              <svelte:component this={style.icon} size={20} />
              <span>{style.name}</span>
          </button>
      {/each}
  </div>
</div>

<style lang="scss">
  @use "src/styles/themes.scss" as *;

  * {
  }

  .style-switcher {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: auto;
      padding: 1rem;
      border-radius: 8px;
      color: var(--text-color);
      height: 100%;
      width: 100%;

  }

  .current-style {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background-color: var(--secondary-color);
      text-align: center;
      border-radius: 50px;

      height: 100%;

  }

  .dummy {
      display: flex;
      width: auto;
      border-radius: 25px;
      height: 50%;
      justify-content: center;
      align-items: center;
  }

  .current-style span {
    background-color: blue;
  }

  .style-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: 50%;
      height: 100%;
  }

  .style-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border: none;
      padding: 0.5rem;
      border-radius: 4px;
      cursor: pointer;
      transition: all ease 0.3s;
      width: 100%;
      height: 50px;
      margin-bottom: 1rem;


      &.default {
          background-color: var(--primary-color);
          color: var(--text-color);
          font-family: var(--font-family);
      }

      &.dark {
          background-color: var(--primary-color);
          color: var(--text-color);
          font-family: var(--font-family);

      }

      &.light {
          background-color: var(--primary-color);
          color: var(--text-color);
          font-family: var(--font-family);

      }

      &.sunset {
          background-color: var(--primary-color);
          color: var(--text-color);
          font-family: var(--font-family);

      }

      &.focus {
          background-color: var(--primary-color);
          color: var(--text-color);
          font-family: var(--font-family);

      }

      &.bold {
          background-color: var(--primary-color);
          color: var(--text-color);
          font-family: var(--font-family);

      }

      &.turbo {
          background-color: var(--primary-color);
          color: var(--text-color);
          font-family: var(--font-family);

      }

      &:hover, &.active {
          background-color: var(--tertiary-color);
      }
  }

  p {
      margin: 0.5rem 0;
  }

  @media (max-width: 1000px) {
    .style-switcher {
      flex-direction: column;
      padding: 0;
      width: 100%;

    }

    .style-list {
      margin-left: 1%;
      margin-bottom: 1rem;
      width: 98%;
    }
  }
  
</style>