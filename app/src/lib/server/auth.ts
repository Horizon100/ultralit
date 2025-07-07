import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export function requireAuth(event: RequestEvent) {
  if (!event.locals.user) {
    throw redirect(302, '/auth');
  }
  return event.locals.user;
}

export function requireAdmin(event: RequestEvent) {
  const user = requireAuth(event);
  if (!user.role || user.role !== 'admin') {
    throw redirect(302, '/');
  }
  return user;
}