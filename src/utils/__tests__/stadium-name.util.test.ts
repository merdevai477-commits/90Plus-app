import { normalizeStadiumName } from '../stadium-name.util';

describe('normalizeStadiumName', () => {
  it('trims, lowercases, and collapses spaces', () => {
    expect(normalizeStadiumName('  Anfield   Stadium  ')).toEqual({
      original: 'Anfield Stadium',
      normalized: 'anfield stadium',
      stripped: 'anfield',
    });
  });

  it('strips diacritics for matching while keeping original display text', () => {
    const result = normalizeStadiumName('Estádio da Luz');
    expect(result.original).toBe('Estádio da Luz');
    expect(result.normalized).toBe('estadio da luz');
    expect(result.stripped).toBe('da luz');
  });

  it('drops common venue-type noise words including Arabic ملعب', () => {
    expect(normalizeStadiumName('ملعب القاهرة الدولي').stripped).toBe('القاهرة الدولي');
    expect(normalizeStadiumName('Allianz Arena').stripped).toBe('allianz');
    expect(normalizeStadiumName('Old Trafford').stripped).toBe('old trafford');
  });

  it('falls back to normalized when the name is only a noise word', () => {
    expect(normalizeStadiumName('Stadium').stripped).toBe('stadium');
  });
});
