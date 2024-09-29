<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { page } from '$app/stores';
  import { slide, fly, fade} from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  import { goto } from '$app/navigation';
  import { Plus, List, Box, X, Trash2, Check, LayoutGrid } from 'lucide-svelte';
  import Space from '$lib/assets/icons/launcher/space.svg';
  import Add from '$lib/assets/icons/launcher/add.svg';
  import { workspaceStore } from '$lib/stores/workspaceStore';
  import { createWorkspace, getWorkspaces, deleteWorkspace, updateWorkspace } from '$lib/workspaceClient';
  import { currentUser } from '$lib/pocketbase';
  import type { Workspaces } from '$lib/types';
  import Chatlinks from '$lib/assets/icons/ai/chatlinks.svg';
	import { Chat } from 'openai/resources/index.mjs';
  import { quotes } from '$lib/quotes';
  // import Builder from '$lib/components/ui/Builder.svelte'
  import WorkspaceCreator from '$lib/components/ui/WorkspaceCreator.svelte';
  import Builder from '$lib/components/ui/Builder.svelte'
  import greekImage from '$lib/assets/illustrations/greek.png';

  let workspaces: Workspaces[] = [];
  let currentWorkspace: Workspaces | undefined;
  let currentQuote = quotes[Math.floor(Math.random() * quotes.length)];

  
    let isScrolling = false;
    let startX: number;
    let scrollLeft: number;
    let showWorkspaceList = false;

    let editingWorkspace: string | null = null;
    let editedName: string = '';
    let confirmationMessage: string | null = null;
    let textareaElement: HTMLTextAreaElement | null = null;


    let showBuilder = false;



  onMount(async () => {
  if ($currentUser && $currentUser.id) {
    try {
      const workspaceId = $page.params.workspaceId;
      
      workspaceStore.subscribe(state => {
        workspaces = state.workspaces;
        currentWorkspace = workspaces.find(w => w.id === workspaceId);
      });
      
      // If you need to load workspaces initially, you can do it here
      await workspaceStore.loadWorkspaces($currentUser.id);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }
  }

    if (textareaElement) {
      const adjustTextareaHeight = () => {
        if (textareaElement) {
          textareaElement.style.height = 'auto';
          textareaElement.style.height = `${Math.min(textareaElement.scrollHeight, )}px`;
        }
      };

      textareaElement.addEventListener('input', adjustTextareaHeight);
      adjustTextareaHeight();

      if (!showChat) {
        textareaElement.focus();
      }

      return undefined;

    }
  });
  
    async function addNewWorkspace() {
      if ($currentUser && $currentUser.id) {
        const newWorkspace: Partial<Workspaces> = {
          name: `New Workspace ${workspaces.length + 1}`,
          description: 'A new workspace',
          created_by: $currentUser.id,
          collaborators: [$currentUser.id],
        };

        try {
          const createdWorkspace = await createWorkspace(newWorkspace);
          workspaceStore.addWorkspace(createdWorkspace);
        } catch (error) {
          console.error('Error creating new workspace:', error);
        }
      }
    }

    function selectWorkspace(workspaceId: string) {
      goto(`/launcher/workspace/${workspaceId}`);
    }

    function handleMouseDown(e: MouseEvent) {
      isScrolling = true;
      startX = e.pageX - e.currentTarget.offsetLeft;
      scrollLeft = e.currentTarget.scrollLeft;
      e.currentTarget.style.cursor = 'grabbing';
    }

    function handleMouseLeave(e: MouseEvent) {
      isScrolling = false;
      e.currentTarget.style.cursor = 'grab';
    }

    function handleMouseUp(e: MouseEvent) {
      isScrolling = false;
      e.currentTarget.style.cursor = 'grab';
    }

    function handleMouseMove(e: MouseEvent) {
      if (!isScrolling) return;
      e.preventDefault();
      const x = e.pageX - e.currentTarget.offsetLeft;
      const walk = (x - startX) * 2;
      e.currentTarget.scrollLeft = scrollLeft - walk;
    }

    function toggleWorkspaceList() {
    showWorkspaceList = !showWorkspaceList;
  }

  function closeWorkspaceList(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      showWorkspaceList = false;
    }
  }

  async function handleDeleteWorkspace(workspaceId: string) {
        if (confirm('Are you sure you want to delete this workspace?')) {
            try {
                await deleteWorkspace(workspaceId);
                workspaceStore.removeWorkspace(workspaceId);
                showConfirmation('Workspace deleted successfully');
            } catch (error) {
                console.error('Error deleting workspace:', error);
                showConfirmation('Error deleting workspace', true);
            }
        }
    }

    function startEditingWorkspace(workspace: Workspaces) {
        editingWorkspace = workspace.id;
        editedName = workspace.name;
    }

    async function saveEditedWorkspace(workspace: Workspaces) {
        if (editedName.trim() !== '' && editedName !== workspace.name) {
            try {
                const updatedWorkspace = await updateWorkspace(workspace.id, { name: editedName });
                workspaceStore.updateWorkspace(updatedWorkspace);
                showConfirmation('Workspace name updated successfully');
            } catch (error) {
                console.error('Error updating workspace name:', error);
                showConfirmation('Error updating workspace name', true);
            }
        }
        editingWorkspace = null;
    }

    function showConfirmation(message: string, isError: boolean = false) {
        confirmationMessage = message;
        setTimeout(() => {
            confirmationMessage = null;
        }, 3000);
    }

    async function handleAddNewWorkspace() {
        try {
            const createdWorkspace = await addNewWorkspace();
            showConfirmation('New workspace created successfully');
        } catch (error) {
            console.error('Error creating new workspace:', error);
            showConfirmation('Error creating new workspace', true);
        }
    }

    function handleAuthSuccess() {
    // The user is now authenticated, you can proceed with workspace creation
    // This might involve calling handleGetStarted again or setting a flag
  }

  function toggleBuilder() {
    showBuilder = !showBuilder;
  }

  </script>
  



  <!-- <div class="landing-page" in:fly="{{ y: -200, duration: 500 }}" out:fade="{{ duration: 300 }}">
    </div> -->

   
  <!-- <div class="grid-container">
    <div class="grid-item">
      <img src={Chatlinks} alt="Chatlinks" class="landing pulsing-svg" />



    </div>
    <div class="grid-item">
        <button class="cta-button" on:click={showWorkspaceList} transition:slide="{{ duration: 300, easing: quintOut }}">
          Get started
        </button>
    </div>
    <div class="grid-item">
      <button class="cta-button" on:click={showWorkspaceList} transition:slide="{{ duration: 300, easing: quintOut }}">
        Get started
      </button>
    </div>
  </div> -->

  
