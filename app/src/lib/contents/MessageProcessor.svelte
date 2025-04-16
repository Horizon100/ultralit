<script lang="ts">
  import { currentCite, availableCites, type Cite } from '$lib/stores/citeStore';
  import { onMount, afterUpdate } from 'svelte';
  import { messagesStore } from '$lib/stores/messagesStore';

  // This component can be added to your chat component to handle message processing
  export let messages: any[] = [];
  let isTypingInProgress = false;

  // Define base URLs for each source
  const sourceUrls: Record<Cite, string> = {
    wiki: 'https://en.wikipedia.org/wiki/',
    quora: 'https://www.quora.com/search?q=',
    x: 'https://twitter.com/search?q=',
    google: 'https://www.google.com/search?q=',
    reddit: 'https://www.reddit.com/search/?q=',
  };

  // Process a message to automatically wrap important terms in <strong> tags
  function processMessageContent(content: string): string {
    // This is a simplified example. You might want to use more sophisticated methods
    // like NLP to identify important terms in the message
    
    // Example: Wrap words with initial capital letters that are likely to be important terms
    return content.replace(/\b([A-Z][a-z]{2,})\b/g, '<strong>$1</strong>');
  }
  export function setTypingState(isTyping: boolean) {
  isTypingInProgress = isTyping;
}
  // Add citation functionality to DOM elements after render
  function enhanceWithCitations() {
  // Skip all processing if typing is in progress
  if (isTypingInProgress) {
    return;
  }

  const strongElements = document.querySelectorAll('.message p strong');
  
  strongElements.forEach(element => {
    const strongEl = element as HTMLElement;
    
    // Remove existing listeners to prevent duplicates
    const clone = strongEl.cloneNode(true);
    strongEl.parentNode?.replaceChild(clone, strongEl);
    
    // Add citation hover effect
    clone.addEventListener('mouseenter', (e) => {
      const target = e.currentTarget as HTMLElement;
      const text = target.textContent || '';
      target.style.cursor = 'pointer';
      target.style.textDecoration = 'underline';
      target.title = `Click to search for "${text}" on ${$currentCite}`;
    });
    
    clone.addEventListener('mouseleave', (e) => {
      const target = e.currentTarget as HTMLElement;
      target.style.textDecoration = 'none';
    });
    
    // Add click handler to open citation source
    clone.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const text = target.textContent || '';
      if (text) {
        const url = `${sourceUrls[$currentCite]}${encodeURIComponent(text)}`;
        window.open(url, '_blank');
      }
    });
  });
}

  // Listen for changes to the current cite
  const unsubscribe = currentCite.subscribe(() => {
    // When the cite changes, we need to update all citation links
    setTimeout(enhanceWithCitations, 0);
  });

  onMount(() => {
    enhanceWithCitations();
    
    return () => {
      unsubscribe();
    };
  });

  afterUpdate(() => {
  if (!isTypingInProgress) {
    setTimeout(enhanceWithCitations, 0);
  }
});
</script>

<!-- This component doesn't render anything visible -->