<!-- src/Chat.svelte -->
<script>
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  let input = '';
  const messages = writable([]);

  function sendMessage() {
    if (input.trim() === '') return;

    messages.update(msgs => [...msgs, { type: 'user', text: input }]);
    input = '';

    setTimeout(() => {
      const botReply = { type: 'bot', text: 'This is a bot reply!' };
      messages.update(msgs => [...msgs, botReply]);
    }, 1000); // Simulating bot response delay
  }
</script>

<div class="chat-container">
  <div class="messages">
    {#each $messages as message}
      <div class="message {message.type}">
        {message.text}
      </div>
    {/each}
  </div>
  <div class="input-container">
    <input type="text" bind:value={input} placeholder="Type your message..." on:keydown={(e) => e.key === 'Enter' && sendMessage()} />
    <button on:click={sendMessage}>Send</button>
  </div>
</div>

<style>
  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-width: 600px;
    margin: 0 auto;
    border: 1px solid #ccc;
    border-radius: 8px;
    overflow: hidden;
  }
  .messages {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
  }
  .message {
    padding: 0.5rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
  }
  .message.user {
    background-color: #daf8cb;
    align-self: flex-end;
  }
  .message.bot {
    background-color: #f0f0f0;
    align-self: flex-start;
  }
  .input-container {
    display: flex;
    padding: 1rem;
    border-top: 1px solid #ccc;
  }
  input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin-right: 0.5rem;
  }
  button {
    padding: 0.5rem 1rem;
    border: none;
    background-color: #007bff;
    color: white;
    border-radius: 4px;
    cursor: pointer;
  }
</style>