<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { clientTryCatch } from '$lib/utils/errorUtils';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { PostWithInteractions, CommentWithInteractions } from '$lib/types/types.posts';

  // Props
  export let isOpen: boolean = false;
  export let post: PostWithInteractions | CommentWithInteractions;
  export let selectedModel: string = 'qwen2.5:0.5b'; 

  // Component state
  let loading: boolean = false;
  let analysis: string = '';
  let error: string | null = null;
  let analysisType: 'summary' | 'sentiment' | 'tags' | 'custom' = 'summary';
  let customPrompt: string = '';
  let loadingProgress: string = 'Starting analysis...';

  // Loading progress messages
  const progressMessages = [
    'Starting analysis...',
    'Loading AI model...',
    'Processing content...',
    'Generating response...'
  ];

  let progressInterval: number;

  const dispatch = createEventDispatcher<{
    close: void;
    analyzed: { postId: string; analysis: string; type: string };
  }>();

  // Analysis prompt templates
  const prompts = {
    summary: 'Provide a concise summary of this post in 2-3 sentences:',
    sentiment: 'Analyze the sentiment and emotional tone of this post. Is it positive, negative, or neutral? Explain why:',
    tags: 'Generate 3-5 relevant tags for this post content. Return them as a comma-separated list:',
    custom: '' // User provides their own prompt
  };

  // Close modal
  function closeModal() {
    isOpen = false;
    dispatch('close');
  }

  // Handle escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }

  // Get analysis prompt
  function getPrompt(): string {
    const basePrompt = analysisType === 'custom' ? customPrompt : prompts[analysisType];
    return `${basePrompt}\n\nPost content: "${post.content}"`;
  }

  // Perform AI analysis
  async function analyzePost() {
    if (!post.content.trim()) {
      error = 'No content to analyze';
      return;
    }

    if (analysisType === 'custom' && !customPrompt.trim()) {
      error = 'Please enter a custom prompt';
      return;
    }

    loading = true;
    error = null;
    analysis = '';

    console.log('🤖 Starting local AI analysis:', { 
      model: selectedModel, 
      type: analysisType,
      postId: post.id 
    });

    const analysisResult = await clientTryCatch(
      fetch('/api/ai/local/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: getPrompt(),
          model: selectedModel,
          auto_optimize: true, // Re-enabled now that import is fixed
          temperature: analysisType === 'tags' ? 0.3 : 0.7,
          max_tokens: analysisType === 'summary' ? 150 : 300
        })
      }).then(r => r.json()),
      'Failed to analyze post with local AI'
    );

    if (analysisResult.success) {
      const result = analysisResult.data;
      
      if (result.success && result.data?.response) {
        analysis = result.data.response.trim();
        console.log('🤖 Analysis complete:', { 
          model: result.data.model, 
          tokens: result.data.usage?.total_tokens 
        });

        // Dispatch analyzed event
        dispatch('analyzed', { 
          postId: post.id, 
          analysis, 
          type: analysisType 
        });
      } else {
        error = result.error || 'No response from AI model';
      }
    } else {
      error = analysisResult.error;
      console.error('🤖 Analysis failed:', analysisResult.error);
    }

    loading = false;
  }

  // Reset when modal opens
  $: if (isOpen) {
    analysis = '';
    error = null;
    loading = false;
  }
</script>


