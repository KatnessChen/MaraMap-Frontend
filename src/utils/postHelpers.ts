/**
 * Utility functions for post content processing
 */

export interface Post {
  id: string;
  event_date: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
}

/**
 * Extract display title from post content or tags
 * Priority: bracketed title > tags > first line > default
 */
export function getDisplayTitle(post: Post): string {
  const match = post.content.match(/^\[(.*?)\]/);
  if (match) return match[1];
  
  if (post.tags && post.tags.length > 0) {
    return post.tags.slice(0, 2).join(" • ");
  }
  
  const firstLine = post.content.split('\n')[0].trim();
  return firstLine || "MaraMap 運動日誌";
}

/**
 * Extract display content, removing the bracketed title if present
 */
export function getDisplayContent(post: Post): string {
  const match = post.content.match(/^\[(.*?)\]/);
  let text = post.content;
  
  if (match) {
    text = text.replace(match[0], '').trim();
  }
  
  return text;
}

/**
 * Format the geo tag from category and event date
 */
export function getGeoTag(post: Post): string {
  const cat = post.category ? post.category.toUpperCase() : 'LOG';
  return `${cat} / ${post.event_date}`;
}
