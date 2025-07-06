<!-- src/lib/features/ai/components/LocalModelSelector.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { clientTryCatch } from '$lib/utils/errorUtils';
  import type { LocalAIModel } from '$lib/types/types.localModels';

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Props
  export let selectedModel: string = 'qwen2.5:0.5b';
  export let disabled: boolean = false;
  export let showDetails: boolean = true;
  export let placeholder: string = 'Select a local model...';

  // Component state
  let models: LocalAIModel[] = [];
  let loading: boolean = true;
  let error: string | null = null;
  let serverStatus: 'online' | 'offline' | 'unknown' = 'unknown';

  // Reactive
  $: selectedModelData = models.find(m => m.api_type === selectedModel);
  
  // Dispatch change event when selectedModel changes
let hasInitialized = false;
$: if (selectedModel && hasInitialized && models.length > 0) {
  dispatch('change', { 
    model: selectedModel, 
    modelData: selectedModelData 
  });
}

// Mark as initialized after first model fetch
$: if (models.length > 0 && !hasInitialized) {
  hasInitialized = true;
}

  // Fetch available models
  async function fetchModels() {
    loading = true;
    error = null;

    console.log('🔍 LocalModelSelector - Starting fetch...');

    // Use clientTryCatch for clean error handling
    const fetchResult = await clientTryCatch(
      fetch('/api/ai/local/models').then(r => r.json()),
      'Failed to fetch local AI models'
    );

    console.log('🔍 LocalModelSelector - Fetch result:', fetchResult);

    if (fetchResult.success) {
      const result = fetchResult.data;
      console.log('🔍 LocalModelSelector - Raw API response:', result);
      console.log('🔍 LocalModelSelector - result.success:', result.success);
      console.log('🔍 LocalModelSelector - result.data:', result.data);
      
      // Handle apiTryCatch wrapper structure
      if (result.success) {
        const data = result.data;
        console.log('🔍 LocalModelSelector - Inner data:', data);
        console.log('🔍 LocalModelSelector - data.models:', data.models);
        console.log('🔍 LocalModelSelector - data.server_info:', data.server_info);
        
        models = data.models || [];
        serverStatus = data.server_info?.status === 'connected' ? 'online' : 'offline';
        
        console.log('🔍 LocalModelSelector - Set models length:', models.length);
        console.log('🔍 LocalModelSelector - Set serverStatus:', serverStatus);
        
        // Auto-select first model if none selected and models available
        if (!selectedModel && models.length > 0) {
          selectedModel = models[0].api_type;
          console.log('🔍 LocalModelSelector - Auto-selected model:', selectedModel);
        }
        
        console.log(`🔍 LocalModelSelector - Final: ${models.length} models, status: ${serverStatus}`);
      } else {
        console.log('🔍 LocalModelSelector - API returned success=false');
        error = result.error || 'Server returned error';
        serverStatus = 'offline';
        models = [];
      }
    } else {
      console.log('🔍 LocalModelSelector - Fetch failed completely');
      error = fetchResult.error;
      serverStatus = 'offline';
      models = [];
      console.error('🔍 LocalModelSelector - Fetch error:', fetchResult.error);
    }

    loading = false;
    console.log('🔍 LocalModelSelector - Fetch complete. Final state:', { 
      models: models.length, 
      serverStatus, 
      error 
    });
  }

  // Format file size
  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Format model families
  function formatFamilies(families: string[]): string {
    return families.join(', ');
  }

  // Retry connection
  function retry() {
    fetchModels();
  }

  onMount(() => {
    fetchModels();
  });
</script>

<div class="local-model-selector">
  <!-- Status Indicator -->
  <div class="status-bar">
    <div class="status-indicator {serverStatus}">
      <span class="status-dot"></span>
      <span class="status-text">
        {#if serverStatus === 'online'}
          Local AI Online
        {:else if serverStatus === 'offline'}
          Local AI Offline
        {:else}
          Checking...
        {/if}
      </span>
    </div>
    
    {#if error}
      <button class="retry-btn" on:click={retry} title="Retry connection">
        🔄
      </button>
    {/if}
  </div>

  <!-- Model Selector -->
  <div class="selector-container">
    <label for="model-select" class="selector-label">
      Local Model:
    </label>
    
    <select 
      id="model-select"
      bind:value={selectedModel}
      {disabled}
      class="model-select"
      class:loading
      class:error={!!error}
      on:change={() => {
  if (selectedModel && models.length > 0) {
    dispatch('change', { 
      model: selectedModel, 
      modelData: selectedModelData 
    });
  }
}}
    >
      {#if loading}
        <option value="">Loading models...</option>
      {:else if error}
        <option value="">Connection failed</option>
      {:else if models.length === 0}
        <option value="">No models available</option>
      {:else}
        <option value="" disabled>{placeholder}</option>
        {#each models as model}
          <option value={model.api_type}>
            {model.name} ({model.parameters})
          </option>
        {/each}
      {/if}
    </select>
  </div>

  <!-- Model Details -->
  {#if showDetails && selectedModelData}
    <div class="model-details">
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Size:</span>
          <span class="detail-value">{formatSize(selectedModelData.size)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Parameters:</span>
          <span class="detail-value">{selectedModelData.parameters}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Family:</span>
          <span class="detail-value">{formatFamilies(selectedModelData.families)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Provider:</span>
          <span class="detail-value">Local</span>
        </div>
      </div>
    </div>
  {/if}

  <!-- Model Count -->
  {#if !loading && !error}
    <div class="model-count">
      {models.length} model{models.length !== 1 ? 's' : ''} available
    </div>
  {/if}
</div>

<style>
  .local-model-selector {
    width: 100%;
    max-width: 400px;
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* Status Bar */
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding: 4px 0;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #gray;
  }

  .status-indicator.online .status-dot {
    background: #22c55e;
    animation: pulse 2s infinite;
  }

  .status-indicator.offline .status-dot {
    background: #ef4444;
  }

  .status-indicator.unknown .status-dot {
    background: #f59e0b;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .status-text {
    color: #6b7280;
  }

  .status-indicator.online .status-text {
    color: #16a34a;
  }

  .status-indicator.offline .status-text {
    color: #dc2626;
  }

  .retry-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .retry-btn:hover {
    background: #f3f4f6;
  }

  /* Selector */
  .selector-container {
    margin-bottom: 12px;
  }

  .selector-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 4px;
  }

  .model-select {
    width: 100%;
    padding: 8px 12px;
    border: 2px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    background: white;
    transition: all 0.2s;
    cursor: pointer;
  }

  .model-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .model-select:disabled {
    background: #f9fafb;
    color: #9ca3af;
    cursor: not-allowed;
  }

  .model-select.loading {
    border-color: #f59e0b;
    background: #fffbeb;
  }

  .model-select.error {
    border-color: #ef4444;
    background: #fef2f2;
  }

  /* Model Details */
  .model-details {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 8px;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .detail-label {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
  }

  .detail-value {
    font-size: 12px;
    color: #374151;
    font-weight: 600;
    text-align: right;
  }

  /* Model Count */
  .model-count {
    font-size: 11px;
    color: #9ca3af;
    text-align: center;
    font-style: italic;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .detail-grid {
      grid-template-columns: 1fr;
    }
    
    .detail-item {
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
    }
    
    .detail-item:last-child {
      border-bottom: none;
    }
  }
</style>