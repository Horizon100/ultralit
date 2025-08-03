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

<div class="lobby">
  <h1>Join or Create a Room</h1>
  <input bind:value={roomName} placeholder="Room name" />
  <input bind:value={userName} placeholder="Your name" />
  <button on:click={createRoom}>Create Room</button>
</div>
