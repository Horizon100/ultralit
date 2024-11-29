export const config = {
    defaultApiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
    pocketbaseUrl: import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090'
  };