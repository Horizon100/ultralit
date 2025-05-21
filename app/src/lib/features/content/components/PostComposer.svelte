<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentUser } from '$lib/pocketbase';
  import { pocketbaseUrl } from '$lib/pocketbase';
  import { Paperclip } from 'lucide-svelte';
    import { t } from '$lib/stores/translationStore';

  // Props$t('posts.inputPlaceholder');
  export let placeholder: string = $t('posts.textareaPlaceholder');
  export let buttonText: string = $t('posts.postButton');
  export let initialContent: string = "";
  export let disabled: boolean = false;
  export let parentId: string | undefined = undefined;
  export let showAttachments: boolean = true;
  
  // State
  let content = initialContent;
  let attachments: File[] = [];
  let fileInput: HTMLInputElement;
  let isSubmitting = false;
  
  const dispatch = createEventDispatcher<{
    submit: { content: string; attachments: File[]; parentId?: string };
  }>();
  
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      attachments = Array.from(target.files);
    }
  }
  
  function removeAttachment(index: number) {
    attachments = attachments.filter((_, i) => i !== index);
  }
  
  async function handleSubmit() {
    if (!content.trim() || isSubmitting) return;
    
    isSubmitting = true;
    
    try {
      dispatch('submit', {
        content: content.trim(),
        attachments: attachments.length > 0 ? attachments : [],
        parentId
      });
      
      // Reset form
      content = '';
      attachments = [];
      if (fileInput) fileInput.value = '';
    } catch (err) {
      console.error('Error submitting post:', err);
    } finally {
      isSubmitting = false;
    }
  }
  
  // Reset content when initialContent changes
  $: content = initialContent;
</script>

<div class="post-composer">
  <div class="composer-header">
    <img 
      src={$currentUser?.avatar ? `${pocketbaseUrl}/api/files/users/${$currentUser.id}/${$currentUser.avatar}` : '/api/placeholder/40/40'} 
      alt="Your avatar" 
      class="composer-avatar" 
    />
    <textarea
      bind:value={content}
      {placeholder}
      class="composer-textarea"
      rows="3"
      disabled={disabled || isSubmitting}
    ></textarea>
  </div>
  
  {#if attachments.length > 0}
    <div class="attachments-preview">
      {#each attachments as file, index}
        <div class="attachment-item">
          <span class="attachment-name">{file.name}</span>
          <button 
            class="remove-attachment"
            on:click={() => removeAttachment(index)}
            type="button"
          >
            ×
          </button>
        </div>
      {/each}
    </div>
  {/if}
  
  <div class="composer-actions">
    {#if showAttachments}
      <div class="composer-options">
        <input
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx"
          on:change={handleFileSelect}
          class="file-input"
          bind:this={fileInput}
        />
        <button 
          class="composer-option-button"
          on:click={() => fileInput?.click()}
          type="button"
          title="Add attachments"
          disabled={disabled || isSubmitting}
        >
          <Paperclip size={16} />
        </button>
      </div>
    {/if}
    <button 
      class="post-button" 
      class:active={content.trim() && !isSubmitting}
      on:click={handleSubmit}
      disabled={!content.trim() || isSubmitting || disabled}
    >
      {isSubmitting ? $t('posts.posting') : buttonText}
    </button>
  </div>
</div>

<style lang="scss">
  $breakpoint-sm: 576px;
  $breakpoint-md: 1000px;
  $breakpoint-lg: 992px;
  $breakpoint-xl: 1200px;
	@use "src/styles/themes.scss" as *;
  * {

    font-family: var(--font-family);
  }    
  .post-composer {
    background: var(--primary-color);
    border: 1px solid var(--line-color);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
  }
  
  .composer-header {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .composer-avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--line-color);
    flex-shrink: 0;
  }
  
  .composer-textarea {
    flex: 1;
    background: transparent;
    border: none;
    resize: none;
    font-size: 16px;
    color: var(--text-color);
    font-family: var(--font-family);
    line-height: 1.5;
    outline: none;
  }
  
  .composer-textarea::placeholder {
    color: var(--placeholder-color);
  }
  
  .attachments-preview {
    padding: 12px 16px;
    background: var(--bg-gradient);
    border-radius: 8px;
    margin-bottom: 12px;
  }
  
  .attachment-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid var(--line-color);
  }
  
  .attachment-item:last-child {
    border-bottom: none;
  }
  
  .attachment-name {
    font-size: 14px;
    color: var(--text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }
  
  .remove-attachment {
    background: none;
    border: none;
    color: var(--text-color);
    cursor: pointer;
    font-size: 18px;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.15s ease;
  }
  
  .remove-attachment:hover {
    background-color: rgba(255, 0, 0, 0.1);
    color: #ff4444;
  }
  
  .composer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .composer-options {
    display: flex;
    gap: 8px;
  }
  
  .file-input {
    display: none;
  }
  
  .composer-option-button {
    background: none;
    border: none;
    padding: 8px;
    border-radius: 6px;
    color: var(--text-color);
    cursor: pointer;
    transition: background-color 0.15s ease;
  }
  
  .composer-option-button:hover:not(:disabled) {
    background-color: var(--bg-gradient);
  }
  
  .composer-option-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .post-button {
    background: var(--primary-color);
    color: var(--placeholder-color);
    border: none;
    padding: 8px 24px;
    border-radius: 20px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    opacity: 0.5;
  }
  
  .post-button.active {
    opacity: 1;
  }
  
  .post-button:hover:not(:disabled).active {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    color: var(--text-color);
  }
  
  .post-button:disabled {
    cursor: not-allowed;
  }
</style>