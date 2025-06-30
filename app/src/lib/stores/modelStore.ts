import { writable, get } from 'svelte/store';
import type { AIModel, ProviderType } from '$lib/types/types';
import { defaultModel, availableModels } from '$lib/features/ai/utils/models';
import { apiKey } from '$lib/stores/apiKeyStore';
import { clientTryCatch, isSuccess } from '$lib/utils/errorUtils';
import type { User } from '$lib/types/types';
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
	console.log('🔄 saveModelToPocketBase START:', model.name);
	
	const result = await clientTryCatch(
		fetch(`/api/ai/models`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ model, userId })
		}).then(async (response) => {
			console.log('📡 Model save response status:', response.status);
			
			if (!response.ok) {
				const errorText = await response.text();
				console.error('❌ Model save failed:', response.status, errorText);
				throw new Error(`Failed to save model: ${response.statusText} - ${errorText}`);
			}
			
			const data = await response.json();
			console.log('📦 Model save response data:', data);
			
			if (!data.success) {
				throw new Error(data.error || 'Failed to save model');
			}
			
			// FIX: Handle the wrapped response structure
			let modelData;
			if (data.data && data.data.model) {
				modelData = data.data.model;
			} else if (data.model) {
				modelData = data.model;
			} else if (data.data && typeof data.data === 'object' && !data.data.model) {
				// Sometimes the model data is directly in data
				modelData = data.data;
			} else {
				console.error('❌ Unexpected model response structure:', data);
				throw new Error('No model returned from server');
			}
			
			console.log('📦 Extracted model data:', modelData);
			return modelData as AIModel;
		})
	);

	if (isSuccess(result)) {
		console.log('✅ Model saved successfully:', result.data.id);
		return result.data;
	} else {
		console.error('❌ Error saving model to API:', result.error);
		return null;
	}
};

async function loadModels(userId: string): Promise<boolean> {
	console.log('🔍 loadModels called for userId:', userId);
	
	const result = await clientTryCatch(
		(async () => {
			const connectionResponse = await fetch('/api/verify/health');
			const connectionData = await connectionResponse.json();
			if (!connectionData.success) throw new Error('PocketBase not available');

			console.log('🔍 Fetching models from API for userId:', userId);
			const response = await fetch(`/api/ai/models?userId=${userId}`, {
				method: 'GET',
				credentials: 'include'
			});

			console.log('🔍 Models API response status:', response.status);
			if (!response.ok) throw new Error(`Failed to load models: ${response.statusText}`);

			const data = await response.json();
			console.log('🔍 Raw models API response:', data);
			
			if (!data.success) throw new Error(data.error || 'Failed to load models');

			// FIX: Handle the wrapped response structure like your AI client
			let models: AIModel[] = [];
			if (data.data && data.data.models) {
				models = data.data.models;
			} else if (data.models) {
				models = data.models;
			} else if (data.data && Array.isArray(data.data)) {
				models = data.data;
			} else {
				console.log('❌ Unexpected models API structure:', data);
				models = [];
			}
			
			console.log('🔍 Loaded models from API:', models?.length || 0, 'models');
			
			if (models && models.length > 0) {
				console.log('🔍 Model details:', models.map(m => `${m.provider}-${m.name}-${m.id}`));
			} else {
				console.log('❌ No models returned from API');
			}

			update((state) => ({
				...state,
				models: models || [],
				isOffline: false,
				updateStatus: ''
			}));
			
			return true;
		})()
	);

	if (isSuccess(result)) {
		return result.data;
	} else {
		console.warn('❌ Failed to load models:', result.error);
		update((state) => ({ ...state, isOffline: true }));
		return false;
	}
}

