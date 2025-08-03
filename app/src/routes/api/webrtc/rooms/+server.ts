import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, locals }) => {
  // Fetch rooms from PocketBase
  return json([]);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const { name } = await request.json();
  
  // Create room in PocketBase
  const room = {
    roomId: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString()
  };
  
  return json(room, { status: 201 });
};
