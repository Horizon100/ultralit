<script lang="ts">
    let userInput = '';
    let agentName = 'AI Assistant';
    let agentOutput = '';
  
    function handleInput() {
      // Process user input here
    }
  
    function handleFileDrop(event: DragEvent) {
      // Handle file drop logic here
    }
  </script>
  
  <div class="assistant">
    <div class="top-container">
    </div>
    
    <div class="middle-row">
      <div class="input-container" 
           on:dragover|preventDefault 
           on:drop|preventDefault={handleFileDrop}>
        <textarea bind:value={userInput} on:input={handleInput} placeholder="Type or drag files here..."></textarea>
      </div>
      <div class="agent-container">
        <div class="agent-display">
            <img
                src="https://api.dicebear.com/9.x/notionists/svg?seed=Callie"
                alt="avatar" />
        </div>
        <div class="agent-name">{agentName}</div>
      </div>
    </div>
    
    <div class="bottom-container">
      <p>{agentOutput}</p>
    </div>
  </div>
  
  <style>
    .assistant {
      height: 100vh;
      width: 100%;

      display: flex;
      flex-direction: column;
    }
    
    h1 {
        position: absolute;
        left: 20px;
        top: 30px;
    }
    
    .top-container {
      height: 5%;
      width: 100%;
    }
    
    .middle-row {
      height: 55%;
      display: flex;
    }
    
    .input-container {
      width: 60%;
    }
    

    .agent-container {
      width: 40%;
      display: flex;
      flex-direction: column;
    }
    
    .agent-display {
      height: 90%;
    }

    .agent-name {
        background-color: black;
        position: absolute;
        top: 110px;
        width: 40%;
        font-size: 20px;
        text-align: center;
    }
    
    .bottom-container {
      height: 35%;
      width: 100%;
      padding: 20px;
      overflow-y: auto;
      border-radius: 0;
      background-color: #3a3e3c;

    }
    
    textarea {
      width: 100%;
      height: 100%;
      resize: none;
      background-color: #292929;

    }
  </style>