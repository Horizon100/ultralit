<script lang="ts">
    import { spring } from 'svelte/motion';
    import type { AIAgent } from '$lib/types';
  
    export let agents: AIAgent[];
    export let onAgentClick: (agent: AIAgent) => void;
  
    let selectedAgent: AIAgent | null = null;
  
    const coords = spring({ x: 0, y: 0, scale: 1 }, {
      stiffness: 0.2,
      damping: 0.4
    });
  
    function handleAgentClick(agent: AIAgent, event: MouseEvent) {
      if (selectedAgent === agent) {
        // Zoom out
        coords.set({ x: 0, y: 0, scale: 1 });
        selectedAgent = null;
      } else {
        // Zoom in
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        const x = window.innerWidth / 2 - (rect.left + rect.width / 2);
        const y = window.innerHeight / 2 - (rect.top + rect.height / 2);
        coords.set({ x, y, scale: 3 });
        selectedAgent = agent;
      }
      onAgentClick(agent);
    }
</script>

<div class="circular-view-container">
  <div class="circular-view" style="transform: translate({$coords.x}px, {$coords.y}px) scale({$coords.scale})">
    <div class="parent-circle">
      {#each agents as agent}
        <button
          class="child-circle"
          style="--angle: {(360 / agents.length) * agents.indexOf(agent)}deg"
          on:click={(e) => handleAgentClick(agent, e)}
        >
          {agent.name}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .circular-view-container {
    width: 100%;
    height: 100%;
    background-color: #363f3f;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;

  }

  .circular-view {
    /* transition: transform 0.3s ease; */
    transition: transform 0.6s cubic-bezier(0.075, 0.82, 0.165, 1) ease;

  }

  .parent-circle {
    width: 500px;
    height: 500px;
    border-radius: 50%;
    border: 3px solid #414d4d;
    background-color: #363f3f;
    background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
    transition: background 0.6s cubic-bezier(0.075, 0.82, 0.165, 1) ease;

    /* left: 10%; */
    /* top: 50%; */
    /* position: relative; */

  }

  .parent-circle:hover {
    background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 90%);
    background-color: #363f3f;

  }

  .child-circle {
    position: absolute;
    width: 70px;
    height: 70px;
    border-radius: 50%;
    background-color: #414d4d;
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 10px;
    text-align: center;
    position: fixed;
    left: 44%;
    top: 45%;
    cursor: pointer;
    border: 1px solid #363f3f;
    transform: rotate(var(--angle)) translate(200px) rotate(calc(-1 * var(--angle)));
    transition: all 0.6s cubic-bezier(0.075, 0.82, 0.165, 1) ease;
  }

  .child-circle:hover {
    background-color: black;
    /* scale: 1.4; */
  }

  .child-circle:hover {
    /* transform: rotate(var(--angle)) translate(150px) rotate(calc(-1 * var(--angle))) scale(1.1); */
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
  }
</style>