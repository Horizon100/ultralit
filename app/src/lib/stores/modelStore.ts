import { writable, get } from 'svelte/store';
import type { AIModel, ProviderType } from '$lib/types/types';
import { defaultModel, availableModels } from '$lib/features/ai/utils/models';
import { apiKey } from '$lib/stores/apiKeyStore';
import { clientTryCatch, isSuccess } from '$lib/utils/errorUtils';

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
		const result = await clientTryCatch(
			fetch(`/api/ai/models`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ model, userId })
			}).then(async (response) => {
				if (!response.ok) throw new Error(`Failed to save model: ${response.statusText}`);
				const data = await response.json();
				if (!data.success) throw new Error(data.error || 'Failed to save model');
				return data.model as AIModel;
			})
		);

		if (isSuccess(result)) {
			console.log('Model saved successfully:', result.data);
			return result.data;
		} else {
			console.error('Error saving model to API:', result.error, 'Model Data:', model);
			return null;
		}
	};

	async function loadModels(userId: string): Promise<boolean> {
		const result = await clientTryCatch(
			(async () => {
				const connectionResponse = await fetch('/api/verify/health');
				const connectionData = await connectionResponse.json();
				if (!connectionData.success) throw new Error('PocketBase not available');

				const response = await fetch(`/api/ai/models?userId=${userId}`, {
					method: 'GET',
					credentials: 'include'
				});

				if (!response.ok) throw new Error(`Failed to load models: ${response.statusText}`);

				const data = await response.json();
				if (!data.success) throw new Error(data.error || 'Failed to load models');

				update((state) => ({
					...state,
					models: data.models as AIModel[],
					isOffline: false,
					updateStatus: ''
				}));
				return true;
			})()
		);

		if (isSuccess(result)) {
			return result.data;
		} else {
			console.warn('Failed to load models:', result.error);
			update((state) => ({ ...state, isOffline: true }));
			return false;
		}
	}

	async function setSelectedModel(userId: string, model: AIModel): Promise<boolean> {
		const result = await clientTryCatch(
			(async () => {
				let savedModel = model;
				const currentState = get({ subscribe });

				const existingModel = currentState.models.find(
					(m) => m.api_type === model.api_type && m.provider === model.provider
				);

				if (!existingModel) {
					const newModel = await saveModelToPocketBase(model, userId);
					if (newModel) {
						savedModel = newModel;
					} else {
						throw new Error('Failed to save new model to API.');
					}
				} else {
					savedModel = existingModel;
				}

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
					await apiKey.ensureLoaded();
					const availableKeys = get(apiKey);

					const userResponse = await fetch(`/api/verify/users/${userId}`, {
						method: 'GET',
						credentials: 'include'
					});

					if (!userResponse.ok) {
						throw new Error(`Failed to fetch user data: ${userResponse.statusText}`);
					}

					const userData = await userResponse.json();
					console.log('🔍 User data response:', userData); // Debug log

					if (!userData.success) {
						throw new Error(userData.error || 'Failed to get user data');
					}

					// FIXED: Handle the actual response structure from your API
					let user;
					if (userData.user && typeof userData.user === 'object') {
						// Your API returns: {success: true, user: {actualUserData}}
						user = userData.user;
						console.log('👤 User object extracted from userData.user:', user);
					} else if (userData.data && typeof userData.data === 'object') {
						// Fallback: {success: true, data: {actualUserData}}
						user = userData.data;
						console.log('👤 User object extracted from userData.data:', user);
					} else {
						// Direct user object
						user = userData;
						console.log('👤 User object used directly:', user);
					}

					// Safety check for user object
					if (!user || typeof user !== 'object') {
						console.warn('⚠️ User object is invalid, using defaults');
						console.log('⚠️ Received user object:', user);
						user = {}; // Default empty object
					}

					// Extract user properties safely - with better logging
					console.log('🔍 Full user object keys:', Object.keys(user || {}));
					console.log('🔍 Raw user.selected_provider:', user.selected_provider);
					console.log('🔍 Raw user.model:', user.model);

					const selectedProvider = (user.selected_provider as ProviderType) || null;
					const selectedModelId = user.model || null;

					console.log(
						'🎯 Selected provider:',
						selectedProvider,
						'Selected model ID:',
						selectedModelId
					);

					// If no provider/model is set, we'll need to initialize defaults later
					if (!selectedProvider && !selectedModelId) {
						console.log('💡 User has no provider/model set - will initialize defaults');
					}
					await loadModels(userId);

					let validProvider = selectedProvider;

					const availableKeyProviders = Object.keys(availableKeys).filter(
						(k) => !!availableKeys[k]
					);

					if (!selectedProvider) {
						validProvider =
							availableKeyProviders.length > 0
								? (availableKeyProviders[0] as ProviderType)
								: 'openai';

						await setSelectedProvider(userId, validProvider);
					}

					let validModel: AIModel | null = null;

					if (selectedModelId) {
						try {
							const modelResponse = await fetch(`/api/ai/models/${selectedModelId}`, {
								method: 'GET',
								credentials: 'include'
							});

							if (modelResponse.ok) {
								const modelData = await modelResponse.json();
								if (modelData.success && modelData.model) {
									if (!validProvider || modelData.model.provider === validProvider) {
										validModel = modelData.model as AIModel;
									}
								}
							}
						} catch (error) {
							console.warn('Failed to fetch selected model:', error);
						}
					}

					if (!validModel && validProvider) {
						const defaultForProvider = availableModels.find((m) => m.provider === validProvider);
						if (defaultForProvider) {
							const modelToSave = {
								name: defaultForProvider.name,
								provider: defaultForProvider.provider,
								api_type: defaultForProvider.api_type,
								base_url: defaultForProvider.base_url,
								description: defaultForProvider.description || '',
								api_version: defaultForProvider.api_version || ''
							};

							try {
								validModel = await saveModelToPocketBase(modelToSave as AIModel, userId);
							} catch (error) {
								console.warn('Failed to save model to PocketBase:', error);
								validModel = defaultForProvider;
							}
						} else {
							validModel = defaultModel;
						}
					}

					if (validModel) {
						await setSelectedModel(userId, validModel);
						return validModel;
					} else {
						return defaultModel;
					}
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
