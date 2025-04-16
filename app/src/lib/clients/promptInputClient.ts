import { ensureAuthenticated } from '$lib/pocketbase';
import type { PromptInput } from '$lib/types/types';

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        try {
            const errorData = await response.json();
            console.log('Error response body:', errorData);
            throw new Error(errorData.message || `API request failed with status ${response.status}: ${response.statusText}`);
        } catch (jsonError) {
            // If JSON parsing fails, use status text
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        }
    }
    return await response.json();
}

export async function fetchUserPrompts(): Promise<PromptInput[]> {
    try {
        await ensureAuthenticated();
        const response = await fetch('/api/prompts', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await handleResponse<{ 
            success: boolean; 
            data: PromptInput[];
            error?: string 
        }>(response);

        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch prompts');
        }

        return data.data;
    } catch (error) {
        console.error('Error fetching prompts:', error);
        throw error;
    }
}

export async function createPrompt(promptText: string): Promise<PromptInput> {
    try {
        await ensureAuthenticated();
        console.log('Creating prompt with text:', promptText);
        
        // POST to the prompts collection endpoint
        const response = await fetch('/api/prompts/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: promptText }),
            credentials: 'include'
        });

        const data = await handleResponse<{ 
            success: boolean;
            data: PromptInput;
            error?: string 
        }>(response);

        if (!data.success) {
            throw new Error(data.error || 'Failed to create prompt');
        }

        return data.data;
    } catch (error) {
        console.error('Error creating prompt:', error);
        throw error;
    }
}

export async function updatePrompt(id: string, promptText: string): Promise<PromptInput> {
    try {
        await ensureAuthenticated();
        console.log(`Updating prompt ${id} with text:`, promptText);
        
        const response = await fetch(`/api/prompts/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                text: promptText
            }),
            credentials: 'include'
        });

        console.log(`Update response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.error || `Failed to update prompt: ${response.statusText}`);
            } catch (parseError) {
                throw new Error(`Failed to update prompt: ${response.statusText}`);
            }
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to update prompt');
        }

        return data.data;
    } catch (error) {
        console.error('Error updating prompt:', error);
        throw error;
    }
}

export async function deletePrompt(id: string): Promise<boolean> {
    try {
        await ensureAuthenticated();
        console.log(`Deleting prompt with ID: ${id}`);
        
        const response = await fetch(`/api/prompts/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        console.log(`Delete response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.error(`Prompt with ID ${id} not found.`);
                throw new Error(`Prompt with ID ${id} not found.`);
            }
            throw new Error(`Failed to delete prompt: ${response.statusText}`);
        }

        const data = await handleResponse<{ 
            success: boolean;
            error?: string 
        }>(response);

        return data.success;
    } catch (error) {
        console.error('Error deleting prompt:', error);
        throw error;
    }
}