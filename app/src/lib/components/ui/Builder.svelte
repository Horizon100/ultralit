<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';

  import { workspaceStore } from '$lib/stores/workspaceStore';
  import { createWorkspace, updateWorkspace } from '$lib/workspaceClient';
  import { createAgent, updateAgent } from '$lib/agentClient';

  import { erpAgentTemplates } from '$lib/constants/erp';
  import { currentUser } from '$lib/pocketbase';
  import type { Workspaces, User, AIAgent, PartialAIAgent } from '$lib/types';

  import { Settings, Check, X, Paperclip, File, Hammer, Container, ChevronDown } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';
  import Auth from '$lib/components/auth/Auth.svelte';

  let activeTab = 'add';
  let showTemplates = false;
  let selectedTemplate: { id: number; name: string; description: string } | null = null;
  let workspaceName = '';
  let showAuth = false;
  let showAgentGenOverlay = false;
  let currentParentAgent: AIAgent | null = null;

  let workspaces: Workspaces[] = [];
  workspaceStore.subscribe(state => {
    workspaces = state.workspaces;
  });

  const dispatch = createEventDispatcher();

  const templates = [
    { id: 1, name: 'Compose', description: 'Build and configure your personalized AI agent network for efficient goal management. With Compose, you can tailor AI agents to manage specific tasks, automate workflows, and align your goals with strategic actions. This template allows you to create a seamless and adaptive system that evolves with your needs, ensuring continuous progress towards your objectives.' },
    { id: 2, name: 'ERP', description: 'Enhance your enterprise resource planning (ERP) system with specialized AI agents. These agents streamline various business processes, from inventory management and financial forecasting to human resources and customer relations. The ERP templates empower you to optimize operations, improve decision-making, and maintain compliance, all through intelligent automation tailored to your organization’s specific needs.' },
  ];

  function toggleTemplates() {
    showTemplates = !showTemplates;
  }

  function toggleAuth() {
    showAuth = !showAuth;
  }

  function selectTemplate(template: { id: number; name: string; description: string }) {
    selectedTemplate = template;
  }

  function handleAuthSuccess(event: CustomEvent) {
    dispatch('success', event.detail);
    // Redirect or trigger actions upon successful authentication
    if (showAuth) {
      handleGetStarted(); // Attempt to start the process after successful auth
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      dispatch('close');
    }
  }

  async function handleGetStarted() {
    if (!$currentUser) {
      console.error('User is not authenticated');
      showAuth = true; // Show authentication dialog if user is not authenticated
      return;
    }

    if (workspaceName && selectedTemplate) {
      try {
        const newWorkspace = await createWorkspace({
          name: workspaceName,
          template: selectedTemplate.id,
          constants: erpAgentTemplates,
          created_by: $currentUser.id,
          collaborators: [$currentUser.id]
        });

        // Create parent agent
        const parentAgent = await createAgent({
          name: `${workspaceName} Agent`,
          description: `Parent agent for ${workspaceName} ERP system`,
          workspace: newWorkspace.id,
          created_by: $currentUser.id,
          type: 'parent',
          role: 'hub',
          user_input: 'always', // Set a default value for user_input
          position: { x: 0, y: 0 }, // Set a default position
        });

        // Update workspace with parent_agent relation
        await updateWorkspace(newWorkspace.id, {
          parent_agent: parentAgent.id
        });

        const childAgentIds: string[] = [];

        // Create child agents based on ERP templates
        if (selectedTemplate.id === 2) { // ERP template
          for (const template of erpAgentTemplates) {
            const childAgent = await createAgent({
              name: template.name,
              description: template.description,
              workspace: newWorkspace.id,
              created_by: $currentUser.id,
              type: 'child',
              parent_agent: parentAgent.id,
              prompt: template.prompt,
              role: 'assistant',
              user_input: 'never', // Set a default value for user_input
              position: { x: 0, y: 0 }, // Set a default position
            });
            childAgentIds.push(childAgent.id);
          }
        }

        // Update parent agent with child agent IDs
        await updateAgent(parentAgent.id, {
          child_agents: childAgentIds
        });
        
        // Update the workspace in the store with the new parent_agent field
        const updatedWorkspace = { ...newWorkspace, parent_agent: parentAgent.id };
        workspaceStore.addWorkspace(updatedWorkspace);
        dispatch('close');

        // Navigate to the new workspace and open AgentGen for the parent agent
        await goto(`/launcher/workspace/${newWorkspace.id}`);

        // Set the current parent agent and show the AgentGen overlay
        currentParentAgent = parentAgent;
        showAgentGenOverlay = true;

      } catch (error) {
        console.error('Error creating workspace and agents:', error);
        // Handle error (show message to user, etc.)
      }
    }
  }
</script>

