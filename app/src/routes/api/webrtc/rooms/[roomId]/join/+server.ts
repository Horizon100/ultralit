import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params, request }) => {
  const { roomId } = params;
  const { userId } = await request.json();
  
  // Add participant to room
  return json({ 
    success: true, 
    signalingUrl: `ws://localhost:3003?roomId=${roomId}&userId=${userId}`
  });
};
