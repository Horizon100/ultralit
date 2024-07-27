<script lang="ts">
  import { writable } from 'svelte/store';

  let userInput = '';
  let agentOutput = '';
  let selectedAssistant = 1;
  let editingName = false;
  let editingPrompt = false;
  let tempName = '';
  let newAssistantName = '';

  const assistants = writable([
    { id: 1, name: 'Assistant 1', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Callie', defaultMessage: 'Hello, I am Assistant 1. How can I help you today?', prompt: '' },
    { id: 2, name: 'Assistant 2', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Felix', defaultMessage: 'Hi there! I am Assistant 2, ready to assist you with anything you need.', prompt: '' },
    { id: 3, name: 'Assistant 3', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Aneka', defaultMessage: 'Greetings! I am Assistant 3. Feel free to ask me anything!', prompt: '' },
  ]);

  $: selectedAssistantMessage = $assistants.find(a => a.id === selectedAssistant)?.defaultMessage || '';
  $: selectedAssistantPrompt = $assistants.find(a => a.id === selectedAssistant)?.prompt || '';

  function handleInput() {
    // Process user input here
  }

  function handleFileDrop(event: DragEvent) {
    // Handle file drop logic here
  }

  function selectAssistant(id: number) {
    selectedAssistant = id;
  }

  function saveAssistantPrompt() {
    assistants.update(list =>
      list.map(a => a.id === selectedAssistant ? { ...a, prompt: selectedAssistantPrompt } : a)
    );
  }

  function startEditingName() {
    editingName = true;
    tempName = $assistants.find(a => a.id === selectedAssistant)?.name || '';
  }

  function saveName(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      assistants.update(list =>
        list.map(a => a.id === selectedAssistant ? { ...a, name: tempName } : a)
      );
      editingName = false;
    }
  }

  function togglePromptEdit() {
    editingPrompt = !editingPrompt;
    if (!editingPrompt) {
      saveAssistantPrompt();
    }
  }

  function createNewAssistant() {
    const newId = Math.max(...$assistants.map(a => a.id)) + 1;
    const newAssistant = {
      id: newId,
      name: newAssistantName || `Assistant ${newId}`,
      avatar: 'https://via.placeholder.com/150',
      defaultMessage: `Hello, I am ${newAssistantName || `Assistant ${newId}`}. How can I help you today?`,
      prompt: '',
    };

    assistants.update(list => [...list, newAssistant]);
    newAssistantName = '';
  }
</script>

<div class="assistant-wrapper">
  <div class="assistant">
    <div class="top-container"></div>
    
    <div class="middle-row">
      <div class="output-container">
        <p>{selectedAssistantMessage}</p>
      </div>
      <div class="agent-container">
        <div class="agent-display">
          <img
            src={$assistants.find(a => a.id === selectedAssistant)?.avatar}
            alt="avatar" />
        </div>
      </div>
    </div>
    
    <div class="bottom-container">
      <div class="input-container">
        <textarea bind:value={userInput} placeholder="Type your message here..."></textarea>
      </div>
    </div>
  </div>
  <div class="assistant-selector">
    <div class="assistant-list">
      {#each $assistants as assistant}
        <button class="assistant-button"
          class:selected={selectedAssistant === assistant.id}
          on:click={() => selectAssistant(assistant.id)}
          on:dblclick={startEditingName}>
          {#if editingName && selectedAssistant === assistant.id}
            <input class="ai-name-input"
              bind:value={tempName}
              on:keydown={saveName}
              on:blur={() => editingName = false}
              autofocus
            />
          {:else}
            {assistant.name}
          {/if}
        </button>
      {/each}
    </div>
    <div class="prompt-edit">
      <div class="prompt-display" on:dblclick={togglePromptEdit}>
        {#if editingPrompt}
          <div class="prompt-input-container">
            <textarea
              class="ai-prompt-input"
              bind:value={selectedAssistantPrompt}
              placeholder="Enter assistant prompt"
              on:keydown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  togglePromptEdit();
                }
              }}
              autofocus
            ></textarea>
            <button class="ok-button" on:click={togglePromptEdit}>OK</button>
          </div>
        {:else}
          <p>{selectedAssistantPrompt || 'No prompt set'}</p>
        {/if}
      </div>
    </div>
    
    <div class="new-assistant">
      <input bind:value={newAssistantName} placeholder="New assistant name..." />
      <button on:click={createNewAssistant}>+</button>
    </div>
  </div>
</div>
    
<style>
  .assistant-wrapper {
    display: flex;
    flex-direction: row;
    width: 100%;;
  }

  .assistant-selector {
    display: flex;
    flex-direction: column;
    height: max-content;
    width: 30%;
    overflow-y: auto;
    height: 90%;
    right: 0;
    bottom: 0;
    position: absolute;
    background-color: #1c1c1c;

  }

  .assistant-selector button {
    margin: 10px;
    padding: 10px;
    border-radius: 10px;
    background-color: #292929;
    color: white;
    border: none;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .assistant-selector button.selected {
    background-color: #4CAF50;
  }

  .assistant-selector input {
    margin: 10px;
    padding: 10px;
    border-radius: 10px;
    background-color: #292929;
    color: white;
    border: 1px solid #4CAF50;
  }

  .assistant {
    height: 450px;
    width: 70%;
    display: flex;
    flex-direction: column;
  }
  
  h1 {
    position: absolute;
    left: 20px;
    top: 30px;
  }
  
  .top-container {
    height: 5%;
    width: 100%;
  }
  
  .middle-row {
    height: 200px;
    display: flex;
    margin-bottom: 30px;
    margin-left: 20px;
  }
  
  .input-container {
    display: flex;
    width: 100%;
    overflow-x: hidden;
    overflow-y: hidden;
    position: absolute;
    top: 84%;
  }
  
  .agent-container {
    width: 400px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;  
  }
  
  .agent-display {
    display: flex;
  }

  .agent-display img {
    height: 200px; 
    width: 200px;
    justify-content: center;
    align-items: center;  
  }

  .agent-name {
    font-size: 20px;
    text-align: center;
    cursor: pointer;
  }

  .agent-name input {
    font-size: 20px;
    text-align: center;
    background: none;
    border: none;
    border-bottom: 1px solid white;
    color: white;
  }

  .agent-name input:focus {
    outline: none;
  }
  
  .bottom-container {
    height: 170px;
    display: flex;
    flex-direction: column;
    overflow-y: hidden;
    border-radius: 20px;
  }
  
  textarea {
    width: 100%; 
    resize: none;
    overflow-y: hidden;
    background-color: #292929;
    border-radius: 20px;
    padding: 10px;
    word-wrap: break-word;
    word-break: break-all;
    color: white; 
    border: none; 
    outline: none;
  }

  textarea:focus {
    outline: none;
  }

  .ai-name-input {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 50px;
    resize: none;
    overflow-y: hidden;
    background-color: #ff0000;
    border-radius: 20px;
    padding: 10px;
  }

  .ai-prompt-input {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    width: 80%;
    height: auto;
    resize: none;
    overflow-y: hidden;
    background-color: #292929;
    border-radius: 20px;
    padding: 10px;
    word-wrap: break-word;
    word-break: break-all;
  }

  .assistant-button {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 80%;
    height: 50px;
    resize: none;
    overflow-x: hidden;
    overflow-y: hidden;
    background-color: #292929;
    border-radius: 20px;
  }

  .assistant-list {
    max-height: 300px;
    padding: 20px;
    overflow-y: auto;
    background-color: #333333;
  }

  .new-assistant {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    background-color: #1c1c1c;
    position: absolute;
    top: 78%;
    width: 100%;
    margin-top: 10px;
  }

  .new-assistant input {
    width: 60%;
    margin-right: 0;
  }

  .new-assistant button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 40px;
    background-color: #4CAF50;
    color: white;
    border: none;
    margin-left: 10px;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;  }

  .output-container {
    display: flex;
    width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 10px;
    background-color: #292929;
    border-radius: 20px;
    color: white;
  }

  .prompt-edit {
    position: sticky;
    bottom: 0;
    background-color: #1c1c1c;
    padding: 10px;
  }

  .prompt-display {
    display: flex;
    height: 50px;
  }

  .prompt-input-container {
    display: flex;
    align-items: center;
  }

  .ok-button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #4CAF50;
    color: white;
    border: none;
    margin-left: 10px;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>