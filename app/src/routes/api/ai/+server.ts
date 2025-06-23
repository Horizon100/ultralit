import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { AIMessage, AIModel, ProviderType} from '$lib/types/types';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import * as pbServer from '$lib/server/pocketbase';
import { CryptoService } from '$lib/utils/crypto';
import { apiTryCatch, pbTryCatch, unwrap } from '$lib/utils/errorUtils';

export const POST: RequestHandler = async (event) =>
  apiTryCatch(async () => {
    const { request, cookies } = event;

    // Inline restoreAuth
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

    console.log('🔍 AI API Debug - User ID:', user.id);

    // MOVED: Parse request body FIRST to get model info
    let messages: AIMessage[];
    let attachment: File | null = null;
    let model: AIModel;
    let userId: string;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();

      const messagesData = formData.get('messages');
      if (typeof messagesData !== 'string') throw new Error('Invalid messages data');
      messages = JSON.parse(messagesData);

      const modelData = formData.get('model');
      if (typeof modelData !== 'string') throw new Error('Invalid model data');
      model = JSON.parse(modelData) as AIModel;

      const userIdData = formData.get('userId');
      if (typeof userIdData !== 'string') throw new Error('Invalid userId');
      userId = userIdData;

      attachment = formData.get('attachment') as File | null;
      if (attachment) {
        messages.push({
          role: 'user',
          content: `[Attachment: ${attachment.name}]`,
          provider: model.provider,
          model: model.api_type
        });
      }
    } else {
      const body = await request.json();
      messages = body.messages;
      model = body.model;
      userId = body.userId;
    }

    if (userId !== user.id) throw new Error('Unauthorized: User ID mismatch');
    if (!messages || !Array.isArray(messages) || messages.length === 0) throw new Error('Missing or invalid messages array');
    if (!model || !model.provider) throw new Error('Missing or invalid model information');

    // NOW get user keys after we know what model/provider we need
    const userDataResult = await pbTryCatch(pbServer.pb.collection('users').getOne(user.id), 'fetch user data');
    const userData = unwrap(userDataResult);

    console.log('🔍 AI API Debug - userData.api_keys exists:', !!userData.api_keys);
    console.log('🔍 AI API Debug - userData.api_keys type:', typeof userData.api_keys);

    let userKeys: Partial<Record<ProviderType, string>> = {};    
    if (userData.api_keys) {
      try {
        console.log('🔍 AI API Debug - Attempting to decrypt API keys...');
        const decryptedKeys = await CryptoService.decrypt(userData.api_keys, user.id);
        console.log('🔍 AI API Debug - Decryption successful');
        
        userKeys = JSON.parse(decryptedKeys);
        console.log('🔍 AI API Debug - Decrypted keys providers:', Object.keys(userKeys));
      } catch (e) {
        console.error('🔍 AI API Debug - Error decrypting API keys:', e);
        throw new Error('Error decrypting API keys: ' + (e instanceof Error ? e.message : String(e)));
      }
    } else {
      console.log('🔍 AI API Debug - No api_keys field found in user data');
      throw new Error('No API keys configured for user');
    }

    console.log('🔍 AI API Debug - Requested provider:', model.provider);
    console.log('🔍 AI API Debug - API key for provider exists:', !!userKeys[model.provider]);

    const apiKey = userKeys[model.provider];
    if (!apiKey) {
      const availableProviders = Object.keys(userKeys);
      console.log('🔍 AI API Debug - Available providers:', availableProviders);
      throw new Error(`${model.provider} API key not configured. Available providers: ${availableProviders.join(', ')}`);
    }

    console.log('🔍 AI API Debug - Using API key for provider:', model.provider, 'Key starts with:', apiKey.substring(0, 8) + '...');

    const systemMessage = messages.find((msg) => msg.role === 'system');
    if (!systemMessage && messages.length > 0) {
      const promptType = messages[0]?.prompt_type;
      const promptInput = messages[0]?.prompt_input;
      const systemParts = [];

      if (promptType) {
        systemParts.push(`You are an AI assistant using the ${promptType} prompt style. Format your responses accordingly.`);
      }
      if (promptInput) {
        systemParts.push(promptInput);
      }

      const systemContent = systemParts.join('\n\n');
      messages.unshift({
        role: 'system',
        content: systemContent,
        provider: model.provider,
        model: model.api_type
      });
    }

    
    let response: string;

    console.log('🔍 AI API Debug - About to call AI provider:', model.provider);
    console.log('🔍 AI API Debug - Model API type:', model.api_type);
    console.log('🔍 AI API Debug - Messages count:', messages.length);

    try {
      if (model.provider === 'openai' || model.provider === 'deepseek' || model.provider === 'grok') {
        const baseURL =
          model.provider === 'deepseek' ? 'https://api.deepseek.com/v1' :
          model.provider === 'grok' ? 'https://api.x.ai/v1' : undefined;

        console.log('🔍 AI API Debug - OpenAI-compatible provider, baseURL:', baseURL);

        const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

        const aiMessages = messages.map((msg) => ({
          role: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'system',
          content: msg.content
        })) as ChatCompletionMessageParam[];

        console.log('🔍 AI API Debug - Converted messages:', aiMessages.length);

        const modelName = model.api_type || (model.provider === 'openai' ? 'gpt-3.5-turbo' : 'deepseek-chat');
        console.log('🔍 AI API Debug - Using model name:', modelName);

        const completion = await client.chat.completions.create({
          model: modelName,
          messages: aiMessages,
          temperature: 0.7,
          max_tokens: 1500
        });

        console.log('🔍 AI API Debug - Completion received, choices count:', completion.choices?.length);

        if (!completion.choices[0]?.message?.content) {
          console.error('🔍 AI API Debug - No content in completion:', completion);
          throw new Error(`Invalid response format from ${model.provider} - no content received`);
        }

        response = completion.choices[0].message.content;
        console.log('🔍 AI API Debug - Response extracted successfully, length:', response.length);

      } else if (model.provider === 'anthropic') {
        console.log('🔍 AI API Debug - Using Anthropic provider');
        
        const anthropic = new Anthropic({ apiKey });

        const systemMsg = messages.find((msg) => msg.role === 'system');
        const systemContent = systemMsg ? systemMsg.content : '';

        const anthropicMessages = messages
          .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
          .map((msg) => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));

        console.log('🔍 AI API Debug - Anthropic messages prepared:', anthropicMessages.length);

        const requestPayload = {
          model: model.api_type || 'claude-3-sonnet-20240229',
          messages: anthropicMessages,
          max_tokens: 1500,
          temperature: 0.7,
          ...(systemContent && { system: systemContent })
        };

        console.log('🔍 AI API Debug - Anthropic request payload model:', requestPayload.model);

        const completion = await anthropic.messages.create(requestPayload);

        console.log('🔍 AI API Debug - Anthropic completion received');

        if (!completion.content || completion.content.length === 0) {
          console.error('🔍 AI API Debug - No content in Anthropic completion:', completion);
          throw new Error('Invalid response format from Anthropic');
        }

        const textBlock = completion.content[0];
        if (textBlock.type === 'text') {
          response = (textBlock as TextBlock).text;
          console.log('🔍 AI API Debug - Anthropic response extracted successfully');
        } else {
          throw new Error('Invalid response content type from Anthropic');
        }
      } else {
        throw new Error(`Unsupported AI provider: ${model.provider}`);
      }

      console.log('🔍 AI API Debug - Final response ready, returning success');
      return json({ response, success: true });

} catch (aiError) {
      console.error('🔍 AI API Debug - Error calling AI provider:', aiError);
      console.error('🔍 AI API Debug - Error details:', {
        name: aiError instanceof Error ? aiError.name : 'Unknown',
        message: aiError instanceof Error ? aiError.message : String(aiError),
        stack: aiError instanceof Error ? aiError.stack : undefined
      });
      
      return json({ 
        success: false, 
        error: `AI provider error: ${aiError instanceof Error ? aiError.message : String(aiError)}`,
        provider: model.provider,
        model: model.api_type
      });
    }
  }, 'Internal AI API error');