<!-- <div class="workspace-container"> -->
  <!-- <div class="landing-page" in:fly="{{ y: -200, duration: 500 }}" out:fade="{{ duration: 300 }}">
    <div class="half-container">
      <h1>vRazum</h1>
      <h2>AI-Powered Automation Engine</h2>
      <img src={Chatlinks} alt="Chatlinks" class="landing pulsing-svg" />
    </div>
  </div> -->
    

  <!-- <div class="hero-container">
    <div class="half-container">
      <h2>Unlock Unmatched Efficiency with AI-Driven Goal Management.</h2>
      <Builder/>
      <p>We optimize your workflow with AI that anticipates and accelerates your progress.</p>
    </div>
  </div> -->
  <main>
    <button class="toggle-button" on:click={toggleBuilder}>
      {showBuilder ? 'X' : '+ New Workspace'}
    </button>
    
    {#if showBuilder}
      <Builder/>
    {/if}
  </main>

  
  <style>

main {
  display: flex;
    border-radius: 40px;
    padding: 10px;
    height: 94vh;
    width: 90%;
    height: 100%;
    /* position: absolute; */
    top: 80px;
    /* min-width: 400px; */
    background-color:#010e0e;
    /* width: 50%; */
    /* left: 2rem; */
    /* transform: translate(-50%, 0%); */
    /* border-radius: 80px; */
    /* background-color: red; */
    transition: all 1.2s ease-in-out;
    /* z-index: 1000; */
    
  }

    .columns {
      display: flex;
      flex-direction: row;
      width: 100%;

    }

    .footer {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: auto;
      /* background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%); */
      /* opacity: 0.5; */


    }



    .workspace-menu {
      display: flex;
      margin: 0 auto;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      overflow-x: hidden;
      overflow-y: hidden;
      /* scroll-behavior: smooth; */
      width: 96%;
      margin-left: 2%;
      /* background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%); */
      height: 80px;
      margin-bottom: 10px;
      
      
    }

    .menu-button {
      padding: 10px 20px;
      border: none;
      border-radius: 20px;
      background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 20%);
      color: #838383;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60px;
      width: 60px;
      gap: 5px;
      text-align: center;
      font-size: 24px;
      
      transition: background 0.3s, transform 0.3s;
    }

    .menu-button:hover {
      background-color: #f0f0f0;
      transform: background 0.3s, transform 0.3s; 
      color: #3278a6;
    }
    
    .workspace-selector {
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0;
      width: 500px;
      height: 100vh;
      overflow-y: auto;
      padding: 20px;
      background: linear-gradient(
        90deg,
        rgba(117, 118, 114, 0.9) 0%,
        rgba(0, 0, 0, 0.85) 100%
      );
      backdrop-filter: blur(10px);
    }

    .workspace-selector::-webkit-scrollbar {
      height: 12px;
    }

    .workspace-selector::-webkit-scrollbar-thumb {
      background-color: rgba(255, 255, 255, 0.5);
      border-radius: 6px;
      width: 100px;
    }

    .workspace-selector::-webkit-scrollbar-track {
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
    }

    .workspace-button {
        padding: 10px 10px;
        background-color: #4b4b49;
        color: white;
        border: none;
        border-radius: 14px;
        cursor: pointer;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        /* height: 50px; */
        width: 200px;
        height: 60px;
        gap: 5px;
        text-align: center;
        font-size: 18px;
        margin-left: 5px;
        transition: background-color 0.3s, transform 0.3s;
        scroll-snap-align: start;

    }


    .workspace-button.new {
        color: rgb(71, 223, 165);
    }

    .workspace-button:hover {
        background-color: #f0f0f0;
        transform: scale(1.05); 
    }

    /* If you need different hover styles for .new button specifically */
    .workspace-button.new:hover {
        background-color: #45a049; /* Darker green on hover */
    }
  
  .overlay {
    position: fixed;
    bottom: 80px;
    left: 0;
    right: 0;
    height: 100vh;
    background: linear-gradient (
        90deg,
        rgba(117, 118, 114, 0.9) 0%,
        rgba(0, 0, 0, 0.85) 5%,
        rgba(117, 118, 114, 0.8) 10%,
        rgba(117, 118, 114, 0.75) 15%,
        rgba(117, 118, 114, 0.7) 20%,
        rgba(0, 0, 0, 0.65) 25%,
        rgba(117, 118, 114, 0.6) 30%,
        rgba(0, 0, 0, 0.55) 35%,
        rgba(0, 0, 0, 0.5) 40%,
        rgba(117, 118, 114, 0.45) 45%,
        rgba(0, 0, 0, 0.4) 50%,
        rgba(0, 0, 0, 0.35) 55%,
        rgba(117, 118, 114, 0.3) 60%,
        rgba(117, 118, 114, 0.25) 65%,
        rgba(117, 118, 114, 0.2) 70%,
        rgba(117, 118, 114, 0.15) 75%,
        rgba(0, 0, 0, 0.1) 80%,
        rgba(1, 1, 1, 0.05) 85%,
        rgba(117, 118, 114, 0) 100%
      );
      backdrop-filter: blur(10px);

        /* opacity: 0.8; */
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    /* z-index: 2000; */
    /* gap: 40px; */

  }

  .overlay-handle {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    height: 80px;
    /* background-color: #1c1b1d; */
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
  }

  .lists-container {
    display: flex;
    flex-direction: column;
    /* gap: 20px; */
    /* padding: 20px; */
    background-color: #1c1b1d;
    background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 90%);
    width: 100%;
    border-bottom-left-radius: 20px;
    border-bottom-right-radius: 20px;
    
  }

  .workspace-list {
    background-color: #1c1b1d;
    /* border-top-left-radius: 20px; */
    /* border-top-right-radius: 20px; */
    /* padding: 20px; */
    max-height: calc(80vh - 40px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    /* height: auto; */
    border-radius: 20px;
    /* width: 96%; */
    /* justify-content: center; */
    /* align-items: center; */
    /* margin-left: 2%; */
    gap: 4px;
    margin-bottom: 20px;
    overflow: hidden;

  }

  .workspace-list-item {
    display: flex;
    flex-direction: row;
    width: 100%;
    /* margin-left: 3%; */
    padding: 10px;
    background: linear-gradient(to top, #1a1a1a, #212121);
    align-items: center;
    gap: 10px;
    color: white;
    border: none;
    /* border-radius: 10px; */
    text-align: left;
    font-size: 20px;
    cursor: pointer;
    transition: background 0.3s;
    user-select: none;
  }

  .workspace-list-item:hover {
    background: #5a5a58;
  }

  h1 {
    font-size: 30px;
    margin: 0;
    color: white;
    width: 100%;
    text-align: center;
  }

  p {
    padding: 10px;
    
    transition: color 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
    user-select: none;

  }

  p:hover {
    color: red;
  }

  .spacer {
    flex-grow: 1;
    position: absolute;
    right: 1rem;
    margin-right: 10px;
  }

  .spacer:hover {
    color: red;
  }

  .icon-button, .check-button {
    background: none;
    border: none;
    cursor: pointer;
    color: white;
    padding: 5px;
    transition: color 0.3s;
    margin-right: 30px;
  }

  .icon-button:hover {
    color: #ff4136;
  }

  .check-button:hover {
    color: #4CAF50;
  }

  .confirmation-message {
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #4CAF50;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 1001;
  }

  .confirmation-message.error {
    background-color: #f44336;
  }

  input {
    display: flex;
    width: 100%;
    padding: 30px;
    background: linear-gradient(to top, #1a1a1a, #212121);
    align-items: center;
    gap: 10px;
    color: white;
    border: none;
    /* border-radius: 10px; */
    text-align: left;
    font-size: 20px;
    cursor: pointer;
    border-radius: 14px;
    transition: background 0.3s;
  }

  input:focus {
    outline: none;
    border-bottom-color: #45a049;
  }

/* .landing-page {
  top: 0;
  left: 0;
  width: 100%;
  height: 50vh; 
  padding: 20px 20px; 
  border-radius:50%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 90%);
  color: #333;
  z-index: 1000; 
} */

.workspace-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 3fr)); /* Smaller min size for better responsiveness */
        grid-auto-rows: 1fr;
        gap: 20px;
        padding: 10px;
        /* border-radius: 12px; */
        /* max-width: 300px; */
        /* background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 90%); */
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3); /* Adds a soft shadow for depth */
        overflow-y: auto;
        overflow-x: hidden;
        background-color: #333333;

        /* max-height: 80vh; Limits the height to prevent excessive scrolling */
    }


