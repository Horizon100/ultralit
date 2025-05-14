// src/routes/api/game/hero/[id]/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ params, locals }) => {
 console.log(`[HERO GET] Looking for hero with id: ${params.id}`);
 
 if (!locals.pb.authStore.isValid) {
   console.log('[HERO GET] Not authenticated');
   throw error(401, 'Unauthorized');
 }

 try {
   console.log('[HERO GET] Querying game_heroes collection...');
   const hero = await pb.collection('game_heroes').getFirstListItem(`user="${params.id}"`, {
     expand: 'user'
   });
   
   console.log('[HERO GET] Found hero:', hero.id);
   return json({ hero });
 } catch (err) {
   console.error('[HERO GET] Error:', err);
   throw error(404, 'Hero not found');
 }
};

export const PATCH: RequestHandler = async ({ request, params, locals }) => {
 console.log(`[HERO PATCH] Updating hero for id: ${params.id}`);
 
 if (!locals.pb.authStore.isValid) {
   console.log('[HERO PATCH] Not authenticated');
   throw error(401, 'Unauthorized');
 }

 const updates = await request.json();
 console.log('[HERO PATCH] Updates:', updates);
 
 try {
   console.log('[HERO PATCH] Finding existing hero...');
   const hero = await pb.collection('game_heroes').getFirstListItem(`user="${params.id}"`);
   
   console.log('[HERO PATCH] Updating hero:', hero.id);
   const updatedHero = await pb.collection('game_heroes').update(hero.id, {
     ...updates,
     updated: new Date().toISOString()
   });
   
   console.log('[HERO PATCH] Hero updated successfully');
   return json({ hero: updatedHero });
 } catch (err) {
   console.error('[HERO PATCH] Error:', err);
   throw error(500, 'Failed to update hero');
 }
};