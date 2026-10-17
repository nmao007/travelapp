import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/site.mjs';

test('Vercel handler serves preview, app, config, and validates API requests', async () => {
  async function fetch(path, options = {}) {
    let status = 200, body;
    const request = { url: path, method: options.method || 'GET', async *[Symbol.asyncIterator]() { if (options.body) yield Buffer.from(options.body); } };
    await handler(request, { writeHead(code) { status = code; }, end(value) { body = String(value); } });
    return { status, async text() { return body; }, async json() { return JSON.parse(body); } };
  }
  const base = '';
    for (const path of ['/', '/app', '/app.js', '/phone-devices.js', '/plan-navigation.js', '/trip-dates.js', '/travel-essentials.js', '/country-currencies.js', '/place-art.js', '/place-targets.js', '/trip-guide.js', '/flight-window.js', '/wallet-model.js', '/wallet-ui.js', '/wallet-export.js', '/expense-rates.js', '/board-model.js', '/phone.css']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.ok((await response.text()).length > 100);
    }
    const config = await (await fetch(base + '/api/site?endpoint=config')).json();
    assert.ok(Object.hasOwn(config, 'mapsKey'));
    assert.equal(Object.hasOwn(config, 'AERODATABOX_API_KEY'), false);
    assert.equal((await fetch(base + '/api/site?endpoint=timezone&lat=100&lng=0')).status, 400);
    const zone = await (await fetch(base + '/api/site?endpoint=timezone&lat=34.05&lng=-118.24')).json();
    assert.equal(zone.timeZone, 'America/Los_Angeles');
    assert.equal((await fetch(base + '/api/site?endpoint=route')).status, 405);
    assert.equal((await fetch(base + '/api/site?endpoint=weather')).status, 400);
    assert.equal((await fetch(base + '/api/site?endpoint=weather&lat=&lng=0')).status, 400);
    assert.equal((await fetch(base + '/api/site?endpoint=weather&lat=91&lng=0')).status, 400);
    assert.equal((await fetch(base + '/api/site?endpoint=exchange-rate&base=wrong&quote=EUR')).status, 400);
    assert.equal((await fetch(base + '/api/site?endpoint=route', { method: 'POST', body: '{broken' })).status, 400);
});

test('Vercel pre-parsed route body is validated rather than lost', async () => {
  let status, content;
  await handler({ url: '/api/site?endpoint=route', method: 'POST', body: {} }, {
    writeHead(code) { status = code; }, end(body) { content = JSON.parse(body); },
  });
  assert.equal(status, 400);
  assert.ok(content.error);
});