.landing-page {
  /* max-width: 100%; */
  /* padding: 1rem; */
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  position: relative;
  background: linear-gradient(to right, red, purple);
  padding: 3px;
  border-radius: 20px;

  
  
}


/* .half-container {
  display: flex;
  flex-direction: column;
  width: calc(100% - 80px); 
  justify-content: center; 
} */

.half-container {
  /* background: #222; */
  color: white;
  /* padding: 2rem; */
  /* height: 20vh; */
      /* margin: 0; */
      display: flex;
      flex-direction: column;
      /* place-items: center; */
      /* flex-wrap: wrap; */
      justify-content: center;
      text-align: center;
      width: 100%;
      /* margin-left: 10%; */
      background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%);

  

}

/* Adjust the image size if needed */
.landing {
  max-height: 18vh; /* Slightly smaller than the container */
  width: auto;
  object-fit: contain;
}

/* You might need to adjust the h1 and h2 sizes */
h1 {
  font-size: 4rem; /* Reduced size */
  color: #fff;
  margin-bottom: 0.5rem; /* Add some space below */
}

h2 {
  font-size: 50px; /* Reduced size */
  color: #fff;
  justify-content: center;
  align-items: center;
  display: flex;

}

/* Adjust the hr if needed */

hr {
    border: 0;
    border-top: 2px solid rgb(108, 108, 108);
    margin: 0;
  }

  .pulsing-svg {
    animation: pulse 2s ease-in-out infinite;
    height: 200px;

  }

  .grid-container {
    display: flex; /* _display-flex */
    flex-basis: auto; /* _flexBasis-auto */
    box-sizing: border-box; /* _boxSizing-border-box */
    min-height: 0; /* _minHeight-0px */
    min-width: 0; /* _minWidth-0px */
    flex-shrink: 0; /* _flexShrink-0 */
    flex-direction: row; /* _flexDirection-column */
    position: absolute; /* _position-absolute */
    top: 50%; /* _top-1481558214 */
    width: 100vw; /* _width-100vw */
    align-items: center; /* _alignItems-flex-end */
    justify-content: center;
    padding-right: 10px; /* _pr-1481558214 */
    /* Add responsive alignment if needed */

  }

