import { writable, get } from 'svelte/store';
import type { AIModel } from '$lib/types/types';
import type { ProviderType } from '$lib/constants/providers';
import { currentUser, pocketbaseUrl } from '$lib/pocketbase'; // Changed import
import { defaultModel, availableModels } from '$lib/constants/models';
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
		console.log('Saving model to PocketBase:', { model, userId });
		try {
			// Use fetch API to communicate with server
			const response = await fetch(`/api/ai/models/save`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ model, userId })
			});
			
			const data = await response.json();
			if (!data.success) {
				throw new Error(data.error || 'Failed to save model');
			}
			
			console.log('Model saved successfully:', data.model);
			return data.model;
		} catch (error) {
			console.error('Error saving model to PocketBase:', error, 'Model Data:', model);
			return null;
		}
	};

	async function loadModels(userId: string) {
		try {
			// Check connection first
			const connectionResponse = await fetch('/api/verify/health');
			const connectionData = await connectionResponse.json();
			if (!connectionData.success) throw new Error('PocketBase not available');

			// Fetch models from API
			const response = await fetch(`/api/ai/users/${userId}/models`, {
				method: 'GET',
				credentials: 'include'
			});
			
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
			
			// Update user's selected model
			const userUpdateResponse = await fetch(`/api/verify/users/${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ model: model.id })
			});
			
			if (!userUpdateResponse.ok) {
				throw new Error(`Failed to update user's selected model: ${userUpdateResponse.statusText}`);
			}
			
			const existingModel = currentState.models.find(
				(m) => m.api_type === model.api_type && m.provider === model.provider
			);

			if (!existingModel) {
				console.log('Model not found in local state. Attempting to save to PocketBase...');
				const newModel = await saveModelToPocketBase(model, userId);
				if (newModel) {
					console.log('New model saved to PocketBase:', newModel);
					savedModel = newModel;
				} else {
					console.warn('Failed to save new model to PocketBase.');
				}
			} else {
				console.log('Model already exists in local state:', existingModel);
				savedModel = existingModel;
			}

			console.log("Updating user's selected model in PocketBase...");
			const finalUpdateResponse = await fetch(`/api/verify/users/${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ model: savedModel.id })
			});
			
			if (!finalUpdateResponse.ok) {
				throw new Error(`Failed to update user's selected model: ${finalUpdateResponse.statusText}`);
			}
			
			console.log("User's selected model updated successfully.");

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
			
			// 3. Extract provider and model preferences
			const selectedProvider = user.selected_provider as ProviderType || 'deepseek';
			const selectedModelId = user.model;
			
			console.log('User preferences:', { selectedProvider, selectedModelId });
			
			// Load models first to populate the state
			await loadModels(userId);
			
			// 4. Find a valid provider with API key
			let validProvider = selectedProvider;
			if (!availableKeys[selectedProvider]) {
			  // Fall back to any provider with a key
			  const providerWithKey = Object.keys(availableKeys).find(
				k => !!availableKeys[k]
			  ) as ProviderType | undefined;
			  
			  if (providerWithKey) {
				console.log(`Falling back to provider with key: ${providerWithKey}`);
				validProvider = providerWithKey;
			  } else {
				console.warn('No API keys found for any provider, using deepseek as fallback');
				validProvider = 'deepseek';
			  }
			}
			
			// Update the provider in store and DB
			await setSelectedProvider(userId, validProvider);
			
			// 5. Find and initialize a valid model
			let validModel: AIModel | null = null;
			const currentState = get({ subscribe });
			
			// If we have a model ID, try to fetch it
			if (selectedModelId) {
			  try {
				const modelResponse = await fetch(`/api/ai/models/${selectedModelId}`, {
					method: 'GET',
					credentials: 'include'
				});
				
				if (modelResponse.ok) {
					const modelData = await modelResponse.json();
					if (modelData.success && modelData.model) {
						// Ensure the model belongs to the selected provider
						if (modelData.model.provider === validProvider) {
							console.log('Using existing model:', modelData.model);
							validModel = modelData.model as AIModel;
						} else {
							console.log('Stored model is for different provider than selected');
						}
					}
				} else {
					console.warn('Could not fetch model with ID:', selectedModelId);
				}
			  } catch (error) {
				console.warn('Error fetching model with ID:', selectedModelId, error);
			  }
			}
			
			if (!validModel) {
			  // Check models already loaded in the store
			  const modelInStore = currentState.models.find(
				m => m.provider === validProvider
			  );
			  
			  if (modelInStore) {
				console.log('Using model from store:', modelInStore);
				validModel = modelInStore;
			  } else {
				// Try to fetch from database one more time
				try {
				  const modelsResponse = await fetch(`/api/ai/models/provider/${validProvider}/user/${userId}`, {
					method: 'GET',
					credentials: 'include'
				  });
				  
				  if (modelsResponse.ok) {
					const modelsData = await modelsResponse.json();
					if (modelsData.success && modelsData.models && modelsData.models.length > 0) {
						console.log('Using existing provider model from DB:', modelsData.models[0]);
						validModel = modelsData.models[0];
					}
				  }
				} catch (error) {
				  console.warn('Error finding models for provider:', error);
				}
			  }
			  
			  // If still no model found, use default from availableModels
			  if (!validModel) {
				validModel = availableModels.find(m => m.provider === validProvider) || defaultModel;
				console.log('Using default model for provider:', validModel);
			  }
			}
			
			// 6. Set the model in store and DB
			await setSelectedModel(userId, validModel);
			
			console.log('Model selection initialized with:', validModel);
			return validModel;
		  } catch (error) {
			console.error('Error initializing model selection:', error);
			return null;
		  }
		}
	};
};

export const modelStore = createModelStore();