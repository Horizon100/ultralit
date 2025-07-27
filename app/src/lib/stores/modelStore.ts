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

async function cleanupDuplicateModels(userId: string): Promise<void> {
	console.log('🧹 Starting cleanup of duplicate models...');
	
	try {
		// Fetch all models for the user
		const response = await fetch(`/api/ai/models?userId=${userId}`, {
			method: 'GET',
			credentials: 'include'
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch models: ${response.statusText}`);
		}

		const data = await response.json();
		if (!data.success) {
			throw new Error(data.error || 'Failed to fetch models');
		}

		const allModels = data.data?.models || data.models || [];
		console.log('📋 Found', allModels.length, 'total models');

		// Group models by provider + api_type to find duplicates
		const modelGroups: Record<string, AIModel[]> = {};
		
		allModels.forEach((model: AIModel) => {
			const key = `${model.provider}:${model.api_type}`;
			if (!modelGroups[key]) {
				modelGroups[key] = [];
			}
			modelGroups[key].push(model);
		});

		// Find and delete duplicates (keep the first one, delete the rest)
		let deletedCount = 0;
		for (const [key, models] of Object.entries(modelGroups)) {
			if (models.length > 1) {
				console.log(`🔍 Found ${models.length} duplicates for ${key}`);
				
				// Keep the first model, delete the rest
				const toDelete = models.slice(1);
				
				for (const model of toDelete) {
					try {
						const deleteResponse = await fetch(`/api/ai/models/${model.id}`, {
							method: 'DELETE',
							credentials: 'include'
						});
						
						if (deleteResponse.ok) {
							console.log(`🗑️ Deleted duplicate model: ${model.name} (${model.id})`);
							deletedCount++;
						} else {
							console.warn(`⚠️ Failed to delete model ${model.id}`);
						}
					} catch (error) {
						console.warn(`⚠️ Error deleting model ${model.id}:`, error);
					}
				}
			}
		}

		console.log(`✅ Cleanup complete! Deleted ${deletedCount} duplicate models`);
	} catch (error) {
		console.error('❌ Error during cleanup:', error);
	}
}

// Update the loadModels function to prevent loading duplicates
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

			// DEDUPLICATE MODELS BY provider + api_type
			const uniqueModels = models.reduce((acc: AIModel[], model: AIModel) => {
				const exists = acc.find(m => m.provider === model.provider && m.api_type === model.api_type);
				if (!exists) {
					acc.push(model);
				} else {
					console.log(`🚫 Skipping duplicate model: ${model.name} (${model.provider}:${model.api_type})`);
				}
				return acc;
			}, []);

			console.log('🔍 After deduplication:', uniqueModels.length, 'unique models');

			// Filter models by available API keys
			const availableKeyProviders = ['openai', 'anthropic', 'google', 'grok', 'deepseek'].filter(
				(provider) => apiKey.hasKey(provider)
			);

			const filteredModels = uniqueModels.filter((model: AIModel) => {
				const hasKey = availableKeyProviders.includes(model.provider);
				if (!hasKey) {
					console.log(`🚫 Filtered out ${model.name} - no key for ${model.provider}`);
				}
				return hasKey;
			});

			console.log('🔍 Final filtered models:', filteredModels?.length || 0, 'models');

			if (filteredModels && filteredModels.length > 0) {
				console.log(
					'🔍 Valid model details:',
					filteredModels.map((m) => `${m.provider}-${m.name}-${m.id}`)
				);
			}

			update((state) => ({
				...state,
				models: filteredModels || [],
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

// Update the setSelectedModel function to prevent creating duplicates
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
			if (model.id && !model.id.startsWith('template-') && !model.id.startsWith('fallback-')) {
				// Model already exists, just use it
				savedModel = model;
				console.log('✅ Using existing model with ID:', model.id);
			} else {
				// Check if a similar model already exists in the store
				const existingModel = (currentState?.models || []).find(
					(m: any) =>
						m.api_type === model.api_type &&
						m.provider === model.provider
				);

				if (existingModel) {
					// Use the existing model from store
					savedModel = existingModel;
					console.log('✅ Found existing model in store:', existingModel.id);
				} else {
					// Check if model exists in database by searching for similar models
					console.log('🔍 Checking database for existing model...');
					const searchResult = await clientTryCatch(
						fetch(`/api/ai/models?userId=${userId}&provider=${model.provider}&api_type=${model.api_type}`, {
							method: 'GET',
							credentials: 'include'
						}).then(async (response) => {
							if (!response.ok)
								throw new Error(`Failed to search models: ${response.statusText}`);
							const data = await response.json();
							if (!data.success) throw new Error(data.error || 'Failed to search models');
							return data.models || data.data?.models || [];
						})
					);

					if (isSuccess(searchResult)) {
						const existingDbModel = searchResult.data.find(
							(m: AIModel) =>
								m.api_type === model.api_type &&
								m.provider === model.provider
						);

						if (existingDbModel) {
							// Use existing model from database
							savedModel = existingDbModel;
							console.log('✅ Found existing model in database:', existingDbModel.id);
						} else {
							// Only create new model if none exists
							console.log('➕ No existing model found, creating new one');
							const newModel = await saveModelToPocketBase(model, userId);
							if (newModel) {
								savedModel = newModel;
								console.log('✅ Created new model:', newModel.id);
							} else {
								throw new Error('Failed to save new model to API.');
							}
						}
					} else {
						// If search fails, try to create new model
						console.log('⚠️ Model search failed, attempting to create new model');
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
				// Prevent adding duplicates to the store
				const modelExists = (state.models || []).some((m: any) => m.id === savedModel.id);
				const updatedModels = modelExists 
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
	cleanupDuplicateModels,
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

					const availableKeyProviders = [
						'openai',
						'anthropic',
						'google',
						'grok',
						'deepseek'
					].filter((provider) => apiKey.hasKey(provider));

					console.log('🔍 Available API key providers:', availableKeyProviders);

					// Load existing models from database
					console.log('🔍 Loading models from database...');
					await loadModels(userId);

					// Get current state
					let currentState: any = null;
					const unsubscribe = subscribe((state) => {
						currentState = state;
					});
					unsubscribe();

					console.log('🔍 LOADED MODELS COUNT:', currentState?.models?.length || 0);

					// FILTER MODELS BY AVAILABLE API KEYS
					const validModels = (currentState?.models || []).filter((model: AIModel) => {
						const hasKey = availableKeyProviders.includes(model.provider);
						if (!hasKey) {
							console.log(
								`🚫 Filtering out model ${model.name} - no API key for ${model.provider}`
							);
						}
						return hasKey;
					});

					console.log('🔍 VALID MODELS (with API keys):', validModels.length);
					console.log(
						'🔍 VALID MODEL DETAILS:',
						validModels.map((m: AIModel) => `${m.provider}-${m.name}-${m.id}`)
					);

					// Update store with filtered models
					update((state) => ({
						...state,
						models: validModels
					}));

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

					let user: User;
					if (userData.success && userData.data && userData.data.user) {
						user = userData.data.user;
						console.log('👤 User object extracted:', user);
					} else {
						console.error('❌ Unexpected user data structure:', userData);
						user = {} as User;
					}

					const selectedProvider = user.selected_provider || null;
					const selectedModelId = user.model || null;

					console.log(
						'🎯 User preferences - Provider:',
						selectedProvider,
						'Model ID:',
						selectedModelId
					);

					// If no valid models, use default from available provider
					if (validModels.length === 0) {
						console.log('❌ NO VALID MODELS - using default from available provider');

						// Find default model for available provider
						const preferredProviders = ['anthropic', 'deepseek', 'grok'];
						for (const provider of preferredProviders) {
							if (availableKeyProviders.includes(provider)) {
								console.log(`✅ Using default model for available provider: ${provider}`);

								// Use default from availableModels for this provider
								const defaultForProvider = availableModels.find((m) => m.provider === provider);
								if (defaultForProvider) {
									return defaultForProvider;
								}
							}
						}

						return defaultModel;
					}

					// If user has selected model, try to find it in valid models
					if (selectedModelId) {
						const foundModel = validModels.find((m: AIModel) => m.id === selectedModelId);
						if (foundModel) {
							console.log("✅ Found user's selected model:", foundModel.id, foundModel.name);
							return foundModel;
						} else {
							console.log("⚠️ User's selected model not found in valid models");
						}
					}

					// Prioritize providers: anthropic > deepseek > grok > others
					const preferredProviders = ['anthropic', 'deepseek', 'grok'];

					for (const provider of preferredProviders) {
						if (availableKeyProviders.includes(provider)) {
							const providerModels = validModels.filter((m: AIModel) => m.provider === provider);
							if (providerModels.length > 0) {
								const selectedModel = providerModels[0];
								console.log(
									`✅ Auto-selecting model from preferred provider ${provider}:`,
									selectedModel.name
								);
								await setSelectedModel(userId, selectedModel);
								return selectedModel;
							}
						}
					}

					// Use first valid model
					if (validModels.length > 0) {
						console.log('✅ Using first valid model:', validModels[0].name);
						await setSelectedModel(userId, validModels[0]);
						return validModels[0];
					}

					// Last resort
					console.log('❌ No valid models found, using default');
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
