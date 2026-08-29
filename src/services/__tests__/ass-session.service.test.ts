import { credentialsMatch, isAssConfigured } from '../ass-session.service';

describe('AsS credentials', () => {
  const prev = {
    user: process.env.ASS_USERNAME,
    pass: process.env.ASS_PASSWORD,
    secret: process.env.ASS_SESSION_SECRET,
  };

  afterEach(() => {
    process.env.ASS_USERNAME = prev.user;
    process.env.ASS_PASSWORD = prev.pass;
    process.env.ASS_SESSION_SECRET = prev.secret;
  });

  it('rejects when env is missing', () => {
    delete process.env.ASS_USERNAME;
    delete process.env.ASS_PASSWORD;
    delete process.env.ASS_SESSION_SECRET;
    expect(isAssConfigured()).toBe(false);
    expect(credentialsMatch('@90plus', 'x')).toBe(false);
  });

  it('accepts the configured username with or without @', () => {
    process.env.ASS_USERNAME = '@90plus';
    process.env.ASS_PASSWORD = 'adminplus#1';
    process.env.ASS_SESSION_SECRET = 'test-secret';
    expect(isAssConfigured()).toBe(true);
    expect(credentialsMatch('@90plus', 'adminplus#1')).toBe(true);
    expect(credentialsMatch('90plus', 'adminplus#1')).toBe(true);
    expect(credentialsMatch('@90plus', 'wrong')).toBe(false);
  });
});
