<script lang="ts">
  import { onMount } from 'svelte';

  let mouseX = 0;
  let mouseY = 0;
  let trailingMouseX = 0;
  let trailingMouseY = 0;
  
  const delay = 0.1;
  const positions: { x: number; y: number }[] = [];
  const trailLength = 10;

  let lastMouseActivity = Date.now();
  let isAnimating = false;
  let animationPhase = 0;

  function updateTrail() {
    const currentTime = Date.now();

    if (currentTime - lastMouseActivity > 5000 && !isAnimating) {
      isAnimating = true;
      animationPhase = 0;
    }

    if (isAnimating) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const radius = 50;
      
      mouseX = centerX + Math.cos(animationPhase) * radius * 2;
      mouseY = centerY + Math.sin(animationPhase * 2) * radius;

      animationPhase += 0.02;
      if (animationPhase >= Math.PI * 2) {
        animationPhase = 0;
      }
    }

    positions.push({ x: mouseX, y: mouseY });
    if (positions.length > trailLength) {
      positions.shift();
    }

    const { x, y } = positions[0];
    trailingMouseX += (x - trailingMouseX) * delay;
    trailingMouseY += (y - trailingMouseY) * delay;

    requestAnimationFrame(updateTrail);
  }

  function handleMouseMove(event: MouseEvent) {
    mouseX = event.clientX;
    mouseY = event.clientY;
    lastMouseActivity = Date.now();
    isAnimating = false;
  }

  onMount(() => {
    window.addEventListener('mousemove', handleMouseMove);
    updateTrail();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  });
</script>
<style>
  .cursor-trail {
    position: fixed;
    top: 0;
    left: 0;
    width: 20px;
    height: 20px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 50%;
    pointer-events: none;
    transform: translate(-50%, -50%);
  }
</style>
<div class="cursor-trail" style="transform: translate({trailingMouseX}px, {trailingMouseY}px);"></div>