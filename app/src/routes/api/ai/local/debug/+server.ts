// src/routes/api/ai/local/debug/+server.ts
// Debug endpoint to check Ollama connectivity

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';
import * as pbServer from '$lib/server/pocketbase';
import { dev } from '$app/environment';
import { OLLAMA_DEV_URL, OLLAMA_PROD_URL } from '$env/static/private';

const OLLAMA_BASE_URL = dev ? OLLAMA_DEV_URL : OLLAMA_PROD_URL;

export const GET: RequestHandler = async (event) =>
  apiTryCatch(async () => {
    const { cookies } = event;

    // Basic auth check
    const authCookie = cookies.get('pb_auth');
    if (!authCookie) throw new Error('User not authenticated');

    console.log('🔍 Ollama Debug - Base URL:', OLLAMA_BASE_URL);
    console.log('🔍 Environment:', dev ? 'development' : 'production');

    const debugResults = {
      environment: dev ? 'development' : 'production',
      baseUrl: OLLAMA_BASE_URL,
      tests: []
    };

    // Test 1: Check if Ollama server is running
    try {
      console.log('🔍 Testing Ollama server connectivity...');
      const response = await fetch(`${OLLAMA_BASE_URL}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      debugResults.tests.push({
        test: 'Server Connectivity',
        url: `${OLLAMA_BASE_URL}/api/version`,
        status: response.status,
        ok: response.ok,
        result: response.ok ? 'PASS' : 'FAIL',
        data: response.ok ? await response.json() : await response.text()
      });
    } catch (error) {
      debugResults.tests.push({
        test: 'Server Connectivity',
        url: `${OLLAMA_BASE_URL}/api/version`,
        result: 'FAIL',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 2: List available models
    try {
      console.log('🔍 Testing model list endpoint...');
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      const data = response.ok ? await response.json() : await response.text();
      
      debugResults.tests.push({
        test: 'List Models',
        url: `${OLLAMA_BASE_URL}/api/tags`,
        status: response.status,
        ok: response.ok,
        result: response.ok ? 'PASS' : 'FAIL',
        data: data,
        models: response.ok && data.models ? data.models.map(m => m.name) : []
      });
    } catch (error) {
      debugResults.tests.push({
        test: 'List Models',
        url: `${OLLAMA_BASE_URL}/api/tags`,
        result: 'FAIL',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 3: Test generate endpoint with a simple prompt
    try {
      console.log('🔍 Testing generate endpoint...');
      const testModel = 'qwen2.5:0.5b'; // The model from your logs
      
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: testModel,
          prompt: 'Hello',
          stream: false
        }),
        signal: AbortSignal.timeout(10000)
      });

      const data = response.ok ? await response.json() : await response.text();
      
      debugResults.tests.push({
        test: 'Generate Test',
        url: `${OLLAMA_BASE_URL}/api/generate`,
        model: testModel,
        status: response.status,
        ok: response.ok,
        result: response.ok ? 'PASS' : 'FAIL',
        data: typeof data === 'object' ? { 
          hasResponse: !!data.response,
          responseLength: data.response?.length || 0 
        } : data
      });
    } catch (error) {
      debugResults.tests.push({
        test: 'Generate Test',
        url: `${OLLAMA_BASE_URL}/api/generate`,
        result: 'FAIL',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 4: Check specific model exists
    const modelToCheck = 'qwen2.5:0.5b';
    try {
      console.log('🔍 Testing specific model:', modelToCheck);
      const response = await fetch(`${OLLAMA_BASE_URL}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelToCheck
        }),
        signal: AbortSignal.timeout(5000)
      });

      const data = response.ok ? await response.json() : await response.text();
      
      debugResults.tests.push({
        test: 'Model Check',
        url: `${OLLAMA_BASE_URL}/api/show`,
        model: modelToCheck,
        status: response.status,
        ok: response.ok,
        result: response.ok ? 'PASS' : 'FAIL',
        data: response.ok ? { 
          modelExists: true,
          family: data.details?.family || 'unknown'
        } : data
      });
    } catch (error) {
      debugResults.tests.push({
        test: 'Model Check',
        url: `${OLLAMA_BASE_URL}/api/show`,
        model: modelToCheck,
        result: 'FAIL',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    console.log('🔍 Debug results:', debugResults);
    return debugResults;

  }, 'Ollama debug error');