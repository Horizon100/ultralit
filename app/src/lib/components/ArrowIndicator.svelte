<script lang="ts">
    import { fade, fly } from 'svelte/transition';
    import { createEventDispatcher } from 'svelte';
    
    const dispatch = createEventDispatcher();
    
    function handleClick() {
        dispatch('click');
    }
    </script>
    
    <div class="arrow-container" on:click={handleClick} transition:fade>
        <div class="arrow" in:fly="{{ y: 20, duration: 500 }}" out:fade>
            ↑
            <p>Get started by signing up. </p>
        </div>
    </div>
    
    <style>
        .arrow-container {
            position: fixed;
            top: -50px;
            z-index: 1040;
            left: 50%;
            transform: translateX(-50%);
            cursor: pointer;
        }
    
        .arrow {
            font-size: 20rem;
            color: #6fdfc3;
            animation: bounce 1s infinite;
            transition: transform 0.5s ease-in-out, filter 0.5s ease-in-out;
            filter: drop-shadow(0 2em 3em #2e2d2d);
            will-change: filter, transform;
            opacity: 40%;
            border-radius: 50px;
            padding: 10px;
        }
        
        .arrow:hover {
            transition: filter 300ms, transform 300ms ease-in-out; 
            background-color: green; 
                  
        }

        p {
            font-size: 20px;
            text-align: center;
            display: flex;
            padding: 10px;
            position: absolute;
            bottom: 10px;
            text-decoration:dotted;
            border-radius: 20px;
            background-color: rgb(0, 0, 0);
            opacity: 0.9;


        }


    
        @keyframes bounce {
            0%, 100% {
                transform: translateY(0);
            }
            50% {
                transform: translateY(-10px);
            }
        }
    </style>