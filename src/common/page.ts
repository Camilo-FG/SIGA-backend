export type Page<T> = { data: T[]; total: number; page: number; limit: number };

export function pageResult<T>(data: T[], total: number, page = 1, limit = 20): Page<T> {
  return { data, total, page, limit };
}

export function pageWindow(page = 1, limit = 20) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 20;
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}
