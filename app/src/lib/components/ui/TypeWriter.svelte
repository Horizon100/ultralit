<script lang="ts">
    import { onMount } from 'svelte';

    export let text: string;
    export let minSpeed: number = 2;
    export let maxSpeed: number = 10;

    let displayText = '';
    let index = 0;
    let showCursor = true;
    let isTypingComplete = false;

    function getRandomSpeed() {
        return Math.floor(Math.random() * (maxSpeed - minSpeed + 1)) + minSpeed;
    }

    function typeNextCharacter() {
        if (index < text.length) {
            displayText += text[index];
            index++;
            
            const delay = text[index - 1] === ' ' ? getRandomSpeed() * 5 : getRandomSpeed();
            setTimeout(typeNextCharacter, delay);
        } else {
            isTypingComplete = true;
            showCursor = true; // Ensure cursor is visible when typing is complete
        }
    }

    onMount(() => {
        typeNextCharacter();

        const cursorInterval = setInterval(() => {
            if (!isTypingComplete) {
                showCursor = !showCursor;
            }
        }, 500);

        return () => clearInterval(cursorInterval);
    });
</script>

<p>{displayText}{#if !isTypingComplete}<span class:blink={!showCursor}>|</span>{/if}</p>


<style lang="scss">
	@use "src/themes.scss" as *;

    
    p {
        line-height: 1.5;
        text-align: justify;
        
        font-size: 1.2rem;
		color: var(--text-color);
        margin-top: 2rem;
        font-size: 32px;
        // width: 50%;
        // margin-left: 25%;
        display: flex;
    }

    .blink {
        opacity: 0;
        transition: opacity 0.1s;
    }

    // @media (max-width: 1199px) {
    //     p {
    //         width: 90%;
    //         margin-left: 5%;
    //     }
    // }

    

    @media (max-width: 767px) {
        p {
            font-size: 1.5rem;
        }
    }
</style>