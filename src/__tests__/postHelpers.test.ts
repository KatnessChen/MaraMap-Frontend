import { getDisplayTitle, getDisplayContent, getGeoTag, Post } from '@/utils/postHelpers';

describe('Post Helper Functions', () => {
  const mockPost: Post = {
    id: '1',
    event_date: '2025-03-13',
    title: 'Test Post',
    content: '[Test Title] This is the test content',
    category: 'MARATHON',
    tags: ['running', 'marathon'],
  };

  describe('getDisplayTitle', () => {
    it('should extract bracketed title when present', () => {
      const title = getDisplayTitle(mockPost);
      expect(title).toBe('Test Title');
    });

    it('should fallback to tags when no bracketed title', () => {
      const postWithoutBrackets: Post = {
        ...mockPost,
        content: 'This is the test content',
      };
      const title = getDisplayTitle(postWithoutBrackets);
      expect(title).toBe('running • marathon');
    });

    it('should fallback to first line when no tags', () => {
      const postWithoutTags: Post = {
        ...mockPost,
        content: 'This is the test content',
        tags: [],
      };
      const title = getDisplayTitle(postWithoutTags);
      expect(title).toBe('This is the test content');
    });

    it('should return default when all else fails', () => {
      const emptyPost: Post = {
        ...mockPost,
        content: '',
        tags: [],
      };
      const title = getDisplayTitle(emptyPost);
      expect(title).toBe('MaraMap 運動日誌');
    });
  });

  describe('getDisplayContent', () => {
    it('should remove bracketed title from content', () => {
      const content = getDisplayContent(mockPost);
      expect(content).toBe('This is the test content');
      expect(content).not.toContain('[Test Title]');
    });

    it('should return full content when no bracketed title', () => {
      const postWithoutBrackets: Post = {
        ...mockPost,
        content: 'This is the full content',
      };
      const content = getDisplayContent(postWithoutBrackets);
      expect(content).toBe('This is the full content');
    });
  });

  describe('getGeoTag', () => {
    it('should format geo tag with category and date', () => {
      const tag = getGeoTag(mockPost);
      expect(tag).toBe('MARATHON / 2025-03-13');
    });

    it('should use LOG as default category when missing', () => {
      const postNoCat: Post = {
        ...mockPost,
        category: '',
      };
      const tag = getGeoTag(postNoCat);
      expect(tag).toBe('LOG / 2025-03-13');
    });
  });
});
