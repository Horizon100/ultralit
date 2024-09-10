<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Attachment } from '$lib/types';
  
    const dispatch = createEventDispatcher<{
      upload: Attachment[];
    }>();
  
    let files: FileList;
    let uploadedAttachments: Attachment[] = [];
  
    async function handleUpload() {
      if (files && files.length > 0) {
        const newAttachments: Attachment[] = [];
  
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          // Here you would typically upload the file to your server or a file hosting service
          // For this example, we'll just create a mock URL
          const mockUrl = URL.createObjectURL(file);
          
          const attachment: Attachment = {
            id: `attachment-${Date.now()}-${i}`,
            name: file.name,
            url: mockUrl
          };
  
          newAttachments.push(attachment);
        }
  
        uploadedAttachments = [...uploadedAttachments, ...newAttachments];
        dispatch('upload', uploadedAttachments);
      }
    }
  </script>
  
  <div class="attachment-uploader">
    <h2>Upload Attachments</h2>
    <input 
      type="file" 
      bind:files 
      multiple 
      accept="image/*,application/pdf"
    />
    <button on:click={handleUpload} disabled={!files || files.length === 0}>
      Upload
    </button>
  
    {#if uploadedAttachments.length > 0}
      <div class="uploaded-files">
        <h3>Uploaded Files:</h3>
        <ul>
          {#each uploadedAttachments as attachment (attachment.id)}
            <li>{attachment.name}</li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
  
  <style>
    .attachment-uploader {
      margin-bottom: 20px;
    }
  
    h2 {
      font-size: 1.5em;
      margin-bottom: 10px;
    }
  
    input[type="file"] {
      margin-bottom: 10px;
    }
  
    button {
      padding: 10px;
      background-color: #008CBA;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: background-color 0.3s;
    }
  
    button:hover:not(:disabled) {
      background-color: #007B9A;
    }
  
    button:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
    }
  
    .uploaded-files {
      margin-top: 20px;
    }
  
    ul {
      list-style-type: none;
      padding-left: 0;
    }
  
    li {
      margin-bottom: 5px;
    }
  </style>