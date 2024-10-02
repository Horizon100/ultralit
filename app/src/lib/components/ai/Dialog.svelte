<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import AIChat from '$lib/components/ai/AIChat.svelte';
  import { networkStore } from '$lib/stores/networkStore';
  import { threadsStore } from '$lib/stores/threadsStore';
  import type { Node, NodeConfig, AIModel, NetworkData, Task, PromptType, Attachment, Threads, Messages} from '$lib/types';
  import { ArrowRight, Paperclip, CheckCircle, Bot } from 'lucide-svelte';
  import { createAgentWithSummary, ensureAuthenticated, updateAIAgent } from '$lib/pocketbase';
  import { goto } from '$app/navigation';
  import { quotes } from '$lib/quotes';
  import ModelSelector from './ModelSelector.svelte';
  import PromptSelector from '../ai/PromptSelector.svelte';
  import { fly, fade, blur } from 'svelte/transition';
  import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
  import greekImage from '$lib/assets/illustrations/greek.png';
  import { navigating } from '$app/stores';
  import { isNavigating } from '$lib/stores/navigationStore';
  import { fetchThreads, fetchMessagesForThread, addMessageToThread, updateThread, updateMessage, createThread } from '$lib/threadsClient';

  export let x: number;
  export let y: number;
  export let aiModel: AIModel;
  export let userId: string = crypto.randomUUID();
  export let availableModels: AIModel[] = []; 

  let seedPrompt = '';
  let showChat = false;
  let showIntro = false;
  let config: NodeConfig = {
    maxTokens: 100,
    temperature: 0.7,
  };
  let summary: string = '';
  let tasks: Task[] = [];
  let currentQuote = quotes[Math.floor(Math.random() * quotes.length)];
  let textareaElement: HTMLTextAreaElement | null = null;
  let isAuthenticated = false;

  let attachment: Attachment | null = null;
  let fileInput: HTMLInputElement;
  let selectedPromptType: PromptType = 'CASUAL_CHAT';

  let isLoading = false;

  let threads: Threads[];
  let currentThreadId: string | null;
  let messages: Messages[];
  let showThreadList = false;
  let updateStatus: string;
  let showConfirmation = false;
  let newThreadName = '';
  let newThreadId: string | null = null;


  $: ({ threads, currentThreadId, messages, updateStatus } = $threadsStore);
  $: groupedMessages = $threadsStore.getMessagesByDate;

  const dispatch = createEventDispatcher<{
    create: { node: Node; networkData: NetworkData | null };
    cancel: void;
  }>();

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

    async function handleLoadThread(threadId: string) {
    try {
      await threadsStore.loadMessages(threadId);
      // Don't automatically redirect, instead update the UI to show the loaded thread
      currentThreadId = threadId;
      // You might want to update other UI elements here
    } catch (error) {
      console.error(`Error loading messages for thread ${threadId}:`, error);
    }
  }

  onMount(async () => {
    isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      console.error('User is not logged in. Please log in to create a network.');
    }

    if (textareaElement) {
      const adjustTextareaHeight = () => {
        if (textareaElement) {
          textareaElement.style.height = 'auto';
          textareaElement.style.height = `${Math.min(textareaElement.scrollHeight, 300)}px`;
        }
      };

      textareaElement.addEventListener('input', adjustTextareaHeight);
      adjustTextareaHeight();

      if (!showChat) {
        textareaElement.focus();
      }

      const loadedThreads = await threadsStore.loadThreads();
      threads = loadedThreads;
      
    }

    await threadsStore.loadThreads(); 
    if (threads.length === 0) {
      await handleCreateNewThread();
      goto('/ask');

    }
    if (currentThreadId) {
      await handleLoadThread(currentThreadId);
      goto('/ask');

    }
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSeedPromptSubmit();
    }
  }




  async function handleCreateNewThread() {
    try {
      const newThread = await threadsStore.addThread({ op: userId, name: `Thread ${threads?.length ? threads.length + 1 : 1}` });
      if (newThread && newThread.id) {
        threads = [...(threads || []), newThread];
        await handleLoadThread(newThread.id);
      } else {
        console.error("Failed to create new thread: Thread object is undefined or missing id");
      }
    } catch (error) {
      console.error("Error creating new thread:", error);
    }
  }

  function handleUpload() {
    fileInput.click();
  }

  function handleFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        const file = target.files[0];
        attachment = {
            id: crypto.randomUUID(),
            name: file.name,
            url: URL.createObjectURL(file),
            file: file
        };
    }
  }
  
  function deleteAttachment() {
    attachment = null;
  }

  function handlePromptSelection(event: CustomEvent<PromptType>) {
    selectedPromptType = event.detail;
    console.log('Selected prompt:', event.detail);
  }

  async function handleSeedPromptSubmit() {
    console.log("handleSeedPromptSubmit called");
    if (seedPrompt.trim() || attachment) {
      isLoading = true;
      try {
        // Create new thread
        const newThread = await threadsStore.addThread({ op: userId, name: `Thread ${threads?.length ? threads.length + 1 : 1}` });
        if (newThread && newThread.id) {
          threads = [...(threads || []), newThread];
          await threadsStore.setCurrentThread(newThread.id);  
          newThreadName = newThread.name;
          newThreadId = newThread.id;

          // Add the seed prompt as the first message
          let firstMessageId = null;
          if (seedPrompt.trim()) {
            const firstMessage = await threadsStore.addMessage({
              thread: newThread.id,
              text: seedPrompt.trim(),
              type: 'human',
              user: userId,
            });
            firstMessageId = firstMessage.id;
          }
          
          // Show confirmation
          showConfirmation = true;
        } else {
          console.error("Failed to create new thread: Thread object is undefined or missing id");
        }


      handleConfirmation();
    } catch (error) {
      console.error("Error creating new thread:", error);
    } finally {
      isLoading = false;
    }
  }
}

  function handleConfirmation() {
    if (newThreadId) {
      const params = new URLSearchParams();
      params.append('threadId', newThreadId);
      if (aiModel && aiModel.id) {
        params.append('modelId', aiModel.id);
      }
      params.append('promptType', selectedPromptType);
      goto(`/ask?${params.toString()}`);
    }
    showConfirmation = false;
  }
  function resetSeedPrompt() {
    seedPrompt = '';
    showChat = false;
    showIntro = true;
    currentQuote = quotes[Math.floor(Math.random() * quotes.length)];
  }

  async function handleFinalize() {
    // ... (keep the existing handleFinalize function)
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleSummaryGeneration(event: CustomEvent<string>) {
    summary = event.detail;
    console.log("Summary received:", summary);
  }

  function handleTasksGeneration(event: CustomEvent<Task[]>) {
    tasks = event.detail;
    console.log("Tasks received:", tasks);
  }

  function handleModelSelection(event: CustomEvent<AIModel>) {
    aiModel = event.detail;
    console.log('Selected model:', event.detail);
  }


</script>

<div class="seed-container" transition:fade={{ duration: 300 }}>
  <div class="modal" in:fly={{ x: -50, duration: 300, delay: 300 }} out:fly={{ x: 50, duration: 300 }}>
    {#if !showChat}
      {#if !showConfirmation}
        <div class="seed-prompt-input" transition:blur={{ duration: 300 }}>
          <div class="text-container">
            <textarea 
              bind:this={textareaElement} 
              bind:value={seedPrompt} 
              placeholder={currentQuote}
              on:keydown={handleKeydown}
          ></textarea>
          </div>
          <div class="button-row">
            {#if attachment}
              <button class="attachment-icon" on:dblclick={deleteAttachment}>
                <Paperclip size="20" color="white" />
                <span class="file-name">{attachment.name}</span>
              </button>
            {/if}
            <ModelSelector models={availableModels} selectedModel={aiModel} on:select={handleModelSelection} />
            <PromptSelector on:select={handlePromptSelection} />
            <button on:click={handleUpload}>
              <Paperclip size="20" color="white" />
            </button>
            <button on:click={handleSeedPromptSubmit}>
              <ArrowRight size="20" color="white" />
            </button>
          </div>
          <div class="thread-list">
            <button class="add-button" on:click={handleCreateNewThread}>+ New Thread</button>
            {#each threads as thread}
              <button 
                on:click={() => handleLoadThread(thread.id)}
                class:selected={currentThreadId === thread.id}
              >
                {thread.name}
              </button>
            {/each}
          </div>
        </div>
        <!-- <img src={greekImage} alt="Greek illustration" class="illustration" /> -->
      {:else}
      {#if showConfirmation}
      <div class="confirmation" transition:fly={{ y: -20, duration: 300 }}>
        <div class="spinner">
          <Bot size={40} class="bot-icon" />
        </div>
        <p>New thread "{newThreadName}" created</p>
        <button on:click={handleConfirmation}>Continue to Chat</button>
      </div>
    {/if}

      {/if}
    {:else}
      <AIChat 
        {seedPrompt} 
        {aiModel} 
        {userId}
        attachment={attachment?.file}
        promptType={selectedPromptType}
        on:summary={handleSummaryGeneration}
        on:tasks={handleTasksGeneration}
      />
    {/if}
  </div>
</div>

{#if $isNavigating}
<LoadingSpinner />
{/if}

<input
  type="file"
  bind:this={fileInput}
  style="display: none;"
  on:change={handleFileSelected}
/>

<input
  type="file"
  bind:this={fileInput}
  style="display: none;"
  on:change={handleFileSelected}
/>

<style>

* {
  font-family: 'Merriweather', serif;

}
  .modal {
    display: flex;
    flex-direction: column;
    /* border-radius: 40px; */
    /* padding: 10px; */
    height: 90vh;
    width: 100%;
    /* margin-top: 100px; */
    position: relative;
    /* min-width: 400px; */
    /* background-color:#010e0e; */
    /* width: 50%; */
    /* left: 2rem; */
    /* transform: translate(-50%, 0%); */
    /* border-radius: 80px; */
    /* background-color: red; */
    transition: all 1.2s ease-in-out;
    /* z-index: 1000; */
    
    
  }


  .seed-prompt-input {
    display: flex;
    flex-direction: column;
    justify-content:end;
    /* align-items: center; */
    /* margin-top: 25%; */
    /* height: 100%; */
    gap: 20px;
    /* height: auto; */
    /* align-content: center; */
    /* justify-content: center; */
    padding: 10px;

    /* gap: 10px; */
    /* align-items: bottom; */
    /* width: 94%; */
    /* margin: 0 auto; */
    
  }

  @media (max-width: 940px) {
    .seed-prompt-input {
      flex-direction: column;
      /* width: 90%; */
    }
  }

  .text-container {
    display: flex;



  }



  /* flex-grow: 1;
      overflow-y: auto;
      padding: 10px;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      scrollbar-width: thin;
      scrollbar-color: #000000 transparent;
      margin-bottom: 10px;
      padding-top: 40px;
      padding-bottom: 40px;
 */

  @media (max-width: 600px) {
    .text-container {
      flex-direction: column;
    }

    .landing-footer {
      flex-direction: column;
      display: flex;
      flex-direction: column;
      width: 98%;
      margin-left: 1%;
    }
  }

  textarea {
    font-family: 'Merriweather', serif;

    display: flex;
    position: relative;
    width: 98%;
    /* margin-left: 1%; */
    top: 0;
    /* min-height: 60px; Set a minimum height */
    /* max-height: 1200px; Set a maximum height */
    padding: 10px;
    text-justify: center;
    justify-content: center;
    resize: none;
    font-size: 30px;
    letter-spacing: 1.4px;
    border: none;
    border-radius: 20px;
    /* background-color: #2e3838; */
    background-color: #21201d;
    color: #818380;
    line-height: 1.4;
    /* height: auto; */
    text-justify: center;
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
    overflow: scroll;
    scrollbar-width:none;
    scrollbar-color: #21201d transparent;
    vertical-align: middle; /* Align text vertically */
    transition: 0.6s cubic-bezier(0.075, 1.82, 0.165, 1);
    opacity: 0.8;
  }

  textarea:focus {
    outline: none;
    border: 2px solid #000000;
    color: white;
    font-size: 40px;
    padding: 10px 20px;
    line-height: 1.4;
    margin: 10px;
    flex-direction: column;
    background-color: #474747;
    max-height: 600px;
    /* width: 100%; */


    
  }

  .button-row {
    display: flex;
    flex-direction: row;
    justify-content:flex-end;
    /* align-items: center; */

    /* position: relative; */
    /* bottom: 3rem; */
    /* right: 1rem; */
    gap: 20px;
    /* padding: 10px; */
    width: 100%;
    /* background-color: red; */

  }

  h1 {
    padding: 20px;
    border-radius: 50px;
    justify-content: center;
    align-items: center;
    font-size: 70px;
    color: white;
    letter-spacing: 4px;
    font-style: italic;
  }

  button {
    width: 50px;
    height: 50px;
    /* padding: 12px; */
    justify-content: center;
    align-items: center;
    /* margin-bottom: 20px; */
    background: transparent;    
    color: black;
    font-size: 18px;
    border: none;
    /* border: 2px solid #506262; */
    border-radius: 80px;
    cursor: pointer;
    transition: background-color 0.3s;
  }

  button:hover {
    background: #818380;
    color: white;
  }

  p {
    margin: 0 0 20px 0;
    font-size: 24px;
    padding: 20px;
    font-style: italic;
    position: relative;
    backdrop-filter: blur(15px);
    transition: all 0.2s ease-in-out;
  }

  p::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    z-index: -1;
    filter: blur(30px);
    opacity: 0.6;
  }

  p:hover {
    box-shadow: 0 80px 16px rgba(0, 0, 0, 0.3);
  }

  .intro {
    display: flex;
    width: auto;
    align-items: center;
    justify-content: center;
    text-align: center;
    margin-top: 0;
  }

  .seed-container {
    display: flex;
    /* max-width: 900px; */
    flex-direction: column;
    align-items: right;
    justify-content: center;
    gap: 20px;
    height: 90vh;
    /* border: 7px solid black; */
    align-items: bottom;
    /* background-color: red; */
  }

  .attachment-icon {
    position: relative;
    border: none;
    height: 30px;
    width: 30px;
    margin-right: 10px;

  }

  .attachment-icon::after {
    content: '\2715';
    position: absolute;
    top: -5px;
    right: -5px;
    background-color: red;
    color: white;
    border-radius: 50%;
    width: 15px;
    height: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
  }

  .illustration {
  position: absolute;
  width: 90%;
  height: auto;
  left: 5%;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.025;
  z-index: 1;
  pointer-events: none;
}



.thread-list {
  /* display: grid; */
  /* grid-template-columns: repeat(3, 2fr); Two columns */
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-start; 
  align-content: flex-start; 
  max-height: calc(100vh - 200px);   
  gap: 30px;
  width: 100%;
  top: 50%;
  /* height: 50%; */
  scrollbar-width: thin;
  scrollbar-color: #ffffff transparent;
  overflow-y: auto;
  grid-column: auto / span 2;
  grid-row: auto / span 2;
  padding: 10px;
  color: black;
  border-radius: 20px;
  scroll-behavior: smooth;
  transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

}



.thread-list button {
  display: flex;
  width: auto;
  /* height: 60px; */
  padding: 20px;
  text-align: left;
  border-bottom: 1px solid #4b4b4b;
  /* border-left: 1px solid #4b4b4b; */
  /* border-top: 1px solid #4b4b4b; */
  padding: 20px;
  /* background-color: red; */
  border-radius: 10px;
  /* border-end-start-radius: 50px; */
  border-radius: 10px;
  /* border-top-left-radius: 50px; */
  cursor: pointer;
  background-color: rgb(71, 59, 59);

  color: #fff;
  transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
  font-size: 24px;
  justify-content: left;
  align-items: center;
}


    .thread-list button:hover {
        background-color: #2c3e50;
        transform: scale(1.25) translateX(5px) rotate(3deg);          
        letter-spacing: 4px;
        padding: 20px;

      }

    .thread-list button.selected {
        /* background-color: #2980b9; */
        font-weight: 200;
        
    }

    .landing-footer {
      display: flex;
      position: relative;
      width: 98%;
      margin-left: 1%;

    }

    .thread-list .add-button {
      background-color: rgb(62, 75, 92);
      font-style: italic;
      font-weight: bolder;
      border-bottom: 1px solid #6b6b6b;
      border-radius: 10px;
      transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

      /* margin-bottom: 2rem; */
    }

    .thread-list .add-button:hover {
      background-color: rgb(207, 207, 207);
      font-style: italic;
      font-weight: bolder;
      border-bottom: 1px solid #6b6b6b;
      border-radius: 10px;
      transform: scale(1.05) translateX(5px) translatey(5px) rotate(0deg);          

      /* margin-bottom: 2rem; */
    }

  

    .confirmation {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.9);
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
  }

  .confirmation p {
    margin: 10px 0 0 0;
    font-size: 16px;
    color: #333;
  }



  .confirmation p {
    font-size: 18px;
    margin-bottom: 30px;
  }

  .confirmation button {
    width: auto;
    height: auto;
    padding: 10px 20px;
    font-size: 16px;
    background-color: #2c3e50;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s;
  }

  .confirmation button:hover {
    background-color: #34495e;
  }

  .spinner {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 80px;
    height: 80px;
    border: 4px dashed #363f3f;
    border-radius: 50%;
    position: relative;
    animation: nonlinearSpin 4.2s infinite;
    animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  .bot-icon {
    width: 100%;
    height: 100%;
    color: #363f3f;
  }

  @keyframes nonlinearSpin {
    0% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(1080deg);
    }
    50% {
      transform: rotate(0deg);
    }
    75% {
      transform: rotate(1080deg);
    }
    100% {
      transform: rotate(2160deg);
    }
  }


  
</style>