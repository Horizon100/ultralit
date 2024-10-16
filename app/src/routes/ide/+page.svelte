<script lang="ts">
    import { onMount } from 'svelte';
    import { currentUser } from '$lib/pocketbase';
    import { page } from '$app/stores';
    import { slide } from 'svelte/transition';
    import { Folder, Search, Bookmark, Play, Bug, Settings } from 'lucide-svelte';

    // TODO: Uncomment and install these packages when ready to implement full editor
    // import CodeMirror from 'svelte-codemirror-editor';
    // import { javascript } from '@codemirror/lang-javascript';
    // import { oneDark } from '@codemirror/theme-one-dark';

    $: user = $currentUser;

    let activeSection: 'explorer' | 'search' | 'debug' = 'explorer';
    let codeContent = '';
    let outputContent = '';
    let debugOutput = '';

    function setActiveSection(section: 'explorer' | 'search' | 'debug') {
        activeSection = section;
    }

    function runCode() {
        // TODO: Implement code execution logic
        outputContent = "Code execution output will appear here";
    }

    function debugCode() {
        // TODO: Implement debugging logic
        debugOutput = "Debugging information will appear here";
    }

    function buildProject() {
        // TODO: Implement build automation logic
        console.log("Building project...");
    }

    onMount(() => {
        user = $currentUser;
        // Additional initialization if needed
    });
</script>

<div class="container">
    <div class="sidebar">
        <button class:active={activeSection === 'explorer'} on:click={() => setActiveSection('explorer')} aria-label="File Explorer">
            <Folder size={24} />
        </button>
        <button class:active={activeSection === 'search'} on:click={() => setActiveSection('search')} aria-label="Search">
            <Search size={24} />
        </button>
        <button class:active={activeSection === 'debug'} on:click={() => setActiveSection('debug')} aria-label="Debug">
            <Bug size={24} />
        </button>
        <button on:click={buildProject} aria-label="Build Project">
            <Settings size={24} />
        </button>
    </div>

    <div class="explorer" class:active={activeSection === 'explorer'}>
        <h3>File Explorer</h3>
        <!-- Add file tree structure here -->
    </div>

    <div class="main-content">
        <div class="editor">
            <textarea bind:value={codeContent} placeholder="Enter your code here"></textarea>
        </div>
        <div class="output-panel">
            <div class="tabs">
                <button class:active={activeSection !== 'debug'} on:click={() => setActiveSection('explorer')}>Output</button>
                <button class:active={activeSection === 'debug'} on:click={() => setActiveSection('debug')}>Debug</button>
            </div>
            <div class="output-content">
                {#if activeSection === 'debug'}
                    <pre>{debugOutput}</pre>
                {:else}
                    <pre>{outputContent}</pre>
                {/if}
            </div>
        </div>
    </div>
</div>

<div class="toolbar">
    <button on:click={runCode}><Play size={16} /> Run</button>
    <button on:click={debugCode}><Bug size={16} /> Debug</button>
    <button on:click={buildProject}><Settings size={16} /> Build</button>
</div>

<style>
    .container {
        position: absolute;
        display: flex;
        width: 96%;
        top: 60px;
        right: 2%;
        height: 90vh;
        background-color: #010e0e;
        border-radius: 40px;
        overflow: hidden;
    }

    .sidebar {
        width: 50px;
        background-color: #151515;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 20px;
    }

    .sidebar button {
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        padding: 10px;
        margin-bottom: 10px;
        border-radius: 4px;
        transition: background-color 0.3s ease;
    }

    .sidebar button:hover,
    .sidebar button.active {
        background-color: rgba(255, 255, 255, 0.1);
        color: white;
    }

    .explorer {
        width: 250px;
        background-color: #1a1a1a;
        color: white;
        padding: 10px;
        display: none;
    }

    .explorer.active {
        display: block;
    }

    .main-content {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }

    .editor {
        flex-grow: 1;
        padding: 10px;
    }

    textarea {
        width: 100%;
        height: 100%;
        background-color: #1e1e1e;
        color: white;
        border: none;
        resize: none;
        font-family: monospace;
    }

    .output-panel {
        height: 200px;
        background-color: #252525;
        color: white;
    }

    .tabs {
        display: flex;
        background-color: #333;
    }

    .tabs button {
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        padding: 10px 15px;
        transition: background-color 0.3s ease;
    }

    .tabs button.active {
        background-color: #252525;
        color: white;
    }

    .output-content {
        height: calc(100% - 40px);
        overflow-y: auto;
        padding: 10px;
    }

    .toolbar {
        position: absolute;
        bottom: 20px;
        right: 20px;
        display: flex;
        gap: 10px;
    }

    .toolbar button {
        display: flex;
        align-items: center;
        gap: 5px;
        background-color: #4a4a4a;
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }

    .toolbar button:hover {
        background-color: #5a5a5a;
    }
</style>