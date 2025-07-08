// src/routes/api/tts/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { TTS_DEV_URL, TTS_PROD_URL } from '$env/static/private';

const TTS_BASE_URL = dev ? TTS_DEV_URL : TTS_PROD_URL;

interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
  language?: string;
}

interface TTSResponse {
  success: boolean;
  audio?: string;
  error?: string;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { text, voice, speed, language }: TTSRequest = await request.json();

    if (!text || text.trim().length === 0) {
      return json({ error: 'Text is required' }, { status: 400 });
    }

    console.log('🔊 TTS Request - Text length:', text.length, 'Server:', TTS_BASE_URL);

    // Make request to your Linux TTS server
    const response = await fetch(`${TTS_BASE_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text,
        voice: voice || 'default',
        speed: speed || 1.0,
        language: language || 'en'
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`TTS server error: ${response.status} ${response.statusText}`);
    }

    const result: TTSResponse = await response.json();
    console.log('🔊 TTS Response - Success:', result.success);

    if (result.success && result.audio) {
      return json({
        success: true,
        audio: result.audio
      });
    } else {
      throw new Error(result.error || 'TTS server returned no audio');
    }

  } catch (error) {
    console.error('🔊 TTS Error:', error);
    return json({ 
      error: `Failed to connect to TTS server: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 });
  }
};