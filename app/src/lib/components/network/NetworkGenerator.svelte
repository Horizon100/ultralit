<script lang="ts">
  import { onMount } from 'svelte';
  import type { NetworkData, AIModel } from '$lib/types/types';

  import { generateNetwork } from '$lib/clients/aiClient';
  import NetworkVisualization from './NetworkVisualization.svelte';

  export let summary: string;
  export let aiModel: AIModel;
  export let userId: string;
  

  let networkData: NetworkData | null = null;

  onMount(async () => {
    try {
      networkData = await generateNetwork(summary, aiModel, userId);
    } catch (error) {
      console.error('Error generating network:', error);
    }
  });
</script>



{#if networkData}
  <div class="network-container">
    <NetworkVisualization {networkData} />
  </div>
{:else}
  <p>Generating network...</p>
{/if}

<style>
  .network-container {
    margin-top: 20px;
    padding: 10px;
    background-color: #f0f0f0;
    border-radius: 5px;
  }
</style>