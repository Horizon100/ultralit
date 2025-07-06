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




export const POST: RequestHandler = async (event) =>
  apiTryCatch(async () => {
    const { request, cookies } = event;

    // Authentication (same pattern as your main AI API)
    const authCookie = cookies.get('pb_auth');
    if (!authCookie) throw new Error('User not authenticated');
    
    let authData;
    try {
      authData = JSON.parse(authCookie);
      pbServer.pb.authStore.save(authData.token, authData.model);
    } catch {
      throw new Error('Failed to parse auth cookie');
    }
    
    if (!pbServer.pb.authStore.isValid) throw new Error('User not authenticated');
    
    const user = pbServer.pb.authStore.model;
    if (!user || !user.id) throw new Error('Invalid user session');

    console.log('🔍 Local AI Generate - User ID:', user.id);

    // Parse request
    const body: GenerateRequest = await request.json();
    const { 
      prompt, 
      model = 'qwen2.5:0.5b', 
      system,
      temperature,
      max_tokens,
      stream = false,
      auto_optimize = true
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid or missing prompt');
    }

    console.log('🔍 Local AI Generate - Model:', model, 'Auto-optimize:', auto_optimize);

    // Build parameters
    let params: LocalModelParams = {
      model,
      prompt,
      stream
    };

    // Auto-optimize parameters based on content
    if (auto_optimize) {
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
      system: params.system ? 'Set' : 'None'
    });

    try {
      // Call Ollama
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(60000), // 60 second timeout
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
        provider: 'local'
      };

    } catch (aiError) {
      console.error('🔍 Local AI Generate - Error calling Ollama:', aiError);
      
      throw new Error(
        `Local AI error: ${aiError instanceof Error ? aiError.message : String(aiError)}`
      );
    }
  }, 'Internal local AI generate error');