<div class="swap-interface">
  <nav class="tab-menu">
    <button class="tab-item" class:active={activeTab === 'add'} on:click={() => activeTab = 'add'}>
      <Container />
      Add
    </button>
    <button class="tab-item" class:active={activeTab === 'build'} on:click={() => activeTab = 'build'}>
      <Hammer />
      Build
    </button>
    <button class="tab-item settings">
      <Settings />
    </button>
  </nav>

  {#if activeTab === 'add'}
    <div class="compose-container">
      <div class="input-container">
        <div class="columns">
          <label>Give name to your AI workplace</label>
          <input type="text" bind:value={workspaceName} placeholder="Enter workspace name" />
        </div>

        <button class="template-select" on:click={toggleTemplates}>
          {selectedTemplate ? selectedTemplate.name : 'Select template'}
          <ChevronDown />
        </button>
      </div>

      {#if showTemplates}
        <div class="template-list" transition:slide>
          {#each templates as template (template.id)}
            <button
              class="template-item"
              class:selected={selectedTemplate === template}
              on:click={() => selectTemplate(template)}
            >
              {template.name}
              {#if selectedTemplate === template}
                <p transition:slide>{template.description}</p>
              {/if}
            </button>
          {/each}
        </div>
      {/if}

      {#if showAuth}
        <div class="auth-container" transition:slide on:click|self={handleClickOutside}>
          <div class="auth-overlay" transition:fade>
            <Auth on:success={handleAuthSuccess} />
          </div>
        </div>
      {/if}

      <button class="cta-button" on:click={handleGetStarted} disabled={!workspaceName || !selectedTemplate}>
        {showAuth ? 'Connect' : 'Get started'}
      </button>
    </div>
  {:else if activeTab === 'build'}
    <div class="build-content">
      <!-- Add content for the Build tab here -->
      <p>Build tab content goes here</p>
    </div>
  {/if}
</div>

  

<style>


.swap-interface {
  background-color: #131313;
  color: #ffffff;
  padding: 20px;
  display: flex;
flex-direction: column;
    gap: 3px;
width: 50%;
position: relative;
margin-left: 25%;
/* background: linear-gradient(to right, red, purple); */
/* padding: 3px; */
border-radius: 20px;

}

.auth-container {
        /* background-color: #131313; */
        /* color: #ffffff; */
        display: flex;
        flex-direction: column;
        gap: 10px;
        border-radius: 20px;
        width: 100%;
    }

.tab-menu {
  display: flex;
  margin-bottom: 10px;
  justify-content: space-between;
}

.tab-item {
  background: none;
  border: none;
  color: #808080;
  padding: 10px 15px;
  cursor: pointer;
  justify-content: center;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
}

.tab-item.active {
  color: #ffffff;
  background-color: #2c2c2c;
  border-radius: 20px;
}

.swap-container,   .auth-overlay{
  /* background-color: red; */
  border-radius: 10px;
  /* padding: 3px; */
  /* margin-bottom: 20px; */
  gap: 3px;
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-top: 10px;

  
}





.columns {
    display: flex;
    flex-direction: column;
    width: 70%;
    
}

input {
    outline: none; 
}


.input-container {
    position: relative;
    background-color: #1b1b1b;
    display: flex;
    /* height: 100px; */
    flex-direction: row;
    justify-content: center;
    align-items: center;
    /* width: 100%; */
    /* height: 100%; */
    gap: 3px;
    border-radius: 20px;
    transition: all 0.3s ease;

    /* margin-bottom: 5px; */

  
}

.input-container:focus-within {
        outline: none;
        box-shadow: 0 0 0 2px #ffffff; /* This creates a white border around the entire container */
    }

.input-container label {
  display: flex;
  /* margin-bottom: 5px; */
  height: 25px;
  font-size: 16px;
  text-align: left;
  margin-left: 10px;
  margin-top: 10px;


}

.input-container input {
  /* width: 100%; */
  background: none;
  border: none;
  color: #ffffff;
  font-size: 30px;
  height: 65px;
  margin-left: 10px;

}

.template-select {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #3c3c3c;
  border: none;
  width: 100px;
  /* height: 40px; */
  border-radius: 20px;
  padding: 14px 7px;
  color: #ffffff;
  user-select: none;
}

.template-select.select-template {
  background-color: #bb86fc;
}



.cta-button {
  width: 100%;
  height: 50px;
  background-color: #5a1f5a;
  color: #bb86fc;
  border: none;
  border-radius: 10px;
  padding: 15px;
  font-size: 24px;
  cursor: pointer;
}

.tab-item {
    transition: all 0.3s ease;
  }

  .compose-container {
    transition: all 0.3s ease;
  }

  .template-list {
    background-color: #2c2c2c;
    border-radius: 10px;
    margin-top: 10px;
    overflow: hidden;
  }

  .template-item {
    display: block;
    width: 100%;
    padding: 10px;
    text-align: left;
    font-size: 20px;
    background: none;
    border: none;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .template-item:hover, .template-item.selected {
    background-color: #3c3c3c;
  }

  .template-item p {
    margin-top: 5px;
    line-height: 1.5;
    text-align: justify;
    font-size: 16px;
    color: #bbbbbb;
  }



  .cta-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  

  @media (max-width: 600px) {
    .input-container {
      flex-direction: column;
    }

    .template-select {
      width: 100%;
    }

    .columns {
    width: 99%;

    }

    input:focus-within {
    outline:none;
    border-radius: 10px; 
    box-shadow: 0 0 0 2px #ffffff;

  }

.input-container:focus-within {
        outline: none;
        box-shadow: 0 0 0 2px #000000; 
    }
}



  

</style>
