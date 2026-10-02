import test from 'node:test';
import assert from 'node:assert/strict';
import { googlePlaceRecord, googleDescription, googleRatingLabel, mergeGoogleContent } from '../dist/place-model.js';

test('Google descriptions and review scores survive place normalization', () => {
  const place = googlePlaceRecord({ id: 'real', displayName: 'Restaurant', location: { lat: () => 35, lng: () => 135 }, rating: 4.7, userRatingCount: 1200, editorialSummary: 'Google editorial description.', googleMapsURI: 'https://maps.google.com/?cid=1' });
  assert.equal(place.editorialSummary, 'Google editorial description.');
  assert.equal(googleRatingLabel(place), '4.7 · 1,200 reviews');
  assert.equal(place.googleMapsURI, 'https://maps.google.com/?cid=1');
});
test('missing Google summaries never become Wikipedia extracts or invented descriptions', () => {
  assert.equal(googleDescription(null), '');
  assert.equal(googleDescription({ extract: 'Wikipedia text', description: 'Photo caption' }), '');
  assert.equal(googleDescription({ text: 'Google text' }), 'Google text');
  assert.equal(googleRatingLabel({ rating: undefined, ratingCount: 200 }), '');
  assert.equal(googleRatingLabel({ rating: 6 }), '');
  assert.equal(googleRatingLabel({ rating: 4.5, ratingCount: 1 }), '4.5 · 1 review');
});
test('partial and failed details cannot erase existing real Google photos, ratings or summaries', () => {
  const photo = { getURI: () => 'real-photo' };
  const source = { placeId: 'real', photos: [photo], rating: 4.6, ratingCount: 20, editorialSummary: 'Google summary.' };
  const merged = mergeGoogleContent(source, { placeId: 'real', photos: [], rating: undefined, editorialSummary: '', address: 'Actual address' });
  assert.equal(merged.photos[0], photo); assert.equal(merged.rating, 4.6); assert.equal(merged.editorialSummary, 'Google summary.');
  assert.equal(merged.address, 'Actual address'); assert.equal(source.address, undefined);
  assert.equal(mergeGoogleContent(source, { placeId: 'neighbor', rating: 5 }).rating, 4.6);
  assert.equal(mergeGoogleContent(source, { placeId: 'real', rating: 4.8, ratingCount: 0 }).ratingCount, 0);
});
