import { phoneMediaQuery } from './phone-devices.js';
import { enhanceDropdowns, refreshDropdowns } from './dropdowns.js';
import { playMotion } from './motion.js';
import { destinationCountry, countryCurrencies } from './country-currencies.js';

export function weatherLabel(code, isDay = true) {
  if (code === 0) return { symbol: isDay ? 'sun' : 'moon', label: 'Clear' };
  if (code >= 1 && code <= 3) return { symbol: 'cloud', label: 'Cloudy' };
  if (code === 45 || code === 48) return { symbol: 'cloud', label: 'Fog' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { symbol: 'snow', label: 'Snow' };
  if (code >= 95) return { symbol: 'rain', label: 'Thunderstorms' };
  if (code >= 51) return { symbol: 'rain', label: 'Rain' };
  return { symbol: 'cloud', label: 'Weather' };
}
export function convertedAmount(value, rate) {
  const amount = String(value).trim();
  if (!/^\d{1,12}(?:\.\d{0,4})?$/.test(amount) || !Number.isFinite(rate) || rate <= 0) return null;
  const result = Number(amount) * rate;
  return Number.isFinite(result) ? result : null;
}

export function createTravelEssentials({ state, getDestination, icon }) {
  const $ = id => document.getElementById(id), phone = matchMedia(phoneMediaQuery);
  const cache = new Map(), rates = new Map();
  const regionKey = destination => Number.isFinite(destination?.latitude) && Number.isFinite(destination?.longitude)
    ? `${Number(destination.latitude.toFixed(1))}:${Number(destination.longitude.toFixed(1))}:${destinationCountry(destination) || ''}` : null;
  let key = null, current = null, selected = null, weatherError = false, currencyChosen = false, rateVersion = 0, currentRate = null;
  const common = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'SGD', 'NZD', 'CNY', 'THB', 'KRW', 'MXN', 'AED'];
  let base = 'USD';
  try { const region = new Intl.Locale(navigator.language).maximize().region; base = countryCurrencies[region]?.[1] || 'USD'; } catch { /* The displayed base remains explicit and editable. */ }
  function options(select, value) {
    if (![...select.options].some(option => option.value === value)) { const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option); }
    select.value = value; refreshDropdowns(select);
  }
  for (const id of ['currency-base', 'currency-quote']) for (const code of common) { const option = document.createElement('option'); option.value = code; option.textContent = code; $(id).append(option); }
  options($('currency-base'), base); $('currency-quote').value = base === 'EUR' ? 'USD' : 'EUR';
  enhanceDropdowns();
  function convert() {
    const amount = convertedAmount($('currency-amount').value, currentRate?.rate);
    $('currency-result').textContent = amount === null ? '—' : new Intl.NumberFormat(navigator.language, { style: 'currency', currency: currentRate.quote, maximumFractionDigits: 2 }).format(amount);
  }
  async function loadRate(force = false) {
    if (!phone.matches || state.workspaceView !== 'transportation') return;
    const version = ++rateVersion, base = $('currency-base').value, quote = $('currency-quote').value, pair = `${base}:${quote}`;
    currentRate = null; convert(); $('currency-rate').textContent = 'Loading rate…'; $('currency-date').textContent = '';
    let entry = rates.get(pair);
    if (force || !entry || entry.expires < Date.now()) {
      entry = { expires: Date.now() + 60 * 60000, promise: fetch(`/api/exchange-rate?${new URLSearchParams({ base, quote })}`, { signal: AbortSignal.timeout(12000), credentials: 'omit', referrerPolicy: 'no-referrer' }).then(async response => { if (!response.ok) throw Error(); return response.json(); }) };
      rates.set(pair, entry); entry.promise.catch(() => rates.delete(pair));
    }
    try {
      const data = await entry.promise;
      if (version !== rateVersion) return;
      currentRate = data; $('currency-rate').textContent = `1 ${data.base} = ${new Intl.NumberFormat(navigator.language, { maximumFractionDigits: 4 }).format(data.rate)} ${data.quote}`;
      $('currency-date').textContent = `As of ${data.date} · reference rate`; convert();
    } catch { if (version === rateVersion) { $('currency-rate').replaceChildren(document.createTextNode('Rate unavailable ')); const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry'; retry.onclick = () => loadRate(true); $('currency-rate').append(retry); } }
  }
  $('currency-amount').addEventListener('input', convert);
  for (const id of ['currency-base', 'currency-quote']) $(id).addEventListener('change', () => { currencyChosen = true; loadRate(); });
  function paint() {
    const visible = phone.matches && state.workspaceView === 'transportation'; $('travel-essentials').hidden = !visible;
    if (!visible) return;
    const card = $('weather-card'); card.replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = selected?.name || 'Destination'; card.append(heading);
    if (current) {
      const clock = document.createElement('span'); clock.className = 'destination-clock'; clock.textContent = new Intl.DateTimeFormat(navigator.language, { timeZone: current.timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date()); heading.append(clock);
      const status = document.createElement('div'); status.className = 'current-weather'; const condition = weatherLabel(current.current.code, current.current.isDay);
      status.innerHTML = icon(condition.symbol); const temperature = document.createElement('strong'); temperature.textContent = `${Math.round(current.current.temperature)}°C`; const label = document.createElement('span'); label.textContent = `${condition.label} · now`; status.append(temperature, label); card.append(status);
      const days = document.createElement('div'); days.className = 'weather-days'; days.setAttribute('aria-label', 'Next five days');
      for (const day of current.days.slice(0, 5)) {
        const tile = document.createElement('div'); tile.className = 'weather-day'; const weekday = document.createElement('span'); weekday.textContent = new Intl.DateTimeFormat(navigator.language, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`));
        const high = document.createElement('strong'); high.textContent = `${Math.round(day.high)}°`; const low = document.createElement('small'); low.textContent = `${Math.round(day.low)}°`;
        tile.append(weekday); tile.insertAdjacentHTML('beforeend', icon(weatherLabel(day.code).symbol)); tile.append(high, low); tile.setAttribute('aria-label', `${day.date}: ${weatherLabel(day.code).label}, high ${Math.round(day.high)}, low ${Math.round(day.low)} degrees Celsius${day.rain === null ? '' : `, ${day.rain}% chance of rain`}`); days.append(tile);
      }
      card.append(days);
    } else {
      const status = document.createElement('p'); status.textContent = weatherError ? 'Weather unavailable' : 'Loading weather…'; card.append(status);
      if (weatherError) { const retry = document.createElement('button'); retry.textContent = 'Retry'; retry.type = 'button'; retry.onclick = () => { cache.delete(key); key = null; render(); }; card.append(retry); }
    }
    const source = document.createElement('a'); source.className = 'data-source'; source.href = 'https://open-meteo.com/'; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = 'Open-Meteo · city forecast'; card.append(source);
  }
  function render() {
    if (!state.trip || !phone.matches || state.workspaceView !== 'transportation') { $('travel-essentials').hidden = true; return; }
    const destination = getDestination();
    if (!Number.isFinite(destination?.latitude) || !Number.isFinite(destination?.longitude)) { current = null; selected = destination; key = null; paint(); return; }
    selected = destination;
    // Only a broad destination region leaves this browser. No trip names/dates.
    const lat = Number(destination.latitude.toFixed(1)), lng = Number(destination.longitude.toFixed(1)), next = regionKey(destination);
    const previous = cache.get(next);
    if (next !== key || !previous || previous.expires < Date.now()) {
      key = next; current = null; weatherError = false;
      let entry = previous;
      if (!entry || entry.expires < Date.now()) {
        const params = new URLSearchParams({ lat, lng }), country = destinationCountry(destination); if (country) params.set('country', country);
        entry = { expires: Date.now() + 30 * 60000, promise: fetch(`/api/weather?${params}`, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(12000) }).then(async response => { if (!response.ok) throw Error(); return response.json(); }) }; cache.set(next, entry);
      }
      entry.promise.then(data => {
        if (key !== next) return;
        current = data;
        if (!currencyChosen && data.currency) options($('currency-quote'), data.currency);
        paint(); loadRate();
        playMotion($('weather-card').querySelector('.current-weather>.icon'), [{scale:'.8',rotate:'-8deg'},{scale:'1.1',rotate:'3deg',offset:.7},{scale:'1',rotate:'0deg'}], {duration:380});
      }).catch(() => { if (key === next) { weatherError = true; paint(); } });
    }
    paint();
    if (state.workspaceView === 'transportation' && !currentRate) loadRate();
  }
  phone.addEventListener('change', render);
  return { render };
}
