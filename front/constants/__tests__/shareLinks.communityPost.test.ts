import {
  buildCommunityPostShareUrl,
  parseCommunityPostIdFromUrl,
  SHARE_BASE_URL,
} from '../shareLinks';

const POST_ID = '11111111-2222-3333-4444-555555555555';

describe('community post share URLs', () => {
  it('builds a link on the same path as the in-app post screen', () => {
    expect(buildCommunityPostShareUrl(POST_ID)).toBe(`${SHARE_BASE_URL}/community/post/${POST_ID}`);
  });

  it('falls back to the site root for ids that are not post ids', () => {
    expect(buildCommunityPostShareUrl('')).toBe(SHARE_BASE_URL);
    expect(buildCommunityPostShareUrl('../../u/omar')).toBe(SHARE_BASE_URL);
  });

  it('parses the https link, with or without query and fragment', () => {
    expect(parseCommunityPostIdFromUrl(`https://90plus.pro/community/post/${POST_ID}`)).toBe(POST_ID);
    expect(parseCommunityPostIdFromUrl(`https://90plus.pro/community/post/${POST_ID}?utm=wa#x`)).toBe(POST_ID);
  });

  it('parses the custom scheme the landing page opens', () => {
    expect(parseCommunityPostIdFromUrl(`ninetyplus://community/post/${POST_ID}`)).toBe(POST_ID);
  });

  it('round-trips what the share sheet sends', () => {
    expect(parseCommunityPostIdFromUrl(buildCommunityPostShareUrl(POST_ID))).toBe(POST_ID);
  });

  it('rejects junk and other share links', () => {
    expect(parseCommunityPostIdFromUrl('https://90plus.pro/community/post/')).toBeNull();
    expect(parseCommunityPostIdFromUrl('https://90plus.pro/community/post/not-a-uuid')).toBeNull();
    expect(parseCommunityPostIdFromUrl(`https://90plus.pro/reels/${POST_ID}`)).toBeNull();
    expect(parseCommunityPostIdFromUrl(`https://90plus.pro/x/community/post/${POST_ID}`)).toBeNull();
    expect(parseCommunityPostIdFromUrl('')).toBeNull();
  });
});
