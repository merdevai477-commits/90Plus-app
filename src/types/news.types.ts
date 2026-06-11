import type { NewsLanguage } from '../utils/world-cup-news-filter.util';

export interface WorldCupNewsArticle {
  id: string;
  title: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
  source: string;
  publishedAt: string;
  language: NewsLanguage;
}

export interface WorldCupNewsPage {
  total: number;
  page: number;
  pageSize: number;
  articles: WorldCupNewsArticle[];
}

export interface WorldCupNewsResponse {
  ar?: WorldCupNewsPage;
  en?: WorldCupNewsPage;
}
