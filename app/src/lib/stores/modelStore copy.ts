import { writable, get } from 'svelte/store';
import type { AIModel } from '$lib/types/types';
import type { ProviderType } from '$lib/constants/providers';
import {  checkPocketBaseConnection } from '$lib/pocketbase';
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
			const existingModels = await pb.collection('models').getFullList<AIModel>({
				filter: `api_type = "${model.api_type}" && provider = "${model.provider}" && user ~ "${userId}"`
			});

			console.log('Existing models found:', existingModels);

			if (existingModels.length > 0) {
				const existingModel = existingModels[0];
				console.log('Updating existing model:', existingModel.id);
				const updatedModel = await pb.collection('models').update(existingModel.id, {
					name: model.name,
					api_key: model.api_key,
					base_url: model.base_url,
					description: model.description || '',
					api_version: model.api_version || ''
				});
				console.log('Model updated successfully:', updatedModel);
				return updatedModel as AIModel;
			}

			console.log('Creating a new model in PocketBase...');
			const modelData = {
				name: model.name,
				api_key: model.api_key,
				base_url: model.base_url,
				api_type: model.api_type,
				provider: model.provider,
				description: model.description || '',
				user: [userId],
				api_version: model.api_version || ''
			};

			const savedModel = await pb.collection('models').create(modelData);
			console.log('Model created successfully:', savedModel);
			return savedModel as AIModel;
		} catch (error) {
			console.error('Error saving model to PocketBase:', error, 'Model Data:', model);
			return null;
		}
	};

	// Define the functions that were used in the return object
	async function loadModels(userId: string) {
		try {
			const isConnected = await checkPocketBaseConnection();
			if (!isConnected) throw new Error('PocketBase not available');

			const records = await pb.collection('models').getFullList({
				filter: `user ~ "${userId}"`,
				sort: '-created'
			});

			update((state) => ({
				...state,
				models: records as AIModel[],
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
			await pb.collection('users').update(
				userId,
				{
					model: model.id
				},
				{
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
					}
				}
			);
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
			await pb.collection('users').update(userId, {
				model: savedModel.id
			});
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
			await pb.collection('users').update(userId, {
				selected_provider: provider
			});

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
		
		// Add the initialize method
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
			
			// 2. Get user preferences from PocketBase
			const userData = await pb.collection('users').getOne(userId);
			
			// 3. Extract provider and model preferences
			const selectedProvider = userData.selected_provider as ProviderType || 'deepseek';
			const selectedModelId = userData.model;
			
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
				const modelRecord = await pb.collection('models').getOne(selectedModelId);
				
				// Ensure the model belongs to the selected provider
				if (modelRecord.provider === validProvider) {
				  console.log('Using existing model:', modelRecord);
				  validModel = modelRecord as AIModel;
				} else {
				  console.log('Stored model is for different provider than selected');
				}
			  } catch (error) {
				console.warn('Could not fetch model with ID:', selectedModelId, error);
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
				  const existingModels = await pb.collection('models').getFullList<AIModel>({
					filter: `provider = "${validProvider}" && user ~ "${userId}"`,
					sort: '-created'
				  });
				  
				  if (existingModels.length > 0) {
					console.log('Using existing provider model from DB:', existingModels[0]);
					validModel = existingModels[0];
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