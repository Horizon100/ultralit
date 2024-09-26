<script lang="ts">
    import { onMount } from 'svelte';

    export let text: string;
    export let minSpeed: number = 2;
    export let maxSpeed: number = 10;

    let displayText = '';
    let index = 0;
    let showCursor = true;

    function getRandomSpeed() {
        return Math.floor(Math.random() * (maxSpeed - minSpeed + 1)) + minSpeed;
    }

    function typeNextCharacter() {
        if (index < text.length) {
            displayText += text[index];
            index++;
            
            const delay = text[index - 1] === ' ' ? getRandomSpeed() * 5 : getRandomSpeed();
            setTimeout(typeNextCharacter, delay);
        }
    }

    onMount(() => {
        typeNextCharacter();

        const cursorInterval = setInterval(() => {
            showCursor = !showCursor;
        }, 500);

        return () => clearInterval(cursorInterval);
    });
</script>

<p>{displayText}<span class:blink={showCursor}>|</span></p>

<style>
    p {
        display: flex;
        line-height: 1.5;
        text-align: justify;
        font-size: 1.2rem;
        color: #fff;
        margin-top: 2rem;
        font-size: 24px;
        white-space: pre-wrap;
    }

    .blink {
        opacity: 0;
        transition: opacity 0.1s;
    }
</style>