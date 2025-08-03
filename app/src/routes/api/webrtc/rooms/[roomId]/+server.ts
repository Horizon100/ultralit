import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
  const { roomId } = params;
  // Fetch room details from PocketBase
  return json({ roomId, name: 'Sample Room' });
};

export const DELETE: RequestHandler = async ({ params }) => {
  const { roomId } = params;
  // Delete room from PocketBase
  return json({ success: true });
};
