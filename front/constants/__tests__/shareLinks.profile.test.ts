import {
  buildProfileShareUrl,
  parseProfileUsernameFromUrl,
} from '../shareLinks';

describe('profile share URLs', () => {
  it('builds a chat-safe /u/:username link', () => {
    expect(buildProfileShareUrl('Omar_90')).toMatch(/\/u\/Omar_90$/);
    expect(buildProfileShareUrl('@Omar_90')).toMatch(/\/u\/Omar_90$/);
  });

  it('parses canonical /u/ links', () => {
    expect(parseProfileUsernameFromUrl('https://90plus.pro/u/omar')).toBe('omar');
    expect(parseProfileUsernameFromUrl('https://90plus.pro/u/omar?x=1')).toBe('omar');
  });

  it('parses legacy /@ links and percent-encoded @', () => {
    expect(parseProfileUsernameFromUrl('https://90plus.pro/@omar')).toBe('omar');
    expect(parseProfileUsernameFromUrl('https://90plus.pro/%40omar')).toBe('omar');
  });

  it('parses the custom scheme used by QR landing pages', () => {
    expect(parseProfileUsernameFromUrl('ninetyplus://user/omar')).toBe('omar');
    expect(parseProfileUsernameFromUrl('ninetyplus://profile/omar')).toBe('omar');
  });

  it('rejects junk', () => {
    expect(parseProfileUsernameFromUrl('https://90plus.pro/u/')).toBeNull();
    expect(parseProfileUsernameFromUrl('https://90plus.pro/reels/abc')).toBeNull();
    expect(buildProfileShareUrl('bad name!')).not.toMatch(/\/u\//);
  });
});
