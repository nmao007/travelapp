export function createExpenseRates({ fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map();
  return async (base, quote) => {
    if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) throw new Error('Choose valid currency codes.');
    const key = `${base}:${quote}`, saved = cache.get(key);
    if (saved && saved.expires > now()) return saved.promise;
    const entry = { expires: now() + 3600000 };
    entry.promise = Promise.resolve().then(async () => {
      const response = await fetcher(`/api/exchange-rate?${new URLSearchParams({ base, quote })}`, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Rate unavailable. Enter a rate manually.');
      const data = await response.json();
      if (data.base !== base || data.quote !== quote || !Number.isFinite(data.rate) || data.rate <= 0 || data.rate > 1e9 || !/^\d{4}-\d{2}-\d{2}$/.test(data.date || '') || new Date(data.date).toISOString().slice(0, 10) !== data.date) throw new Error('Rate unavailable. Enter a rate manually.');
      return { value: data.rate, date: data.date, source: 'Frankfurter' };
    });
    cache.set(key, entry); if (cache.size > 80) cache.delete(cache.keys().next().value);
    try { return await entry.promise; } catch (error) { if (cache.get(key) === entry) cache.delete(key); throw error; }
  };
}
