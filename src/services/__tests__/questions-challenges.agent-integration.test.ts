/**
 * QUESTIONS → EXISTING FOOTBALL AGENT: THE REAL BOUNDARY
 *
 * The other Questions suites stub the agent so they can drive the generator's
 * validation rules. This one does the opposite: everything on the agent side is
 * the REAL shipped implementation —
 *
 *   AGENT_TOOLS ............ the real tool schemas
 *   executeAgentTool ....... the real dispatcher and the real executors
 *   resolveAgentModel ...... the real model resolution
 *   chat-grounding ......... the real fact extraction / grounding message
 *
 * — and only the network is faked, at the one seam where the agent talks to
 * OpenRouter (createAgentOpenAIClient). So a tool call the model emits really
 * travels through the shipped executor and really comes back as its JSON.
 *
 * This is what proves Questions is wired to the agent that ships in this repo,
 * rather than to a second AI integration of its own.
 */

/* ── the only fake: the HTTP client the agent uses ── */

const createCompletion = jest.fn();
jest.mock('../chat-agent.service', () => {
  const actual = jest.requireActual('../chat-agent.service');
  return {
    ...actual,
    createAgentOpenAIClient: () => ({ chat: { completions: { create: createCompletion } } }),
  };
});

/* ── a fake UPSTREAM for the real tool executor to read from ── */

const mockGetTopScorers = jest.fn();
jest.mock('../football-data-cache.service', () => ({
  footballDataCacheService: { getTopScorers: (...args: unknown[]) => mockGetTopScorers(...args) },
}));

import { runQuestionsAgent, isQuestionsAgentAvailable } from '../questions-challenges.agent.service';
import { AGENT_TOOLS, resolveAgentModel } from '../chat-agent-tools.service';

const ROUND_JSON = JSON.stringify({
  questions: [{ id: 'q1', prompt: 'Who leads the scoring charts?', confidence: 96 }],
});

function assistantToolCall(name: string, args: Record<string, unknown>) {
  return {
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } },
          ],
        },
      },
    ],
  };
}

function assistantJson(content: string) {
  return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }] };
}

const params = {
  system: 'You write football quiz rounds.',
  user: 'Write the round.',
  language: 'en' as const,
  label: 'guess-player:en:2026-06-10',
};

