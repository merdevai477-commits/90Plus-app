import { Request, Response, NextFunction } from 'express';
import { requireKnowledgeExportAuth } from '../knowledge-export-auth.middleware';

function mockRes() {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  return res as Response & { statusCode?: number; body?: any };
}

describe('requireKnowledgeExportAuth', () => {
  const prev = process.env.KNOWLEDGE_EXPORT_API_KEY;

  afterEach(() => {
    if (prev === undefined) delete process.env.KNOWLEDGE_EXPORT_API_KEY;
    else process.env.KNOWLEDGE_EXPORT_API_KEY = prev;
  });

  it('rejects when API key env is missing (fail closed)', () => {
    delete process.env.KNOWLEDGE_EXPORT_API_KEY;
    const req = { headers: { 'x-api-key': 'anything' }, path: '/seasons', ip: '1.1.1.1' } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    requireKnowledgeExportAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalled();
  });

  it('rejects wrong API key (authentication failure)', () => {
    process.env.KNOWLEDGE_EXPORT_API_KEY = 'secret-correct';
    const req = {
      headers: { 'x-api-key': 'wrong' },
      path: '/seasons',
      ip: '1.1.1.1',
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    requireKnowledgeExportAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects missing API key header', () => {
    process.env.KNOWLEDGE_EXPORT_API_KEY = 'secret-correct';
    const req = { headers: {}, path: '/seasons', ip: '1.1.1.1' } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    requireKnowledgeExportAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('allows matching x-api-key', () => {
    process.env.KNOWLEDGE_EXPORT_API_KEY = 'secret-correct';
    const req = {
      headers: { 'x-api-key': 'secret-correct' },
      path: '/seasons',
      ip: '1.1.1.1',
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    requireKnowledgeExportAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows matching x-knowledge-export-key', () => {
    process.env.KNOWLEDGE_EXPORT_API_KEY = 'secret-correct';
    const req = {
      headers: { 'x-knowledge-export-key': 'secret-correct' },
      path: '/seasons',
      ip: '1.1.1.1',
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    requireKnowledgeExportAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
