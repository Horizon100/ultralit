<!-- IconIconify.svelte -->
<script lang="ts">
 export let icon: any;
 export let size: string = 'w-8 h-8';
 export let color: string = 'currentColor';
 
 // More aggressive color replacement
 $: svgWithColor = icon.svg
   .replace(/fill="[^"]*"/g, `fill="${color}"`)
   .replace(/stroke="[^"]*"/g, `stroke="${color}"`)
   .replace(/<svg/, `<svg fill="${color}"`) // Add fill to svg element
   .replace(/style="[^"]*"/g, '') // Remove any inline styles that might override
   .replace(/<path/g, `<path fill="${color}"`); // Ensure all paths have the color
</script>

<div class="{size}" style="color: {color};">
 {@html svgWithColor}
</div>

<style>
 div :global(svg) {
   width: 100%;
   height: 100%;
   justify-content: center;
   display: flex;
 }
 
 div :global(path) {
   fill: inherit;
 }
</style>