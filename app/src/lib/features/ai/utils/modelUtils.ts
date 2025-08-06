//src/lib/features/ai/utils/modelUtils.ts
import type { AIModel } from '$lib/types/types';

export interface ModelData {
	name: string;
	api_type: string;
	provider: string;
	owner: string;
	created: string;
	updated: string;
}

// Function to ensure models exist in the models collection
export async function ensureModelsExist(modelNames: string[], userId: string): Promise<string[]> {
	console.log('🔍 Ensuring models exist in database:', modelNames);

	const modelIds: string[] = [];

	for (const modelName of modelNames) {
		try {
			// First, check if model already exists in the models collection
			const searchResponse = await fetch(`/api/ai/models?search=${encodeURIComponent(modelName)}`, {
				method: 'GET',
				credentials: 'include'
			});

			if (searchResponse.ok) {
				const searchData = await searchResponse.json();
				const existingModels = searchData.data?.models || searchData.models || [];

				// Look for exact match by name or api_type
				const existingModel = existingModels.find(
					(m: AIModel) => m.name === modelName || m.api_type === modelName || m.id === modelName
				);

				if (existingModel) {
					console.log('✅ Found existing model:', existingModel.id, existingModel.name);
					modelIds.push(existingModel.id);
					continue;
				}
			}

			// Model doesn't exist, create it
			console.log('➕ Creating new model in database:', modelName);

			// Determine model details based on name
			const modelData = createModelFromName(modelName, userId);

			const createResponse = await fetch('/api/ai/models', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ model: modelData, userId })
			});

			if (createResponse.ok) {
				const createData = await createResponse.json();
				let newModel;

				// Handle different response structures
				if (createData.data?.model) {
					newModel = createData.data.model;
				} else if (createData.model) {
					newModel = createData.model;
				} else if (createData.data) {
					newModel = createData.data;
				}

				if (newModel?.id) {
					console.log('✅ Created new model:', newModel.id, newModel.name);
					modelIds.push(newModel.id);
				} else {
					console.error('❌ Failed to get model ID from response:', createData);
					// Fallback: use the model name as-is (might cause relation error)
					modelIds.push(modelName);
				}
			} else {
				console.error('❌ Failed to create model:', modelName, createResponse.status);
				// Fallback: use the model name as-is (might cause relation error)
				modelIds.push(modelName);
			}
		} catch (error) {
			console.error('❌ Error processing model:', modelName, error);
			// Fallback: use the model name as-is (might cause relation error)
			modelIds.push(modelName);
		}
	}

	console.log('✅ Final model IDs:', modelIds);
	return modelIds;
}

// Helper function to create model data from model name
export function createModelFromName(modelName: string, userId: string): ModelData {
	// Parse model name to determine provider and type
	let provider = 'local';
	let apiType = modelName;
	const displayName = modelName;

	// Detect provider from model name patterns
	if (modelName.includes('gpt-') || modelName.includes('openai')) {
		provider = 'openai';
		apiType = modelName.replace('openai/', '');
	} else if (modelName.includes('claude')) {
		provider = 'anthropic';
		apiType = modelName.replace('anthropic/', '');
	} else if (modelName.includes('gemini') || modelName.includes('google')) {
		provider = 'google';
		apiType = modelName.replace('google/', '');
	} else if (modelName.includes('deepseek')) {
		provider = 'deepseek';
		apiType = modelName.replace('deepseek/', '');
	} else if (modelName.includes('grok')) {
		provider = 'grok';
		apiType = modelName.replace('grok/', '');
	}
	// Default to 'local' for models like 'llama2', 'mistral', etc.

	return {
		name: displayName,
		api_type: apiType,
		provider: provider,
		owner: userId,
		created: new Date().toISOString(),
		updated: new Date().toISOString()
	};
}