.grid-item {
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.8);
  /* padding: 20px; */
  font-size: 30px;
  text-align: center;
  /* width: 50%; */
}

.grid-main {
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.8);
  /* padding: 20px; */
  font-size: 30px;
  text-align: center;

  /* width: 50%; */
}

  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }

  img {
    width: 50%;
    height: 50%;
  }





h3 {
  display: flex;
  font-size: 1.5rem;
}

textarea {
    width: 98%;
    /* min-height: 60px; Set a minimum height */
    /* max-height: 1200px; Set a maximum height */
    padding: 20px;
    text-justify: center;
    justify-content: center;
    resize: none;
    font-size: 16px;
    letter-spacing: 1.4px;
    border: none;
    border-radius: 20px;
    /* background-color: #2e3838; */
    background-color: #21201d;
    color: #818380;
    line-height: 1.4;
    height: auto;
    text-justify: center;
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
    overflow: scroll;
    scrollbar-width:none;
    scrollbar-color: #21201d transparent;
    vertical-align: middle; /* Align text vertically */
  }

  textarea:focus {
    outline: none;
    border: 2px solid #000000;
    color: white;
    
  }
  
  .cta-button {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 50px;
    padding: 20px;
    font-size:26px;
    font-weight: bolder;
    text-align: center;
    align-items: center;
    justify-content: center;
    border-radius: 14px;

  }

  .text-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    scroll-behavior: smooth; /* Smooth scrolling */
    max-height: 90vh;
    width: 96%;
    margin-left: 2%;
    border-radius: 20px;
    /* margin-left: 10px; Small margin on the sides */
    /* margin-right: 10px; Small margin on the sides */
}

