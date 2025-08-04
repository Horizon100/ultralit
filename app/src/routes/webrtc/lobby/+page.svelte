<script lang="ts">
  import { goto } from '$app/navigation';
  
  let roomName = '';
  let userName = '';

  async function createRoom() {
    const response = await fetch('/api/webrtc/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: roomName })
    });
    
    if (response.ok) {
      const room = await response.json();
      goto(`/webrtc/room/${room.roomId}`);
    }
  }
</script>

<main>

<div class="lobby">
  <div class="lobby-wrapper">
  <h1>Join or Create a Room</h1>
  <input bind:value={roomName} placeholder="Room name" />
  <input bind:value={userName} placeholder="Your name" />
  <button on:click={createRoom}>Create Room</button>
</div>
 </div>
</main>

<style lang="scss">
	:root {
		font-family: var(--font-family);
	}	
	* {
		font-family: var(--font-family);
	}	

  .lobby {
    display: flex;
    justify-content: center;
    align-items: center;
    height: calc(100vh - 4rem);
    		background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 60%);

  }

  .lobby-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    max-width: 400px;
    width: 100%;
    
    & h1 {
      color: var(--tertiary-color);
      text-align: center;
    }
    & input {
      padding: 0.5rem 1rem;
      margin-bottom: 0.5rem;
      border-radius: 1rem;
      border: 1px solid var(--line-color);
      background: var(--secondary-color);
      font-size: 1rem;
      color: var(--placeholder-color);
      width: calc(100% - 2rem);
      &:focus {
        color: var(--text-color);
        border: 1px solid var(--tertiary-color);
        outline: none;
        background: var(--primary-color);
      }
    }
    & button {
      padding: 0.5rem 1rem;
      width: 100%;
      border-radius: 2rem;
      border: 1px solid var(--line-color);
      background: var(--primary-color);
      color: var(--placeholder-color);
      font-size: 1.2rem;
      cursor: pointer;
      transition: transform 0.2s ease;
      &:hover {
        transform: scale(1.1);
        color: var(--tertiary-color);
      }
    }
  }

</style>