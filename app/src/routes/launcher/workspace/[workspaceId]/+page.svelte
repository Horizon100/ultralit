<script lang="ts">
    import { page } from '$app/stores';
    import { workspaceStore } from '$lib/stores/workspaceStore';
    import type { Workspaces } from '$lib/types/types';

    let currentWorkspace: Workspaces | undefined;

    $: {
        const workspaceId = $page.params.workspaceId;
        workspaceStore.subscribe(state => {
            currentWorkspace = state.workspaces.find(w => w.id === workspaceId);
        });
    }
</script>

<!-- {#if currentWorkspace}
    <h1>{currentWorkspace.name}</h1>
{:else}
    <p>Workspace not found</p>
{/if} -->

<slot />

<style>
    .workshops-container {
        display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: fixed;
      /* bottom: 50px; */
        background-color: #15a2a2;
        position: fixed;
        left: 200px;
        bottom: 40px;
        border-radius: 20px;
        /* width: calc(100% - 120px); */
  width: auto;
        height: 90%;
        
        /* height: calc(100% - 160px); */
        transition: all 1s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        overflow: auto;
        scroll-behavior: smooth;
      scrollbar-width: thin;
      scrollbar-color: white transparent;
      white-space: nowrap; /* Prevent wrapping */
      /* scroll-snap-type: y mandatory; */
      -webkit-overflow-scrolling: touch; /* For smoother scrolling on iOS */
    }

    .add-button {
        padding: 14px;
        background-color: #4b4b49;
        width: 90p;
        position: absolute;
        bottom: 59px;
        display: flex;
        color: white;
        border: none;
        border-radius: 14px;
        cursor: pointer;
        font-size: 18px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        transition: background-color 0.3s, transform 0.3s;
    }

    .workshops-container.transitioning-back {
        transform: scale(0.05);
        opacity: 0;
    }

    .workshops-container.transitioning-back {
        transform: scale(0.05);
        opacity: 0;
    }




    .workshop-item {
        /* padding: 10px 10px; */
    background-color: #4b4b49;
    color: white;
    border: none;
    border-radius: 14px;
    display: flex;
    /* flex-direction: row; */
    /* flex-grow: calc(1 / 3); */
    /* flex: auto; */
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-left: 10px;
    margin-bottom: 10px;
    /* height: 60px; */
    /* gap: 10px; */
    text-align: center;
    font-size: 14px;
    /* margin-left: 5px; */
    transition: background-color 0.3s, transform 0.3s;
    scroll-snap-align: start;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);

  }

  .workspace-button:hover {
    background-color: #f0f0f0;
    /* transform: scale(1.05);  */
  }


    .menu-button {
      padding: 10px 20px;
      border: none;
      border-radius: 20px;
      background-color: transparent;
      color: white;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      gap: 5px;
      text-align: center;
      font-size: 24px;
      transition: background-color 0.3s, transform 0.3s;
    }

    .menu-button:hover {
      background-color: #f0f0f0;
      transform: background-color 0.3s, transform 0.3s; 
    }

    
    .create-workshop  {
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


    .create-workshop.new {
        color: rgb(71, 223, 165);
    }

    .create-workshop:hover {
        background-color: #f0f0f0;
        /* transform: scale(1.05);  */
    }

    .back-button {
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

    h1 {
        font-size: 24px;
        margin-bottom: 20px;
        position: absolute;
        bottom: 80px;
        /* left:calc(50% - 180px); */
        padding: 10px;
        border-bottom: 2px solid #ccc;
    }

	
    .tabs {
        display: flex;
        flex-direction: column;
        align-items: center;
        overflow-x: auto;
        overflow-y: hidden;
        white-space: nowrap;
        padding: 10px 10px;
        scroll-behavior: smooth;
        cursor: grab;
        user-select: none;


    }
    .tabs::-webkit-scrollbar {
        display: none;
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
      /* background-color: red; */
      height: 80px;
      
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
        /* transform: scale(1.05);  */
    }



    
    input {
    /* display: flex; */
    /* width: 100%; */
    padding: 20px;
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

  footer {
        position: absolute;
        bottom: 20px;
        width: 100%;
        /* right: 0; */
        display: flex;
        justify-content: space-between;
        padding: 1rem;
        backdrop-filter: blur(2px);
        border-top-left-radius: 20px;
        border-top-right-radius: 20px;
        

    }
    .illustration {
  position: absolute;
  width: 90%;
  height: auto;
  left: 5%;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.025;
  z-index: 1;
  pointer-events: none;
}

@media (max-width: 700px) {
    .workshops-container {
        left: 80px;
    }
    
  }



</style>