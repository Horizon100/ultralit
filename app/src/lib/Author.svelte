<script>
    import { onMount } from 'svelte';
    let activeTab = 'about'; // Default tab

    const tabs = [
        { id: 'about', label: 'About' },
        { id: 'activities', label: 'Activities' },
        { id: 'media', label: 'Media' },
        { id: 'projects', label: 'Projects' },
        { id: 'achievements', label: 'Achievements' }
    ];

    function handleTabChange(tabId) {
        activeTab = tabId;
    }
</script>

<div class="author-container">
    <div class="tab-bar">
        {#each tabs as tab}
            <button
                class={activeTab === tab.id ? 'active' : ''}
                on:click={() => handleTabChange(tab.id)}
            >
                {tab.label}
            </button>
        {/each}
    </div>

 

    <div class="content">
        {#if activeTab === 'about'}
            <div class="avatar-container">
                <img
                    class="avatar"
                    src={`https://api.dicebear.com/9.x/notionists/svg?seed=stylized`}
                    alt="avatar"
                    width="300px"
                />
        
                <div class="hex-container">
                    <div class="hex">
                        <p class="hex-text">Bio</p>
                    </div>
                    <div class="hex">
                        <p class="hex-text">Projects</p>
                    </div>
                    <div class="hex">
                        <p class="hex-text">Media</p>
                    </div>
                    <div class="hex">
                        <p class="hex-text">Activities</p>
                    </div>
                    <div class="hex">
                        <p class="hex-text">Achievements</p>
                    </div>
                </div>
            </div>
        {/if}
        {#if activeTab === 'activities'}
            <div>Activities Content</div>
        {/if}
        {#if activeTab === 'media'}
            <div>Media Content</div>
        {/if}
        {#if activeTab === 'projects'}
            <div>Projects Content</div>
        {/if}
        {#if activeTab === 'achievements'}
            <div>Achievements Content</div>
        {/if}
    </div>
</div>

<style>
    .author-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
    }

    .tab-bar {
        margin-bottom: 20px;
    }

    .tab-bar button {
        background-color: #f0f0f0;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 10px 20px;
        margin: 0 5px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s;
    }

    .tab-bar button.active {
        background-color: #007bff;
        color: #fff;
    }

    .avatar-container {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
        width: 100%;
        max-width: 1200px;
        gap: 20px; /* Space between avatar and hex container */
    }

    .avatar {
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
    }

    .hex-container {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: center;
        align-items: center;
    }

    .hex {
        width: 100px;
        height: 100px;
        background: #f9f9f9;
        border: 1px solid #ddd;
        display: flex;
        align-items: center;
        justify-content: center;
        clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
        box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
    }

    .hex-text {
        text-align: center;
        font-size: 12px;
        color: #333;
    }

    .content {
        margin-top: 20px;
    }
</style>