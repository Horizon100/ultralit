<script lang="ts">
    import { onDestroy } from 'svelte';

    let isTracking = false;
    let seconds = 0;
    let interval: number;

    $: hours = Math.floor(seconds / 3600);
    $: minutes = Math.floor((seconds % 3600) / 60);
    $: remainingSeconds = seconds % 60;

    $: timeDisplay = [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        remainingSeconds.toString().padStart(2, '0')
    ].join(':');

    function toggleTracking() {
        if (isTracking) {
            stopTracking();
        } else {
            startTracking();
        }
    }

    function startTracking() {
        isTracking = true;
        interval = setInterval(() => {
            seconds++;
        }, 1000);
    }

    function stopTracking() {
        isTracking = false;
        clearInterval(interval);
    }

    function resetAndStart() {
        seconds = 0;
        startTracking();
    }

    onDestroy(() => {
        if (interval) clearInterval(interval);
    });
</script>

<div class="time-tracker" class:tracking={isTracking}>
    <button on:click={isTracking ? stopTracking : resetAndStart}>
        {isTracking ? 'Stop' : 'Track'}
    </button>
    {#if isTracking}
        <span class="time-display">{timeDisplay}</span>
    {/if}
</div>

<style>
    .time-tracker {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        position: absolute;
        left: 50px;
        height: 50px;
        width: 100px;
        padding: 0 15px;
        /* background-color: #2c3e50; */
        border-radius: 25px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: width 0.3s ease;
    }

    .time-tracker.tracking {
        width: 200px;
        justify-content: space-between;
        background-color: #2c3e50;

    }

    button {
        background-color: #e74c3c;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.3s ease;
    }

    button:hover {
        background-color: #c0392b;
    }

    .time-display {
        font-family: 'Courier New', Courier, monospace;
        font-size: 1.2em;
        color: #ecf0f1;
    }
</style>