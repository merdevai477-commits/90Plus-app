describe('isLmtGloballyDisabled', () => {
  const original = process.env.LMT_DISABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.LMT_DISABLED;
    else process.env.LMT_DISABLED = original;
    jest.resetModules();
  });

  it('is off by default', async () => {
    delete process.env.LMT_DISABLED;
    jest.resetModules();
    const { isLmtGloballyDisabled } = await import('../lmt.config');
    expect(isLmtGloballyDisabled()).toBe(false);
  });

  it.each(['true', '1', 'YES', 'on'])('treats %s as disabled', async (value) => {
    process.env.LMT_DISABLED = value;
    jest.resetModules();
    const { isLmtGloballyDisabled } = await import('../lmt.config');
    expect(isLmtGloballyDisabled()).toBe(true);
  });
});
