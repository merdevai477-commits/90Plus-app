import {
  appendChatStream,
  peekChatStream,
  resetChatStream,
  takeChatStream,
} from '../chatStreamText';

describe('chatStreamText', () => {
  afterEach(() => {
    resetChatStream();
  });

  it('appends text for the active reply and ignores other ids', () => {
    appendChatStream('a', 'hello');
    appendChatStream('a', ' world');
    expect(peekChatStream('a')).toBe('hello world');
    expect(peekChatStream('b')).toBe('');
  });

  it('returns the visible reply once and then clears it', () => {
    appendChatStream('a', 'done');
    expect(takeChatStream('a')).toBe('done');
    expect(peekChatStream('a')).toBe('');
    expect(takeChatStream('a')).toBe('');
  });
});
