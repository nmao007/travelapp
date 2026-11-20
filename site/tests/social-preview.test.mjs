import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialPreview, parseTikTokPage, placeCandidates, socialProvider } from '../social-preview.mjs';

const tiktokPage = item => `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { 'webapp.reflow.video.detail': { itemInfo: { itemStruct: item } } } })}</script></html>`;

test('recognises the apps people share travel videos from', () => {
  assert.equal(socialProvider(new URL('https://vm.tiktok.com/ZMabc/')), 'tiktok');
  assert.equal(socialProvider(new URL('https://www.instagram.com/reel/xyz/')), 'instagram');
  assert.equal(socialProvider(new URL('https://youtu.be/abc')), 'youtube');
  assert.equal(socialProvider(new URL('https://example.com/blog')), 'web');
});

test('place candidates come from the location tag, pins and descriptive hashtags', () => {
  const caption = 'Best morning in Kyoto 🌸\n📍 Fushimi Inari Taisha\n📍 Arashiyama Bamboo Grove #kyoto #japantravel #fyp #travel #TeaHouse';
  assert.deepEqual(placeCandidates(caption, 'Gion, Kyoto'), ['Gion, Kyoto', 'Fushimi Inari Taisha', 'Arashiyama Bamboo Grove', 'kyoto']);
  assert.deepEqual(placeCandidates('Location: Café Kitsuné, Paris\nso good #foodie #paris'), ['Café Kitsuné, Paris', 'paris']);
  assert.deepEqual(placeCandidates('#fyp #viral #travel'), []);
});

test('reads the caption, creator and cover from a TikTok page', () => {
  const parsed = parseTikTokPage(tiktokPage({ desc: 'Kyoto at dawn 📍 Fushimi Inari', author: { uniqueId: 'kyotoeats', nickname: 'Kyoto Eats' }, video: { cover: 'https://p16.tiktokcdn.com/cover.jpg' }, poi: { name: 'Fushimi Inari Taisha', city: 'Kyoto' } }));
  assert.deepEqual(parsed, { title: 'Kyoto at dawn 📍 Fushimi Inari', author: 'Kyoto Eats', handle: '@kyotoeats', image: 'https://p16.tiktokcdn.com/cover.jpg', poi: 'Fushimi Inari Taisha, Kyoto' });
  assert.equal(parseTikTokPage('<html>no data</html>'), null);
});

test('a TikTok preview suggests the places its caption names, once each', async () => {
  const requests = [];
  const request = async url => { requests.push(url); return { ok: true, url: 'https://www.tiktok.com/@kyotoeats/video/1', text: async () => tiktokPage({ desc: '📍 Fushimi Inari #kyoto #fyp', author: { uniqueId: 'kyotoeats' }, video: { cover: 'https://p16.tiktokcdn.com/c.jpg' } }) }; };
  const lookups = [];
  const places = { autocomplete: async ({ input, scope }) => { lookups.push([input, scope]); return input === 'kyoto' ? [{ placeId: 'kyoto-id', name: 'Kyoto', detail: 'Japan' }] : [{ placeId: 'inari-id', name: 'Fushimi Inari Taisha', detail: 'Kyoto, Japan' }]; } };
  const service = createSocialPreview({ request, places });
  const preview = await service.preview('https://vm.tiktok.com/ZMabc/', 'key', 'client');
  assert.equal(preview.provider, 'tiktok');
  assert.equal(preview.url, 'https://www.tiktok.com/@kyotoeats/video/1');
  assert.equal(preview.handle, '@kyotoeats');
  assert.deepEqual(preview.places.map(place => place.name), ['Fushimi Inari Taisha', 'Kyoto']);
  assert.deepEqual(lookups, [['Fushimi Inari', 'all'], ['kyoto', 'all']]);
  // Cached for repeat shares of the same link.
  await service.preview('https://vm.tiktok.com/ZMabc/', 'key', 'client');
  assert.equal(requests.length, 1);
});

test('TikTok redirects to another site are refused', async () => {
  const service = createSocialPreview({ request: async () => ({ ok: true, url: 'https://evil.example/', text: async () => '' }) });
  await assert.rejects(service.preview('https://vm.tiktok.com/x/'), /could not be reached/);
});

test('Instagram gets a link card, other sites the generic preview, and bad links are refused', async () => {
  const service = createSocialPreview({ request: async () => { throw new Error('no network'); }, genericPreview: async () => ({ title: 'A blog post', image: 'https://example.com/a.jpg' }) });
  const insta = await service.preview('https://www.instagram.com/reel/xyz/');
  assert.deepEqual([insta.provider, insta.title, insta.places], ['instagram', '', []]);
  const web = await service.preview('https://example.com/post');
  assert.deepEqual([web.provider, web.title, web.image], ['web', 'A blog post', 'https://example.com/a.jpg']);
  await assert.rejects(service.preview('http://example.com/'), { status: 400 });
  await assert.rejects(service.preview('not a link'), { status: 400 });
});
