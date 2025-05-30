export interface PostAttachment {
	id: string;
	post: string;
	file_path: string;
	file_type:
		| 'image'
		| 'video'
		| 'document'
		| 'audio'
		| 'archive'
		| 'spreadsheet'
		| 'presentation'
		| 'code'
		| 'ebook';
	file_size: number;
	original_name: string;
	mime_type: string;
	created: string;
	updated: string;
}

export interface Post {
	id: string;
	content: string;
	user: string;
	attachments?: PostAttachment[];
	upvotedBy: string[];
	downvotedBy: string[];
	repostedBy: string[];
	commentedBy: string[];
	sharedBy: string[];
	quotedBy: string[];
	readBy: string[];
	upvoteCount: number;
	downvoteCount: number;
	repostCount: number;
	commentCount: number;
	shareCount: number;
	quoteCount: number;
	readCount: number;
	parent: string;
	children: string[];
	quotedPost: string;
	created: string;
	updated: string;
}

export interface PostWithInteractions extends Post {
	upvote: boolean;
	downvote: boolean;
	repost: boolean;
	preview: boolean;
	hasRead: boolean;
	share: boolean;
	quote: boolean;
	author_name?: string;
	author_username?: string;
	author_avatar?: string;
	expand?: {
		user?: {
			id: string;
			name?: string;
			username?: string;
			avatar?: string;
		};
	};
}

export interface PostWithInteractionsExtended extends PostWithInteractions {
	expand?: {
		user?: {
			id: string;
			name?: string;
			username?: string;
			avatar?: string;
		};
	};
}

