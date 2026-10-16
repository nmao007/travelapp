import reference from './data/travel-reference.json' with { type: 'json' };

const fail = (message, status = 502) => Object.assign(new Error(message), { status });
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const currency = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value) && Object.values(reference.countries).includes(value);
const zone = value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return typeof value === 'string' && value.length < 80 ? value : null; } catch { return null; } };
export function currencyForZone(timeZone) {
  const countries = reference.zones[timeZone] || [];
  const currencies = [...new Set(countries.map(country => reference.countries[country]))];
  return currencies.length === 1 && currencies[0] ? currencies[0] : null;
}

export function createTravelDataService({ fetcher = fetch, now = Date.now, timezoneForPoint = () => null } = {}) {
  const cache = new Map();
  function memo(key, ttl, run) {
    const existing = cache.get(key);
    if (existing?.expires > now()) return existing.promise;
    const entry = { expires: now() + ttl, promise: Promise.resolve().then(run) };
    cache.set(key, entry);
    if (cache.size > 180) cache.delete(cache.keys().next().value);
    entry.promise.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
    return entry.promise;
  }
  async function json(url) {
    let response;
    try { response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }); }
    catch { throw fail('Travel data is temporarily unavailable.'); }
    if (!response.ok) throw fail('Travel data is temporarily unavailable.', response.status === 429 ? 429 : 502);
    try { return await response.json(); } catch { throw fail('The travel service returned an invalid response.'); }
  }
  return {
    async weather(latitude, longitude, countryCode = null) {
      if (!finite(latitude) || !finite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw fail('Choose a mapped destination.', 400);
      // A roughly 11 km region, never a precise stop, hotel, or device position.
      const lat = Number(latitude.toFixed(1)), lng = Number(longitude.toFixed(1));
      let timeZone; try { timeZone = zone(timezoneForPoint(lat, lng)); } catch { /* Provider determines its regional timezone. */ }
      const localCurrency = typeof countryCode === 'string' && /^[A-Z]{2}$/.test(countryCode) ? reference.countries[countryCode] || null : null;
      return memo(`weather:${lat}:${lng}:${timeZone || 'auto'}:${localCurrency || ''}`, 30 * 60000, async () => {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.search = new URLSearchParams({ latitude: String(lat), longitude: String(lng), timezone: timeZone || 'auto', forecast_days: '16', current: 'temperature_2m,weather_code,is_day,wind_speed_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' });
        const data = await json(url), current = data.current, daily = data.daily;
        if (!finite(current?.temperature_2m) || !Number.isInteger(current?.weather_code) || !Array.isArray(daily?.time)) throw fail('Weather is temporarily unavailable.');
        const resolvedZone = zone(data.timezone) || timeZone || 'UTC';
        const days = daily.time.map((day, index) => ({ date: day, code: daily.weather_code?.[index], high: daily.temperature_2m_max?.[index], low: daily.temperature_2m_min?.[index], rain: daily.precipitation_probability_max?.[index] }))
          .filter(day => date(day.date) && Number.isInteger(day.code) && finite(day.high) && finite(day.low) && day.high >= day.low)
          .slice(0, 16).map(day => ({ ...day, rain: finite(day.rain) ? Math.max(0, Math.min(100, day.rain)) : null }));
        return { current: { temperature: current.temperature_2m, code: current.weather_code, isDay: current.is_day === 1, wind: finite(current.wind_speed_10m) ? current.wind_speed_10m : null, time: String(current.time || '') }, days, timeZone: resolvedZone, currency: localCurrency || currencyForZone(resolvedZone), checkedAt: new Date(now()).toISOString(), source: 'Open-Meteo' };
      });
    },
    async rate(base, quote) {
      if (!currency(base) || !currency(quote)) throw fail('Choose valid currency codes.', 400);
      if (base === quote) return { base, quote, rate: 1, date: new Date(now()).toISOString().slice(0, 10), source: 'Frankfurter' };
      return memo(`rate:${base}:${quote}`, 60 * 60000, async () => {
        const data = await json(`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/${quote.toLowerCase()}`);
        if (data.base !== base || data.quote !== quote || !finite(data.rate) || data.rate <= 0 || !date(data.date)) throw fail('Exchange rates are temporarily unavailable.');
        return { base, quote, rate: data.rate, date: data.date, source: 'Frankfurter' };
      });
    },
  };
}
