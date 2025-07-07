// src/routes/api/ai/local/generate/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';
import * as pbServer from '$lib/server/pocketbase';
import { dev } from '$app/environment';
import { ContextAnalyzer } from '$lib/features/ai/utils/contextAnalyzer';
import type { LocalModelParams, GenerateRequest, OllamaGenerateResponse } from '$lib/types/types.localModels';
import { OLLAMA_DEV_URL, OLLAMA_PROD_URL } from '$env/static/private';

const OLLAMA_BASE_URL = dev ? OLLAMA_DEV_URL : OLLAMA_PROD_URL;

// Extended request type for image analysis
interface ExtendedGenerateRequest extends GenerateRequest {
  image_url?: string;
  is_image_analysis?: boolean;
}

// Function to convert image URL to base64
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    console.log('🖼️ Converting image URL to base64:', imageUrl);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    console.log('🖼️ Image converted to base64, size:', base64.length);
    return base64;
  } catch (error) {
    console.error('🖼️ Image conversion error:', error);
    throw new Error(`Failed to convert image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const POST: RequestHandler = async (event) =>
  apiTryCatch(async () => {
    const { request, cookies } = event;

    // Authentication (same pattern as your main AI API)
    const authCookie = cookies.get('pb_auth');
    console.log('🔍 Auth cookie exists:', !!authCookie);

    if (!authCookie) throw new Error('User not authenticated');

    let authData;
    try {
        authData = JSON.parse(authCookie);
        console.log('🔍 Parsed auth data:', { hasToken: !!authData.token, hasModel: !!authData.model });
        pbServer.pb.authStore.save(authData.token, authData.model);
    } catch (parseError) {
        console.error('🔍 Auth cookie parse error:', parseError);
        throw new Error('Failed to parse auth cookie');
    }

    console.log('🔍 Auth store valid after save:', pbServer.pb.authStore.isValid);

    if (!pbServer.pb.authStore.isValid) throw new Error('User not authenticated');

    const user = pbServer.pb.authStore.model;
    if (!user || !user.id) throw new Error('Invalid user session');

    console.log('🔍 Local AI Generate - User ID:', user.id);

    // Parse request
    const body: ExtendedGenerateRequest = await request.json();
    const { 
      prompt, 
      model = 'qwen2.5:0.5b', 
      system,
      temperature,
      max_tokens,
      stream = false,
      auto_optimize = true,
      image_url,
      is_image_analysis = false
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid or missing prompt');
    }

    console.log('🔍 Local AI Generate - Model:', model, 'Auto-optimize:', auto_optimize, 'Image analysis:', is_image_analysis);

    // Build parameters
    let params: LocalModelParams & { images?: string[] } = {
      model,
      prompt,
      stream
    };

    // Handle image analysis
    if (is_image_analysis && image_url) {
      console.log('🖼️ Processing image analysis with moondream');
      
      // Convert image to base64
      const base64Image = await imageUrlToBase64(image_url);
      
      // Add image to parameters for moondream
      params.images = [base64Image];
      
      // Use specific parameters for vision models
      params.temperature = temperature || 0.1;
      params.max_tokens = max_tokens || 200;
      
      console.log('🖼️ Image analysis params set');
    } else if (auto_optimize && !is_image_analysis) {
      // Auto-optimize parameters based on content (only for text analysis)
      const context = ContextAnalyzer.analyzeMessage(prompt);
      const optimizedParams = ContextAnalyzer.getOptimalParams(context);
      
      console.log(`🔍 Local AI Generate - Detected: ${context.type} (${Math.round(context.confidence * 100)}% confidence)`);
      
      // Merge optimized params with base params
      params = {
        ...params,
        ...optimizedParams,
        prompt // Keep original prompt
      };
    }

    // Apply manual overrides
    if (system) params.system = system;
    if (temperature !== undefined) params.temperature = temperature;
    if (max_tokens !== undefined) params.max_tokens = max_tokens;

    console.log('🔍 Local AI Generate - Final params:', {
      model: params.model,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      system: params.system ? 'Set' : 'None',
      hasImages: !!params.images?.length
    });

    try {
      // Call Ollama
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(is_image_analysis ? 120000 : 60000), // Longer timeout for image analysis
      });

      if (!response.ok) {
        throw new Error(`Ollama server error: ${response.status} ${response.statusText}`);
      }

      const data: OllamaGenerateResponse = await response.json();
      console.log('🔍 Local AI Generate - Response received, length:', data.response?.length);

      if (!data.response) {
        throw new Error('No response content from local model');
      }

      // Return plain object - apiTryCatch will wrap it with json()
      return {
        response: data.response,
        model: data.model,
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        timing: {
          total_duration: data.total_duration,
          load_duration: data.load_duration,
          prompt_eval_duration: data.prompt_eval_duration,
          eval_duration: data.eval_duration
        },
        context: data.context, // For conversation continuity
        provider: 'local',
        is_image_analysis
      };

    } catch (aiError) {
      console.error('🔍 Local AI Generate - Error calling Ollama:', aiError);
      
      throw new Error(
        `Local AI error: ${aiError instanceof Error ? aiError.message : String(aiError)}`
      );
    }
  }, 'Internal local AI generate error');