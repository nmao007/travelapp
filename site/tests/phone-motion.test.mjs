import test from 'node:test';
import assert from 'node:assert/strict';
import { phonePlaceSymbol } from '../dist/phone-motion.js';

test('offline phone icon hints never replace a provider category or an explicit kind', () => {
  assert.equal(phonePlaceSymbol({ name: 'Museu Nacional do Azulejo' }, 'pin'), 'landmark');
  assert.equal(phonePlaceSymbol({ name: 'Museum Hotel', category: 'Museum' }, 'pin'), 'pin');
  assert.equal(phonePlaceSymbol({ name: 'Museum Hotel' }, 'stay'), 'stay');
  assert.equal(phonePlaceSymbol({ name: 'Pink Street' }, 'pin'), 'pin');
});
