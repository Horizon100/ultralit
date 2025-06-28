import { get } from 'svelte/store';
import { t } from '$lib/stores/translationStore';
import type { InternalChatMessage, Threads } from '$lib/types/types';

/**
 * Date and time utilities for formatting and grouping
 */
export class DateUtils {
	/**
	 * Groups messages by date with translated labels
	 */
	static groupMessagesByDate(messages: InternalChatMessage[]) {
		const groups: { [key: string]: { messages: InternalChatMessage[]; displayDate: string } } = {};
		const today = new Date().setHours(0, 0, 0, 0);
		const yesterday = new Date(today - 86400000).setHours(0, 0, 0, 0);
		const $t = get(t);

		messages.forEach((message) => {
			const messageDate = new Date(message.created).setHours(0, 0, 0, 0);
			const dateKey = new Date(messageDate).toISOString().split('T')[0];
			let displayDate: string;

			if (messageDate === today) {
				displayDate = $t('threads.today') as string;
			} else if (messageDate === yesterday) {
				displayDate = $t('threads.yesterday') as string;
			} else {
				const date = new Date(messageDate);
				displayDate = date.toLocaleDateString('en-US', {
					weekday: 'short',
					day: '2-digit',
					month: 'short',
					year: 'numeric'
				});
			}

			if (!groups[dateKey]) {
				groups[dateKey] = { messages: [], displayDate };
			}
			groups[dateKey].messages.push(message);
		});

		return Object.entries(groups)
			.map(([date, { messages, displayDate }]) => ({
				date,
				displayDate,
				messages: messages.sort(
					(a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
				),
				isRecent: false
			}))
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	}

	/**
	 * Gets a date group label for a thread
	 */
	static getThreadDateGroup(thread: Threads): string {
		const $t = get(t);
		const now = new Date();
		const threadDate = new Date(thread.updated);
		const diffDays = Math.floor((now.getTime() - threadDate.getTime()) / (1000 * 3600 * 24));

		if (diffDays === 0) return $t('threads.today') as string;
		if (diffDays === 1) return $t('threads.yesterday') as string;

		// Format other dates as "Sat, 14. Dec 2024"
		return threadDate.toLocaleDateString('en-US', {
			weekday: 'short',
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	/**
	 * Gets a time-based group label for any date
	 */
	static getTimeGroup(date: Date): string {
		const $t = get(t);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

		const diffTime = today.getTime() - targetDate.getTime();
		const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
		const diffWeeks = Math.floor(diffDays / 7);
		const diffMonths =
			now.getMonth() - date.getMonth() + 12 * (now.getFullYear() - date.getFullYear());
		const diffYears = now.getFullYear() - date.getFullYear();

		if (diffDays === 0) {
			return $t('dates.today') as string;
		} else if (diffDays === 1) {
			return $t('dates.yesterday') as string;
		} else if (diffDays >= 2 && diffDays <= 6) {
			return `${diffDays} ${$t('dates.daysAgo') as string}`;
		} else if (diffWeeks === 1) {
			return $t('dates.weekAgo') as string;
		} else if (diffWeeks >= 2 && diffWeeks <= 4) {
			return `${diffWeeks} ${$t('dates.weeksAgo') as string}`;
		} else if (diffMonths === 1) {
			return $t('dates.monthAgo') as string;
		} else if (diffMonths >= 2 && diffMonths <= 11) {
			return `${diffMonths} ${$t('dates.monthsAgo') as string}`;
		} else if (diffYears === 1) {
			return $t('dates.yearAgo') as string;
		} else if (diffYears > 1) {
			return `${diffYears} ${$t('dates.yearsAgo') as string}`;
		}

		return $t('dates.monthAgo') as string;
	}

	/**
	 * Groups threads by time periods
	 */
	static groupThreadsByTime(threads: any[]) {
		const $t = get(t);
		const grouped: { [key: string]: any[] } = {};

		threads.forEach((thread) => {
			const date = thread.updated ? new Date(thread.updated) : new Date(thread.created);
			if (!isNaN(date.getTime())) {
				const group = this.getTimeGroup(date);
				if (!grouped[group]) {
					grouped[group] = [];
				}
				grouped[group].push(thread);
			}
		});

		const getGroupOrder = () => [
			$t('dates.today') as string,
			$t('dates.yesterday') as string,
			`2 ${$t('dates.daysAgo') as string}`,
			`3 ${$t('dates.daysAgo') as string}`,
			`4 ${$t('dates.daysAgo') as string}`,
			`5 ${$t('dates.daysAgo') as string}`,
			`6 ${$t('dates.daysAgo') as string}`,
			$t('dates.weekAgo') as string,
			`2 ${$t('dates.weeksAgo') as string}`,
			`3 ${$t('dates.weeksAgo') as string}`,
			`4 ${$t('dates.weeksAgo') as string}`,
			$t('dates.monthAgo') as string,
			`2 ${$t('dates.monthsAgo') as string}`,
			`3 ${$t('dates.monthsAgo') as string}`,
			`4 ${$t('dates.monthsAgo') as string}`,
			`5 ${$t('dates.monthsAgo') as string}`,
			`6 ${$t('dates.monthsAgo') as string}`,
			`7 ${$t('dates.monthsAgo') as string}`,
			`8 ${$t('dates.monthsAgo') as string}`,
			`9 ${$t('dates.monthsAgo') as string}`,
			`10 ${$t('dates.monthsAgo') as string}`,
			`11 ${$t('dates.monthsAgo') as string}`,
			$t('dates.yearAgo') as string
		];

		const sortedGroups: { group: string; threads: any[] }[] = [];
		const groupOrder = getGroupOrder();

		// Add groups that exist in our threads
		groupOrder.forEach((group) => {
			if (grouped[group] && grouped[group].length > 0) {
				sortedGroups.push({ group, threads: grouped[group] });
			}
		});

		// Add any remaining groups (like multiple years ago)
		Object.keys(grouped).forEach((group) => {
			if (!groupOrder.includes(group) && grouped[group].length > 0) {
				sortedGroups.push({ group, threads: grouped[group] });
			}
		});

		return sortedGroups;
	}

	/**
	 * Formats a date for display
	 */
	static formatDisplayDate(date: Date | string): string {
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		return dateObj.toLocaleDateString('en-US', {
			weekday: 'short',
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	/**
	 * Formats a date for relative display (e.g., "2 hours ago")
	 */
	static formatRelativeDate(date: Date | string): string {
		const $t = get(t);
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		const now = new Date();
		const diffMs = now.getTime() - dateObj.getTime();
		const diffSeconds = Math.floor(diffMs / 1000);
		const diffMinutes = Math.floor(diffSeconds / 60);
		const diffHours = Math.floor(diffMinutes / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffSeconds < 60) {
			return ($t('dates.justNow') as string) || 'Just now';
		} else if (diffMinutes < 60) {
			return `${diffMinutes} ${($t('dates.minutesAgo') as string) || 'minutes ago'}`;
		} else if (diffHours < 24) {
			return `${diffHours} ${($t('dates.hoursAgo') as string) || 'hours ago'}`;
		} else if (diffDays < 7) {
			return `${diffDays} ${($t('dates.daysAgo') as string) || 'days ago'}`;
		} else {
			return this.formatDisplayDate(dateObj);
		}
	}

	/**
	 * Checks if a date is today
	 */
	static isToday(date: Date | string): boolean {
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		const today = new Date();
		return dateObj.toDateString() === today.toDateString();
	}

	/**
	 * Checks if a date is yesterday
	 */
	static isYesterday(date: Date | string): boolean {
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		return dateObj.toDateString() === yesterday.toDateString();
	}

	/**
	 * Gets the start of day for a date
	 */
	static getStartOfDay(date: Date | string): Date {
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
	}

	/**
	 * Gets the end of day for a date
	 */
	static getEndOfDay(date: Date | string): Date {
		const dateObj = typeof date === 'string' ? new Date(date) : date;
		return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
	}

	/**
	 * Checks if two dates are the same day
	 */
	static isSameDay(date1: Date | string, date2: Date | string): boolean {
		const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
		const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
		return d1.toDateString() === d2.toDateString();
	}

	/**
	 * Gets a date range label (e.g., "Last 7 days")
	 */
	static getDateRangeLabel(startDate: Date, endDate: Date): string {
		const $t = get(t);
		const diffMs = endDate.getTime() - startDate.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays <= 1) {
			return this.isToday(endDate)
				? ($t('dates.today') as string)
				: this.formatDisplayDate(endDate);
		} else if (diffDays <= 7) {
			return `${$t('dates.last') as string} ${diffDays} ${$t('dates.days') as string}`;
		} else if (diffDays <= 30) {
			const weeks = Math.floor(diffDays / 7);
			return `${$t('dates.last') as string} ${weeks} ${weeks === 1 ? ($t('dates.week') as string) : ($t('dates.weeks') as string)}`;
		} else {
			const months = Math.floor(diffDays / 30);
			return `${$t('dates.last') as string} ${months} ${months === 1 ? ($t('dates.month') as string) : ($t('dates.months') as string)}`;
		}
	}
}
