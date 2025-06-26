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
	 agents?: string[];
	upvoteCount: number;
	downvoteCount: number;
	repostCount: number;
	commentCount: number;
	shareCount: number;
	tagCount: number;
	quoteCount: number;
	readCount: number;
	parent: string;
	children: string[];
	tags: string[];
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
	agents?: string[];
	tagCount: number;
	tags: string[];
	author_name?: string;
	author_username?: string;
	author_avatar?: string;
	isRepost?: boolean;
	originalPostId?: string;
	repostedBy_id?: string;
	repostedBy_username?: string;
	repostedBy_name?: string;
	repostedBy_avatar?: string;
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

export type PostStoreState = {
	posts: PostWithInteractions[];
	loading: boolean;
	loadingMore: boolean;
	hasMore: boolean;
	error: string | null;
};

export interface TimelinePost extends PostWithInteractions {
	isRepost?: boolean;
	originalPostId?: string;
	repostedBy_id?: string;
	repostedBy_username?: string;
	repostedBy_name?: string;
	repostedBy_avatar?: string;
}