import type { ReactNode } from 'react';

import type { Post } from '@/api/posts';
import { ItemList, type ListQuery } from '@/components/item-list';
import { PostCard } from '@/components/post-card';

interface PostListProps {
  posts: Post[];
  query: ListQuery;
  header: ReactNode;
  emptyText: string;
  onEndReached?: () => void;
}

const keyOf = (post: Post) => post.id;
const renderPost = ({ item }: { item: Post }) => <PostCard post={item} />;

export function PostList({ posts, ...props }: PostListProps) {
  return <ItemList items={posts} keyOf={keyOf} renderItem={renderPost} {...props} />;
}
