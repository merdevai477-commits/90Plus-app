import { QuizTheme } from '../../types/quiz-theme.types';
import {
  getQuizThemeCampaign,
  resolveQuizTheme,
  resolveTopicFocus,
} from '../../constants/quiz-theme.config';
import { buildQuizSystemPrompt, buildQuizUserPrompt } from '../quiz-prompt.builder';
import type { QuizEntitySlice } from '../../types/quiz-entity.types';

const emptySlice: QuizEntitySlice = { players: [], clubs: [], stadiums: [] };

describe('quiz theme', () => {
  test('resolveQuizTheme defaults to DEFAULT', () => {
    expect(resolveQuizTheme({})).toBe(QuizTheme.DEFAULT);
    expect(resolveQuizTheme({ QUIZ_THEME: 'DEFAULT' })).toBe(QuizTheme.DEFAULT);
  });

  test('resolveQuizTheme accepts WORLD_CUP and WORLD_CUP_MODE alias', () => {
    expect(resolveQuizTheme({ QUIZ_THEME: 'WORLD_CUP' })).toBe(QuizTheme.WORLD_CUP);
    expect(resolveQuizTheme({ QUIZ_THEME: 'world_cup_mode' })).toBe(QuizTheme.WORLD_CUP);
  });

  test('resolveQuizTheme falls back on unknown value', () => {
    expect(resolveQuizTheme({ QUIZ_THEME: 'UNKNOWN_THEME' })).toBe(QuizTheme.DEFAULT);
  });

  test('WORLD_CUP campaign overrides topic focus', () => {
    const daily = 'Premier League clubs and players';
    const focused = resolveTopicFocus(QuizTheme.WORLD_CUP, daily);
    expect(focused).toContain('FIFA World Cup');
    expect(focused).not.toBe(daily);
    expect(resolveTopicFocus(QuizTheme.DEFAULT, daily)).toBe(daily);
  });

  test('WORLD_CUP campaign restricts allowed types', () => {
    const campaign = getQuizThemeCampaign(QuizTheme.WORLD_CUP);
    expect(campaign?.allowedTypes).toEqual(['normal', 'image', 'guess_player']);
    expect(campaign?.typeTargets).toEqual({
      normal: 8,
      image: 4,
      guess_player: 3,
      logo: 0,
      stadium: 0,
    });
  });

  test('buildQuizSystemPrompt injects World Cup block when themed', () => {
    const system = buildQuizSystemPrompt({
      language: 'en',
      topicFocus: 'Test',
      theme: QuizTheme.WORLD_CUP,
    });
    expect(system).toContain('CAMPAIGN THEME: FIFA WORLD CUP');
    expect(system).toContain('Generate only FIFA World Cup related questions');
    expect(system).toContain('TYPE MIX: 8× "normal", 4× "image", 3× "guess_player"');
    expect(system).not.toContain('3× "logo"');
  });

  test('buildQuizSystemPrompt unchanged for DEFAULT theme', () => {
    const system = buildQuizSystemPrompt({
      language: 'en',
      topicFocus: 'Test',
      theme: QuizTheme.DEFAULT,
    });
    expect(system).not.toContain('CAMPAIGN THEME');
    expect(system).toContain('3× "logo"');
  });

  test('buildQuizUserPrompt injects World Cup line when themed', () => {
    const user = buildQuizUserPrompt({
      language: 'en',
      packDate: '2026-06-10',
      topicFocus: 'FIFA World Cup history',
      slice: emptySlice,
      theme: QuizTheme.WORLD_CUP,
    });
    expect(user).toContain('Generate only FIFA World Cup related questions.');
  });

  test('buildQuizUserPrompt has no theme line for DEFAULT', () => {
    const user = buildQuizUserPrompt({
      language: 'en',
      packDate: '2026-06-10',
      topicFocus: 'Premier League',
      slice: emptySlice,
      theme: QuizTheme.DEFAULT,
    });
    expect(user).not.toContain('Generate only FIFA World Cup related questions.');
  });
});
