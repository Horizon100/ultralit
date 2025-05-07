import { json } from '@sveltejs/kit';

export async function GET() {
  return json({ success: true, message: 'Auth API test successful' });
}