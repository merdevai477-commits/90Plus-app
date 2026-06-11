import {
  filterWorldCupArticles,
  isWorldCupNewsArticle,
} from '../world-cup-news-filter.util';

describe('world-cup-news-filter', () => {
  it('keeps Arabic World Cup headlines', () => {
    const articles = [
      {
        title: '5 مباريات لا تُفوّت خلال دور المجموعات في مونديال 2026',
        description: 'كأس العالم',
        url: 'https://example.com/1',
      },
      {
        title: 'برشلونة يفوز على ريال مدريد',
        description: 'الدوري الإسباني',
        url: 'https://example.com/2',
      },
    ];

    const filtered = filterWorldCupArticles(articles, 'ar');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toContain('مونديال 2026');
  });

  it('keeps English World Cup headlines and drops cricket', () => {
    expect(
      isWorldCupNewsArticle(
        {
          title: 'Protesters block access to Azteca Stadium ahead of World Cup opener',
          url: 'https://example.com/wc',
        },
        'en',
      ),
    ).toBe(true);

    expect(
      isWorldCupNewsArticle(
        {
          title: 'India wins Cricket World Cup final',
          url: 'https://example.com/cricket',
        },
        'en',
      ),
    ).toBe(false);
  });
});
