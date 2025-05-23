import { writable, get } from 'svelte/store';
import type { AIModel } from '$lib/types/types';
import type { ProviderType } from '$lib/features/ai/utils/providers';
import { currentUser } from '$lib/pocketbase';
import { defaultModel, availableModels } from '$lib/features/ai/utils/models';
import { apiKey } from '$lib/stores/apiKeyStore';

export interface ModelState {
	models: AIModel[];
	selectedModel: AIModel | null; 
	selectedProvider: ProviderType | null;
	updateStatus: string;
	isOffline: boolean;
}

const createModelStore = () => {
	const initialState: ModelState = {
		models: [],
		selectedModel: null,
		selectedProvider: null,
		updateStatus: '',
		isOffline: false
	};

	const { subscribe, set, update } = writable<ModelState>(initialState);

	const saveModelToPocketBase = async (model: AIModel, userId: string): Promise<AIModel | null> => {
		console.log('Saving model to API:', { model, userId });
		try {
			// Use fetch API to communicate with server - using main models endpoint
			const response = await fetch(`/api/ai/models`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ model, userId })
			});
			
			if (!response.ok) {
				throw new Error(`Failed to save model: ${response.status} ${response.statusText}`);
			}
			
			const data = await response.json();
			if (!data.success) {
				throw new Error(data.error || 'Failed to save model');
			}
			
			console.log('Model saved successfully:', data.model);
			return data.model;
		} catch (error) {
			console.error('Error saving model to API:', error, 'Model Data:', model);
			return null;
		}
	};

	async function loadModels(userId: string) {
		try {
			// Check connection first - use the standard path endpoint
			const connectionResponse = await fetch('/api/verify/health');
			const connectionData = await connectionResponse.json();
			if (!connectionData.success) throw new Error('PocketBase not available');

			// Fetch models from API
			const response = await fetch(`/api/ai/models?userId=${userId}`, {
				method: 'GET',
				credentials: 'include'
			});
			
			if (!response.ok) {
				throw new Error(`Failed to load models: ${response.status} ${response.statusText}`);
			}
			
			const data = await response.json();
			if (!data.success) {
				throw new Error(data.error || 'Failed to load models');
			}

			update((state) => ({
				...state,
				models: data.models as AIModel[],
				isOffline: false,
				updateStatus: ''
			}));

			return true;
		} catch (error) {
			console.warn('Failed to load models:', error);
			update((state) => ({ ...state, isOffline: true }));
			return false;
		}
	}

	async function setSelectedModel(userId: string, model: AIModel) {
		console.log('setSelectedModel called with:', { userId, model });
		try {
			let savedModel = model;
			const currentState = get({ subscribe });

			console.log('Current state of models:', currentState.models);
			
			// First try to find if the model already exists locally
			const existingModel = currentState.models.find(
				(m) => m.api_type === model.api_type && m.provider === model.provider
			);

			if (!existingModel) {
				console.log('Model not found in local state. Attempting to save to API...');
				const newModel = await saveModelToPocketBase(model, userId);
				if (newModel) {
					console.log('New model saved to API:', newModel);
					savedModel = newModel;
				} else {
					console.warn('Failed to save new model to API.');
				}
			} else {
				console.log('Model already exists in local state:', existingModel);
				savedModel = existingModel;
			}
			
			// Then update user's selected model in DB
			console.log("Updating user's selected model in API...");
			const userUpdateResponse = await fetch(`/api/verify/users/${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ model: savedModel.id })
			});
			
			if (!userUpdateResponse.ok) {
				throw new Error(`Failed to update user's selected model: ${userUpdateResponse.statusText}`);
			}

			// Update store state
			update((state) => {
				const updatedModels = state.models.some((m) => m.id === savedModel.id)
					? state.models
					: [...state.models, savedModel];

				return {
					...state,
					selectedModel: savedModel,
					models: updatedModels,
					isOffline: false,
					updateStatus: 'Model selected successfully'
				};
			});
			console.log('Store state updated with selected model:', savedModel);

			return true;
		} catch (error) {
			console.error('Error setting selected model:', error, 'Model:', model, 'UserId:', userId);
			update((state) => ({ ...state, isOffline: true }));
			return false;
		}
	}

	async function setSelectedProvider(userId: string, provider: ProviderType) {
		try {
			const response = await fetch(`/api/verify/users/${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ selected_provider: provider })
			});
			
			if (!response.ok) {
				throw new Error(`Failed to update selected provider: ${response.statusText}`);
			}

			update((state) => ({
				...state,
				selectedProvider: provider,
				isOffline: false,
				updateStatus: ''
			}));

			return true;
		} catch (error) {
			console.error('Error setting selected provider:', error);
			update((state) => ({ ...state, isOffline: true }));
			return false;
		}
	}

	function reset() {
		set(initialState);
	}

	return {
		subscribe,
		loadModels,
		setSelectedModel,
		setSelectedProvider,
		reset,
		
		// Updated initialize method using fetch API
		async initialize(userId: string) {
		  console.log('Initializing model selection...');
		  
		  if (!userId) {
			console.error('No user ID provided for model initialization');
			return null;
		  }
		  
		  try {
			// 1. Ensure API keys are loaded
			await apiKey.loadKeys();
			const availableKeys = get(apiKey);
			
			console.log('Available provider keys:', Object.keys(availableKeys).filter(k => !!availableKeys[k]));
			
			// 2. Get user preferences from API
			const userResponse = await fetch(`/api/verify/users/${userId}`, {
				method: 'GET',
				credentials: 'include'
			});
			
			if (!userResponse.ok) {
				throw new Error(`Failed to fetch user data: ${userResponse.statusText}`);
			}
			
			const userData = await userResponse.json();
			if (!userData.success) {
				throw new Error(userData.error || 'Failed to get user data');
			}
			
			const user = userData.user;
			
			/*
			 * 3. Extract provider and model preferences
			 * If no selected_provider is found, keep it null instead of defaulting to 'openai'
			 */
			const selectedProvider = user.selected_provider as ProviderType || null;
			const selectedModelId = user.model || null;
			
			console.log('User preferences:', { selectedProvider, selectedModelId });
			
			// Load models first to populate the state
			await loadModels(userId);
			
			// 4. Find a valid provider with API key
			let validProvider = selectedProvider;
			
			// Only try to find a provider with a key if we have keys
			const availableKeyProviders = Object.keys(availableKeys).filter(k => !!availableKeys[k]);
			
			if (!selectedProvider) {
				// Pick first available provider with a key, or default to 'openai' if none
				validProvider = availableKeyProviders.length > 0 
					? availableKeyProviders[0] as ProviderType 
					: 'openai';
				console.log(`No provider selected, using: ${validProvider}`);
				
				// Only update in database if we're setting for first time
				await setSelectedProvider(userId, validProvider);
			} else {
				// Use the already selected provider from the user's preferences
				console.log(`Using existing selected provider: ${selectedProvider}`);
			}
			
			// 5. Find and initialize a valid model
			let validModel: AIModel | null = null;
			const currentState = get({ subscribe });
			
			// If we have a model ID, try to fetch it
			if (selectedModelId) {
			  try {
				console.log('Trying to fetch selected model with ID:', selectedModelId);
				const modelResponse = await fetch(`/api/ai/models/${selectedModelId}`, {
					method: 'GET',
					credentials: 'include'
				});
				
				if (modelResponse.ok) {
					const modelData = await modelResponse.json();
					if (modelData.success && modelData.model) {
						// If we have a validProvider, ensure model provider matches
						if (!validProvider || modelData.model.provider === validProvider) {
							console.log('Using existing model:', modelData.model);
							validModel = modelData.model as AIModel;
						} else {
							console.log('Stored model is for different provider than selected');
						}
					}
				} else {
					console.warn(`Could not fetch model with ID: ${selectedModelId} - Status: ${modelResponse.status}`);
				}
			  } catch (error) {
				console.warn('Error fetching model with ID:', selectedModelId, error);
			  }
			}
			
// If still no model found and we have a valid provider, use default
if (!validModel && validProvider) {
	// Find a default model for the provider
	const defaultForProvider = availableModels.find(m => m.provider === validProvider);
	
	if (defaultForProvider) {
	  // Create a clean copy without api_key
	  const modelToSave = {
		name: defaultForProvider.name,
		provider: defaultForProvider.provider,
		api_type: defaultForProvider.api_type,
		base_url: defaultForProvider.base_url,
		description: defaultForProvider.description || '',
		api_version: defaultForProvider.api_version || ''
	  };
	  
	  console.log(`Using default model for provider ${validProvider}:`, modelToSave);
	  
	  // We need to save this model before using it
	  try {
		validModel = await saveModelToPocketBase(modelToSave as AIModel, userId);
		console.log('Default model saved to database:', validModel);
	  } catch (saveError) {
		console.error('Error saving default model:', saveError);
		// Return the original default model without trying to save it
		validModel = defaultForProvider;
	  }
	} else {
	  console.warn(`No default model found for provider ${validProvider}`);
	  validModel = defaultModel; // Use the system default model
	}
  }
			
			// 6. Set the model in store and DB if we found one
			if (validModel) {
				await setSelectedModel(userId, validModel);
				console.log('Model selection initialized with:', validModel);
				return validModel;
			  } else {
				console.log('No valid model found, using default model');
				// Always return at least the default model
				return defaultModel;
			  }
		  } catch (error) {
			console.error('Error initializing model selection:', error);
			// Return default model if initialization fails
			return defaultModel;
		  }
		}
	};
};

export const modelStore = createModelStore();