<!-- Modal backdrop -->
{#if isOpen}
  <div 
    class="modal-backdrop"
    on:click={closeModal}
    on:keydown={handleKeydown}
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <!-- Modal content -->
    <div 
      class="modal-content"
      on:click|stopPropagation
      transition:fly={{ y: 50, duration: 300, easing: cubicOut }}
    >
      <!-- Modal header -->
      <div class="modal-header">
        <h2 id="modal-title">
          	<Icon name="Brain" size={14} />
          Local AI Analysis
        </h2>
        <button 
          class="close-btn"
          on:click={closeModal}
          aria-label="Close"
        >
          	<Icon name="X" size={14} />
        </button>
      </div>

      <!-- Post preview -->
      <div class="post-preview">
        <div class="post-content">
          "{post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content}"
        </div>
        <div class="post-meta">
          Model: <span class="model-name">{selectedModel}</span>
        </div>
      </div>

      <!-- Analysis type selector -->
      <div class="analysis-controls">
        <label class="control-label">Analysis Type:</label>
        <div class="analysis-types">
          <button 
            class="type-btn" 
            class:active={analysisType === 'summary'}
            on:click={() => analysisType = 'summary'}
          >
          	<Icon name="ListExpand" size={14} />
            Summary
          </button>
          <button 
            class="type-btn" 
            class:active={analysisType === 'sentiment'}
            on:click={() => analysisType = 'sentiment'}
          >
          	<Icon name="Heart" size={14} />
            Sentiment
          </button>
          <button 
            class="type-btn" 
            class:active={analysisType === 'tags'}
            on:click={() => analysisType = 'tags'}
          >
          	<Icon name="Tag" size={14} />
            Tags
          </button>
          <button 
            class="type-btn" 
            class:active={analysisType === 'custom'}
            on:click={() => analysisType = 'custom'}
          >
          	<Icon name="Edit3" size={14} />
            Custom
          </button>
        </div>
      </div>

      <!-- Custom prompt input -->
      {#if analysisType === 'custom'}
        <div class="custom-prompt" transition:fly={{ y: -20, duration: 200 }}>
          <label for="custom-prompt-input" class="control-label">Custom Prompt:</label>
          <textarea
            id="custom-prompt-input"
            bind:value={customPrompt}
            placeholder="Enter your analysis prompt..."
            rows="3"
            class="prompt-input"
          ></textarea>
        </div>
      {/if}

      <!-- Action buttons -->
      <div class="action-buttons">
        <button 
          class="analyze-btn"
          on:click={analyzePost}
          disabled={loading || (analysisType === 'custom' && !customPrompt.trim())}
        >
          {#if loading}
            Analyzing...
          {:else}
          	<Icon name="Zap" size={14} />
            Analyze
          {/if}
        </button>
      </div>

      <!-- Results section -->
      <div class="results-section">
        {#if error}
          <div class="error-message" transition:fly={{ y: -10, duration: 200 }}>
          	<Icon name="AlertCircle" size={14} />
            {error}
          </div>
        {/if}

        {#if analysis}
          <div class="analysis-result" transition:fly={{ y: 20, duration: 300 }}>
            <label class="result-label">
          	<Icon name="Brain" size={14} />
              AI Analysis:
            </label>
            <div class="analysis-text">{analysis}</div>
            
            <!-- Copy button -->
            <button 
              class="copy-btn"
              on:click={() => navigator.clipboard.writeText(analysis)}
              title="Copy to clipboard"
            >
          	<Icon name="Copy" size={14} />
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
    backdrop-filter: blur(2px);
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    border: 1px solid #e5e7eb;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid #e5e7eb;
    background: #f8fafc;
    border-radius: 12px 12px 0 0;
  }

  .modal-header h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
  }

  .header-icon {
    color: #3b82f6;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    color: #6b7280;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #e5e7eb;
    color: #374151;
  }

  .post-preview {
    padding: 16px 24px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .post-content {
    font-style: italic;
    color: #4b5563;
    margin-bottom: 8px;
    line-height: 1.5;
  }

  .post-meta {
    font-size: 12px;
    color: #6b7280;
  }

  .model-name {
    font-weight: 600;
    color: #3b82f6;
  }

  .analysis-controls {
    padding: 20px 24px;
  }

  .control-label {
    display: block;
    font-weight: 500;
    color: #374151;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .analysis-types {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
  }

  .type-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 12px;
    border: 2px solid #e5e7eb;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 13px;
    font-weight: 500;
  }

  .type-btn:hover {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .type-btn.active {
    border-color: #3b82f6;
    background: #3b82f6;
    color: white;
  }

  .custom-prompt {
    padding: 0 24px 20px;
  }

  .prompt-input {
    width: 100%;
    padding: 8px 12px;
    border: 2px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    min-height: 80px;
  }

  .prompt-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .action-buttons {
    padding: 0 24px 20px;
  }

  .analyze-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 24px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .analyze-btn:hover:not(:disabled) {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .analyze-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    transform: none;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .results-section {
    padding: 0 24px 24px;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #dc2626;
    font-size: 14px;
  }

  .analysis-result {
    position: relative;
    padding: 16px;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
  }

  .result-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #0369a1;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .analysis-text {
    color: #374151;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .copy-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 6px;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s;
  }

  .copy-btn:hover {
    background: #f3f4f6;
    color: #374151;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .modal-content {
      margin: 10px;
      max-height: 95vh;
    }

    .analysis-types {
      grid-template-columns: 1fr 1fr;
    }

    .modal-header {
      padding: 16px 20px;
    }

    .modal-header h2 {
      font-size: 16px;
    }
  }
</style>