import test from 'node:test';
import assert from 'node:assert/strict';
import {placeArt,paintPlaceArt,illustrationKinds} from '../dist/place-art.js';
import {createPlaceTargets} from '../dist/place-targets.js';

test('illustrations are local vector assets and unknown input cannot inject markup',()=>{
  assert.ok(illustrationKinds.length>=10);
  for(const kind of illustrationKinds){const markup=placeArt(kind);assert.match(markup,/viewBox="0 0 48 48"/);assert.doesNotMatch(markup,/<script|<image|https?:|onload=/i);}
  assert.equal(placeArt('<script>alert(1)</script>'),placeArt('pin'));
});
test('repainting the same icon avoids DOM changes and keeps its place identity',()=>{
  let writes=0;
  const svg={dataset:{iconPlaceId:'place'},classList:{add(){}},setAttribute(){},set innerHTML(value){writes++;}};
  paintPlaceArt(svg,'food');paintPlaceArt(svg,'food');assert.equal(writes,1);
  paintPlaceArt(svg,'landmark');assert.equal(writes,2);assert.equal(svg.dataset.iconPlaceId,'place');
});
test('place updates target their own mounted occurrences and release removed rows',()=>{
  const index=createPlaceTargets(),first={isConnected:true},second={isConnected:true},other={isConnected:true};
  index.add('one',first);index.add('one',first);index.add('one',second);index.add('two',other);
  assert.deepEqual([...index.get('one')],[first,second]);assert.deepEqual([...index.get('two')],[other]);
  first.isConnected=false;index.prune();assert.deepEqual([...index.get('one')],[second]);
  second.isConnected=false;index.prune();assert.deepEqual([...index.get('one')],[]);
  index.clear();assert.deepEqual([...index.get('two')],[]);
});
