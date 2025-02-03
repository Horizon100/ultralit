<!-- <script lang="ts">
  import { onMount } from "svelte";
  import type { SvelteComponent } from "svelte";

  export let iconName: string;
  export let size = 24;
  export let color = "currentColor";
  let IconComponent: typeof SvelteComponent;

  const icons = {
    HomeIcon: () => import('@radix-ui/react-icons').then(mod => mod.HomeIcon),
    StarIcon: () => import('@radix-ui/react-icons').then(mod => mod.StarIcon),
    // Add more icons here...
  };

  onMount(async () => {
    if (icons[iconName]) {
      const module = await icons[iconName]();
      IconComponent = module.default;
    } else {
      console.warn(`Icon "${iconName}" not found.`);
    }
  });
</script>

{#if IconComponent}
  <IconComponent width={size} height={size} fill={color} />
{:else}
  <div style="width: {size}px; height: {size}px;"></div>
{/if} -->