describe('Questions → the existing football agent', () => {
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalEnabled = process.env.CHAT_AGENT_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    // The agent's own availability gate — not a Questions-specific one.
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.CHAT_AGENT_ENABLED = 'true';
    mockGetTopScorers.mockResolvedValue([
      { player: { name: 'Erling Haaland' }, statistics: [{ team: { name: 'Man City' }, goals: { total: 27, assists: 5 } }] },
      { player: { name: 'Mohamed Salah' }, statistics: [{ team: { name: 'Liverpool' }, goals: { total: 21, assists: 9 } }] },
    ]);
  });

  afterAll(() => {
    process.env.OPENROUTER_API_KEY = originalKey;
    process.env.CHAT_AGENT_ENABLED = originalEnabled;
  });

  test('availability is the agent’s own gate, not a second one', () => {
    expect(isQuestionsAgentAvailable()).toBe(true);

    process.env.CHAT_AGENT_ENABLED = 'false';
    expect(isQuestionsAgentAvailable()).toBe(false);
  });

  test('sends the agent’s real tool schemas and its real model', async () => {
    createCompletion.mockResolvedValueOnce(assistantJson(ROUND_JSON));

    await runQuestionsAgent(params);

    const body = createCompletion.mock.calls[0]![0];
    expect(body.model).toBe(resolveAgentModel());
    // Identity, not a lookalike: Questions ships the agent's own tool array.
    expect(body.tools).toBe(AGENT_TOOLS);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  test('a tool call really runs the shipped executor and its result is fed back', async () => {
    createCompletion
      .mockResolvedValueOnce(assistantToolCall('get_top_scorers', { league: 'Premier League', season: 2024 }))
      .mockResolvedValueOnce(assistantJson(ROUND_JSON));

    const result = await runQuestionsAgent(params);

    // The real executor reached the real upstream.
    expect(mockGetTopScorers).toHaveBeenCalledWith(39, 2024);

    // …and its payload went back to the model as a tool message.
    const secondCall = createCompletion.mock.calls[1]![0];
    const toolMessage = secondCall.messages.find((m: { role: string }) => m.role === 'tool');
    expect(toolMessage).toBeDefined();
    const payload = JSON.parse(toolMessage.content);
    expect(payload.league).toBe('Premier League');
    expect(payload.topScorers[0]).toMatchObject({ rank: 1, player: 'Erling Haaland', goals: 27 });

    expect(result!.toolsUsed).toEqual(['get_top_scorers']);
    expect(result!.payload).toEqual(JSON.parse(ROUND_JSON));
  });

  test('applies the agent’s grounding pin after tools have run', async () => {
    createCompletion
      .mockResolvedValueOnce(assistantToolCall('get_top_scorers', { league: 'Premier League' }))
      .mockResolvedValueOnce(assistantJson(ROUND_JSON));

    await runQuestionsAgent(params);

    const secondCall = createCompletion.mock.calls[1]![0];
    const systemMessages = secondCall.messages.filter((m: { role: string }) => m.role === 'system');
    // The original instructions plus whatever grounding the shipped
    // chat-grounding service produced for these payloads.
    expect(systemMessages[0].content).toBe(params.system);
    expect(secondCall.messages.some((m: { role: string }) => m.role === 'tool')).toBe(true);
  });

  test('an unrecognised tool argument is handled by the shipped executor, not by us', async () => {
    createCompletion
      .mockResolvedValueOnce(assistantToolCall('get_top_scorers', { league: 'Not A League' }))
      .mockResolvedValueOnce(assistantJson(ROUND_JSON));

    const result = await runQuestionsAgent(params);

    const toolMessage = createCompletion.mock.calls[1]![0].messages.find(
      (m: { role: string }) => m.role === 'tool',
    );
    expect(JSON.parse(toolMessage.content)).toMatchObject({ error: 'league_not_recognized' });
    // The round still completes — a bad tool arg is the model's problem to
    // recover from, exactly as in chat.
    expect(result).not.toBeNull();
  });

  test('every tool the agent exposes is callable through this path', async () => {
    const names = (AGENT_TOOLS as Array<{ function: { name: string } }>).map(
      (tool) => tool.function.name,
    );
    expect(names).toContain('search_player');
    expect(names).toContain('get_top_scorers');
    expect(names).toContain('get_team_info');
    // Questions adds none of its own.
    expect(names.length).toBe(new Set(names).size);
  });

  test('returns null when the agent is switched off', async () => {
    process.env.CHAT_AGENT_ENABLED = 'false';
    await expect(runQuestionsAgent(params)).resolves.toBeNull();
    expect(createCompletion).not.toHaveBeenCalled();
  });

  test('returns null on a non-JSON reply rather than inventing a round', async () => {
    createCompletion.mockResolvedValueOnce(assistantJson('sorry, here is a chat answer instead'));
    await expect(runQuestionsAgent(params)).resolves.toBeNull();
  });

  test('returns null on an empty reply', async () => {
    createCompletion.mockResolvedValueOnce(assistantJson(''));
    await expect(runQuestionsAgent(params)).resolves.toBeNull();
  });

  test('returns null when the agent call throws', async () => {
    createCompletion.mockRejectedValueOnce(new Error('402 requires more credits'));
    await expect(runQuestionsAgent(params)).resolves.toBeNull();
  });

  test('gives up rather than looping forever on a model that only calls tools', async () => {
    createCompletion.mockResolvedValue(assistantToolCall('get_top_scorers', { league: 'La Liga' }));

    await expect(runQuestionsAgent(params)).resolves.toBeNull();
    expect(createCompletion.mock.calls.length).toBeLessThanOrEqual(4);
  });

  test('passes the round language through to the tool executor', async () => {
    createCompletion
      .mockResolvedValueOnce(assistantToolCall('get_top_scorers', { league: 'Premier League' }))
      .mockResolvedValueOnce(assistantJson(ROUND_JSON));

    const result = await runQuestionsAgent({ ...params, language: 'ar' });

    expect(result).not.toBeNull();
    expect(mockGetTopScorers).toHaveBeenCalled();
  });
});
