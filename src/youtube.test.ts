import { describe, expect, it } from 'vitest';
import { parseYouTubeLink, youtubeError } from './youtube';

describe('YouTube links', () => {
  it.each([
    'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    'https://youtu.be/M7lc1UVf-VE',
    'https://m.youtube.com/watch?v=M7lc1UVf-VE',
    'youtube.com/shorts/M7lc1UVf-VE',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
    'https://www.youtube.com/live/M7lc1UVf-VE'
  ])('accepts an official video URL: %s', input => {
    expect(parseYouTubeLink(input)?.videoId).toBe('M7lc1UVf-VE');
    expect(parseYouTubeLink(input)?.url).toBe('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  });
  it('keeps playlists and starts without requiring API credentials', () => {
    expect(parseYouTubeLink('https://www.youtube.com/playlist?list=PL_test_12345')?.playlistId).toBe('PL_test_12345');
    const embedded = parseYouTubeLink('https://www.youtube.com/embed/videoseries?list=PL_test_12345');
    expect(embedded?.videoId).toBeUndefined();
    expect(embedded?.playlistId).toBe('PL_test_12345');
    expect(parseYouTubeLink('https://youtu.be/M7lc1UVf-VE?t=1h2m3s')?.startSeconds).toBe(3723);
  });
  it.each(['', 'https://youtube.com.evil.example/watch?v=M7lc1UVf-VE', 'javascript:alert(1)', 'https://youtube.com@evil.example/watch?v=M7lc1UVf-VE', 'https://evil.example/watch?v=M7lc1UVf-VE', 'https://youtube.com/watch?v=bad', 'https://youtube.com/playlist?list=x', 'https://user:password@youtube.com/watch?v=M7lc1UVf-VE'])('rejects invalid or misleading links: %s', input => {
    expect(parseYouTubeLink(input)).toBeNull();
  });
  it('removes tracking parameters from saved links', () => {
    const link = parseYouTubeLink('https://youtu.be/M7lc1UVf-VE?si=tracking&feature=share&t=15');
    expect(link?.url).toBe('https://www.youtube.com/watch?v=M7lc1UVf-VE&t=15');
  });
  it('explains private and non-embeddable videos', () => {
    expect(youtubeError(100)).toContain('privado');
    expect(youtubeError(150)).toContain('no permite insertar');
    expect(youtubeError(153)).toContain('origen');
  });
});