.hero-container {
  /* width: auto; */
  justify-content: center;
  align-items: center;
  /* width: 50%; */
  margin-left: 35%;
  margin-top: 10%;
  width: 30%;
  height: 50%;
  /* margin-right: 25%; */
  /* top:100px; */
  display: flex;
  flex-direction: column;
  /* position: absolute; */

  
}



.toggle-button {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.toggle-button:hover {
  background-color: #45a049;
}







/* Wide screens */
@media (min-width: 1200px) and (max-width: 1599px) {
  .hero-container {
    width:50%;
    /* background-color: ; */
    margin-left: 25%;
    margin-right: 25%;
  }

  h2 {
    display: none;
  font-size: 40px; /* Reduced size */
  color: #fff;
  justify-content: center;
  align-items: center;
  /* display: flex; */
}



  /* .grid-container {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
  } */

  
}

/* Medium screens */
@media (min-width: 992px) and (max-width: 1199px) {
  .hero-container {
    width: 50%;
    margin-left: 25%;
    margin-right: 25%;
  }

  h2 {
    font-size: 40px;
  }

}

/* Small screens */
@media (min-width: 768px) and (max-width: 991px) {
  .hero-container {
    width: 70%;
    margin-left: 15%;
    margin-right: 15%;
    
  }

  h2 {
    font-size: 34px;
  }
  
}



@media (max-width: 767px) {
  .hero-container {
    width: 90%;
    margin-left: 5%;
    
  }

  .workspace-selector {
    width: 100%;
    margin-left: 0;
    padding: 5px;
  }

  .workspace-button {
    width: 150px;  /* Reduce the width */
    height: 50px;  /* Reduce the height */
    font-size: 14px;  /* Reduce the font size */
    padding: 5px;  /* Reduce padding */
  }

  .menu-button {
    scale: 0.5;
    padding: 0 5px;
    height: 40px;
    width: 40px;

  }

  .menu-button svg {
    width: 20px;  /* Reduce the icon size */
    height: 20px;  /* Reduce the icon size */
  }

  .workspace-menu {
    height: 40px;  /* Reduce the height */
    margin-bottom: 5px;  /* Reduce bottom margin */
  }

  .footer {
    bottom: 0;  /* Adjust the bottom position */
  }

  h2 {
    font-size: 24px;
  }

  p {
    font-size: 10px;
  }
}


  </style>