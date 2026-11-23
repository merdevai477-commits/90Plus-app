import {
  appendChatStream,
  peekChatStream,
  resetChatStream,
  subscribeChatStream,
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

  it('paints the first token before later pieces are batched', () => {
    jest.useFakeTimers();
    const seen: string[] = [];
    const unsubscribe = subscribeChatStream(() => {
      seen.push(peekChatStream('a'));
    });
    appendChatStream('a', 'hi');
    appendChatStream('a', ' there');
    expect(seen).toEqual(['hi']);
    expect(peekChatStream('a')).toBe('hi there');
    jest.advanceTimersByTime(40);
    expect(seen.at(-1)).toBe('hi there');
    unsubscribe();
    jest.useRealTimers();
  });

  it('returns the visible reply once and then clears it', () => {
    appendChatStream('a', 'done');
    expect(takeChatStream('a')).toBe('done');
    expect(peekChatStream('a')).toBe('');
    expect(takeChatStream('a')).toBe('');
  });
});
