<script>
    import { slide } from 'svelte/transition';
    import { ChevronDown } from 'lucide-svelte';

    export let title = '';
    export let features = [];
    export let isPro = false;

    let isExpanded = false;

    function toggleExpand() {
        isExpanded = !isExpanded;
    }
</script>

<div class="card-container">
    <div class="card" class:selected={isExpanded} on:click={toggleExpand}>
        <h3>{title}</h3>
        <span class="plan-type">{isPro ? 'Pro' : 'Free'}</span>
        <ul>
            {#each features.slice(0, 3) as feature}
                <li>{feature}</li>
            {/each}
        </ul>
        <span class="toggle-btn">
            <span class="icon-wrapper" class:rotated={isExpanded}>
                <ChevronDown size={24} color="white" />
            </span>
        </span>
    </div>

    {#if isExpanded}
        <div class="expanded-content" transition:slide={{ duration: 300 }}>
            <ul>
                {#each features.slice(3) as feature}
                    <li>{feature}</li>
                {/each}
            </ul>
        </div>
    {/if}
</div>

<style lang="scss">
	@use "src/themes.scss" as *;

    * {
		font-family: var(--font-family);

        /* font-family: 'Merriweather', serif; */
        /* font-family: Georgia, 'Times New Roman', Times, serif; */
    }
    .card-container {
        display: inline-block;
        min-width: 250px;
        max-width: 300px;
        margin: 1rem;
        vertical-align: top;
    }

    .card {
        background: var(--bg-gradient-r);
        padding: 2rem;
        text-align: center;
        transition: border 0.3s ease;
        position: relative;
        border: 1px solid var(--bg-color);
        border-radius: 20px;
        height: auto;
        z-index: 10;
        &.selected {
            border: 1px solid var(--tertiary-color);
            /* You can add more styles for the selected state here */
        }
    }

    .card:hover {
        border: 1px solid var(--tertiary-color);
    }



    .card h3 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
        color: #fff;
    }

    .plan-type {
        position: absolute;
        top: 10px;
        right: 10px;
        font-size: 0.9rem;
        padding: 0.2rem 0.5rem;
        border-radius: 5px;
        color: #000;
        background-color: #6fdfc4;
    }

    ul {
        list-style-type: none;
        padding: 0;
        margin-bottom: 2rem;
    }

    li {
        margin-bottom: 0.5rem;
        font-size: 1rem;
        color: #ccc;
    }

    .toggle-btn {
        background: none;
        border: none;
        cursor: pointer;
        position: absolute;
        bottom: 20px;
        right: 10px;
    }

    .toggle-btn:hover {
        opacity: 0.8;
    }

    .icon-wrapper {
        display: inline-block;
        transition: transform 0.3s ease;
    }

    .rotated {
        transform: rotate(180deg);
    }

    .expanded-content {
        background: var(--bg-gradient);
        position: relative;
        z-index: 11;
        margin-top: -17px;
        padding: 2rem;
        border-bottom-left-radius: 20px;
        border-bottom-right-radius: 20px;
        border-left: 1px solid var(--tertiary-color);
        border-right: 1px solid var(--tertiary-color);
        border-bottom: 1px solid var(--tertiary-color);
    }



    @media (max-width: 991px) {
        .card-container {
            width: calc(50% - 2rem);
        }
    }

    @media (max-width: 767px) {
        .card-container {
            width: 100%;
        }
    }
</style>