async function setSelectedModel(userId: string, model: AIModel): Promise<boolean> {
	const result = await clientTryCatch(
		(async () => {
			let savedModel = model;
			
			// Get current state safely
			let currentState: any = null;
			const unsubscribe = subscribe((state) => {
				currentState = state;
			});
			unsubscribe();

			// First check if model has an ID (already exists in DB)
			if (model.id) {
				// Model already exists, just use it
				savedModel = model;
				console.log('Using existing model with ID:', model.id);
			} else {
				// Check if a similar model already exists in the store
				const existingModel = (currentState?.models || []).find(
					(m: any) => 
						m.api_type === model.api_type && 
						m.provider === model.provider &&
						m.name === model.name
				);

				if (existingModel) {
					// Use the existing model from store
					savedModel = existingModel;
					console.log('Found existing model in store:', existingModel.id);
				} else {
					// Check if model exists in database by searching for similar models
					const searchResult = await clientTryCatch(
						fetch(`/api/ai/models?userId=${userId}&provider=${model.provider}`, {
							method: 'GET',
							credentials: 'include'
						}).then(async (response) => {
							if (!response.ok) throw new Error(`Failed to search models: ${response.statusText}`);
							const data = await response.json();
							if (!data.success) throw new Error(data.error || 'Failed to search models');
							return data.models as AIModel[];
						})
					);

					if (isSuccess(searchResult)) {
						const existingDbModel = searchResult.data.find(
							(m) => 
								m.api_type === model.api_type && 
								m.provider === model.provider &&
								m.name === model.name
						);

						if (existingDbModel) {
							// Use existing model from database
							savedModel = existingDbModel;
							console.log('Found existing model in database:', existingDbModel.id);
						} else {
							// Only create new model if none exists
							console.log('No existing model found, creating new one');
							const newModel = await saveModelToPocketBase(model, userId);
							if (newModel) {
								savedModel = newModel;
								console.log('Created new model:', newModel.id);
							} else {
								throw new Error('Failed to save new model to API.');
							}
						}
					} else {
						// If search fails, try to create new model
						console.log('Model search failed, attempting to create new model');
						const newModel = await saveModelToPocketBase(model, userId);
						if (newModel) {
							savedModel = newModel;
						} else {
							throw new Error('Failed to save new model to API.');
						}
					}
				}
			}

			// Update user's selected model
			const userUpdateResponse = await fetch(`/api/verify/users/${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ model: savedModel.id })
			});

			if (!userUpdateResponse.ok) {
				throw new Error(
					`Failed to update user's selected model: ${userUpdateResponse.statusText}`
				);
			}

			update((state) => {
				const updatedModels = (state.models || []).some((m: any) => m.id === savedModel.id)
					? state.models
					: [...(state.models || []), savedModel];

				return {
					...state,
					selectedModel: savedModel,
					models: updatedModels,
					isOffline: false,
					updateStatus: 'Model selected successfully'
				};
			});

			return true;
		})()
	);

	if (isSuccess(result)) {
		return result.data;
	} else {
		console.error(
			'Error setting selected model:',
			result.error,
			'Model:',
			model,
			'UserId:',
			userId
		);
		update((state) => ({ ...state, isOffline: true }));
		return false;
	}
}

	async function setSelectedProvider(userId: string, provider: ProviderType): Promise<boolean> {
		const result = await clientTryCatch(
			fetch(`/api/verify/users/${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ selected_provider: provider })
			}).then(async (response) => {
				if (!response.ok)
					throw new Error(`Failed to update selected provider: ${response.statusText}`);

				update((state) => ({
					...state,
					selectedProvider: provider,
					isOffline: false,
					updateStatus: ''
				}));

				return true;
			})
		);

		if (isSuccess(result)) {
			return result.data;
		} else {
			console.error('Error setting selected provider:', result.error);
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

		updateModel(id: string, updatedModel: Partial<AIModel>) {
			update((state) => ({
				...state,
				models: state.models.map((model) =>
					model.id === id ? { ...model, ...updatedModel } : model
				),
				selectedModel:
					state.selectedModel?.id === id
						? { ...state.selectedModel, ...updatedModel }
						: state.selectedModel
			}));
		},

		addModel(newModel: AIModel) {
			update((state) => ({
				...state,
				models: [...state.models, newModel]
			}));
		},

		removeModel(id: string) {
			update((state) => ({
				...state,
				models: state.models.filter((model) => model.id !== id),
				selectedModel: state.selectedModel?.id === id ? null : state.selectedModel
			}));
		},

		setUpdateStatus(status: string) {
			update((state) => ({
				...state,
				updateStatus: status
			}));
		},

		clearUpdateStatus() {
			update((state) => ({
				...state,
				updateStatus: ''
			}));
		},

async initialize(userId: string): Promise<AIModel | null> {
	if (!userId) {
		console.error('No user ID provided for model initialization');
		return null;
	}

	const result = await clientTryCatch(
		(async () => {
			// Ensure API keys are loaded first
			console.log('🔍 Ensuring API keys are loaded...');
			await apiKey.ensureLoaded();
			
			const availableKeyProviders = ['openai', 'anthropic', 'google', 'grok', 'deepseek']
				.filter(provider => apiKey.hasKey(provider));
			
			console.log('🔍 Available API key providers:', availableKeyProviders);

			// Load existing models from database FIRST
			console.log('🔍 Loading models from database...');
			await loadModels(userId);
			
			// Get current state and LOG EVERYTHING
			let currentState: any = null;
			const unsubscribe = subscribe((state) => {
				currentState = state;
			});
			unsubscribe();

			console.log('🔍 LOADED MODELS COUNT:', currentState?.models?.length || 0);
			console.log('🔍 LOADED MODELS DETAILS:', currentState?.models?.map((m: AIModel) => 
				`${m.provider}-${m.name}-${m.id}`
			) || []);

			// Get user preferences
			const userResponse = await fetch(`/api/verify/users/${userId}`, {
				method: 'GET',
				credentials: 'include'
			});

			if (!userResponse.ok) {
				throw new Error(`Failed to fetch user data: ${userResponse.statusText}`);
			}

		const userData = await userResponse.json();
		console.log('🔍 User data response:', userData);

		// Extract user object correctly
		let user: User;
		if (userData.success && userData.data && userData.data.user) {
			user = userData.data.user;  // This should now work correctly
			console.log('👤 User object extracted from userData.data.user:', user);
		} else {
			console.error('❌ Unexpected user data structure:', userData);
			user = {} as User;
		}

		const selectedProvider = user.selected_provider || null;
		const selectedModelId = user.model || null;

		console.log('🎯 User preferences - Provider:', selectedProvider, 'Model ID:', selectedModelId);

			// CHECK IF WE HAVE ANY MODELS AT ALL
			if (!currentState?.models || currentState.models.length === 0) {
				console.log('❌ NO MODELS LOADED FROM DATABASE - this is the problem!');
				// Don't create models here, just use fallback
				return defaultModel;
			}

			// If user has selected model, try to find it
			if (selectedModelId) {
				const foundModel = currentState.models.find((m: AIModel) => m.id === selectedModelId);
				if (foundModel) {
					console.log('✅ Found user\'s selected model:', foundModel.id, foundModel.name);
					return foundModel;
				} else {
					console.log('⚠️ User\'s selected model not found in loaded models');
				}
			}

			// Find valid provider
			let validProvider = selectedProvider;
			if (!selectedProvider || !apiKey.hasKey(selectedProvider)) {
				validProvider = availableKeyProviders.length > 0
					? (availableKeyProviders[0] as ProviderType)
					: 'openai';
				console.log('🔄 Using fallback provider:', validProvider);
			}

			// Look for ANY model for this provider
			const providerModels = currentState.models.filter((m: AIModel) => m.provider === validProvider);
			console.log(`🔍 Found ${providerModels.length} models for provider ${validProvider}`);
			
			if (providerModels.length > 0) {
				const selectedModel = providerModels[0];
				console.log('✅ Using existing model:', selectedModel.id, selectedModel.name);
				await setSelectedModel(userId, selectedModel);
				return selectedModel;
			}

			// Look for ANY model with any available provider
			for (const provider of availableKeyProviders) {
				const models = currentState.models.filter((m: AIModel) => m.provider === provider);
				if (models.length > 0) {
					console.log(`✅ Using model from available provider ${provider}:`, models[0].id);
					await setSelectedModel(userId, models[0]);
					return models[0];
				}
			}

			// If we get here, we have loaded models but none match available providers
			console.log('⚠️ Have models but none match available API key providers');
			console.log('⚠️ Available providers:', availableKeyProviders);
			console.log('⚠️ Model providers:', currentState.models.map((m: AIModel) => m.provider));
			
			// Just use the first available model
			if (currentState.models.length > 0) {
				console.log('✅ Using first available model:', currentState.models[0].id);
				return currentState.models[0];
			}

			// Last resort
			console.log('❌ No models found at all, using default');
			return defaultModel;
		})()
	);

	if (isSuccess(result)) {
		return result.data;
	} else {
		console.error('Error initializing model selection:', result.error);
		return defaultModel;
	}
}
	};
};

export const modelStore = createModelStore();
