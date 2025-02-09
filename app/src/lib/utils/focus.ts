export function focusOnMount(node: HTMLElement) {
    node.focus();
    
    return {
      destroy() {}
    };
  }