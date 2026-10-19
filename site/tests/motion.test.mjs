import test from 'node:test';
import assert from 'node:assert/strict';
import { playMotion, stopMotion, closeDialogSmooth, morphFrames, morphFrom, revealSequence, celebratePlacement, installButtonMotion, installSurfaceMotion, createFrameScheduler, animateContentChange, createPopoverMotion, captureLayout, animateLayoutChange } from '../dist/motion.js';

test('reduced motion skips both shared-element movement and staggered entrances', () => {
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    let calls = 0;
    const element = { animate: () => { calls++; }, getBoundingClientRect: () => ({ left: 10, top: 10, width: 400, height: 300 }) };
    assert.equal(playMotion(element, [{ opacity: 0 }, { opacity: 1 }]), null);
    assert.equal(morphFrom(element, { left: 2, top: 4, width: 50, height: 80 }), null);
    revealSequence([element, element]);
    celebratePlacement(element);
    assert.equal(calls, 0);
  } finally { if (previous) globalThis.matchMedia = previous; else delete globalThis.matchMedia; }
});

test('tap feedback never runs for a swipe, a drag grip, or a cancelled pointer', () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    const listeners = new Map(); let animations = 0, grip = false;
    const glyph = { animate: () => { animations++; return { finished: Promise.resolve(), cancel() {} }; } };
    const button = { disabled: false, closest: () => grip, querySelector: () => glyph };
    const event = (x, y) => ({ target: { closest: () => button }, pointerId: 1, clientX: x, clientY: y });
    installButtonMotion({ addEventListener: (name, handler) => listeners.set(name, handler) });
    listeners.get('pointerdown')(event(10, 10)); listeners.get('pointerup')(event(10, 40));
    assert.equal(animations, 0);
    grip = true; listeners.get('pointerdown')(event(10, 10)); listeners.get('pointerup')(event(10, 10));
    assert.equal(animations, 0);
    grip = false; listeners.get('pointerdown')(event(10, 10)); listeners.get('pointercancel')(); listeners.get('pointerup')(event(10, 10));
    assert.equal(animations, 0);
    listeners.get('pointerdown')(event(10, 10)); listeners.get('pointerup')(event(12, 12));
    assert.equal(animations, 1);
  } finally { if (previous) globalThis.matchMedia = previous; else delete globalThis.matchMedia; }
});

test('day-preview movement is bounded and invalid geometry cannot create infinite transforms', () => {
  assert.equal(morphFrames({ left: 0, top: 0, width: 40, height: 30 }, { left: 0, top: 0, width: 0, height: 400 }), null);
  const frames = morphFrames({ left: 600, top: 300, width: 80, height: 100 }, { left: 420, top: 250, width: 430, height: 400 });
  assert.equal(frames.length, 3);
  assert.equal(frames.some(frame => /NaN|Infinity/.test(frame.transform)), false);
  assert.equal(frames.at(-1).opacity, 1);
  const reverse = [...frames].reverse().map(frame => ({ ...frame, offset: 1 - frame.offset }));
  assert.deepEqual(reverse.map(frame => frame.offset), [...reverse.map(frame => frame.offset)].sort((a, b) => a - b));
});

test('finished forwards-filled motion can be cancelled to release frozen layout styles', async () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    let cancels = 0;
    const element = { animate: () => ({ finished: Promise.resolve(), cancel: () => cancels++ }) };
    playMotion(element, [{ height: '0px' }, { height: '100px' }], { fill: 'forwards' });
    await Promise.resolve(); stopMotion(element); assert.equal(cancels, 1);
    playMotion(element, [{ opacity: 0 }, { opacity: 1 }], { fill: 'both' });
    await Promise.resolve(); playMotion(element, [{ opacity: 1 }, { opacity: 0 }]); assert.equal(cancels, 2);
  } finally { globalThis.matchMedia = previous; }
});

test('surface transitions cancel stale openings and never animate a closed or detached surface', () => {
  const originals = Object.fromEntries(['MutationObserver','requestAnimationFrame','cancelAnimationFrame','matchMedia'].map(key => [key,globalThis[key]]));
  let notify, sequence = 0, animations = 0;
  const queue = new Map();
  globalThis.MutationObserver = class { constructor(callback) { notify = callback; } observe() {} disconnect() {} };
  globalThis.requestAnimationFrame = callback => { queue.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = id => queue.delete(id);
  globalThis.matchMedia = () => ({ matches: false });
  const surface = { hidden: false, isConnected: true, children: [], matches: () => false, getClientRects: () => [1], animate: () => { animations++; return { finished: Promise.resolve(), cancel() {} }; } };
  const flush = () => { const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(callback => callback()); };
  try {
    const disconnect = installSurfaceMotion({ querySelectorAll: () => [surface] });
    notify([{ target: surface }]); surface.hidden = true; notify([{ target: surface }]);
    assert.equal(queue.size, 1); flush(); assert.equal(animations, 0);
    surface.hidden = false; surface.isConnected = false; notify([{ target: surface }]); flush(); assert.equal(animations, 0);
    surface.isConnected = true; notify([{ target: surface }]); flush(); assert.equal(animations, 1);
    surface.matches = () => true; surface.open = false; notify([{ target: surface }]); flush(); assert.equal(animations, 1);
    globalThis.matchMedia = () => ({ matches: true }); surface.matches = () => false;
    notify([{ target: surface }]); flush(); assert.equal(animations, 1);
    disconnect();
  } finally { for (const [key,value] of Object.entries(originals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});

test('fast pointer streams paint once per frame and release flushes the latest position', () => {
  let pending, calls = [], cancelled = 0;
  const scheduler = createFrameScheduler(value => calls.push(value), { request: callback => { pending = callback; return 1; }, cancel: () => { cancelled++; } });
  for (let i = 0; i < 100; i++) scheduler.schedule(i);
  assert.deepEqual(calls, []); pending(); assert.deepEqual(calls, [99]);
  scheduler.schedule(100); scheduler.schedule(101); scheduler.flush();
  assert.deepEqual(calls, [99,101]); assert.equal(cancelled, 1);
  pending(); assert.deepEqual(calls, [99,101]);
  scheduler.schedule(102); scheduler.cancel(); pending(); assert.deepEqual(calls, [99,101]);
});

test('bottom navigation stays still while ordinary action icons retain tap feedback', () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    const listeners = new Map(); let animations = 0, navigation = true;
    const glyph = { dataset: { art: 'plane' }, querySelector: () => null, animate: () => { animations++; return { finished: Promise.resolve(), cancel() {} }; } };
    const button = { disabled: false, closest: selector => navigation && selector.includes('.workspace-nav'), querySelector: () => glyph };
    const event = { target: { closest: () => button }, pointerId: 1, clientX: 10, clientY: 10 };
    installButtonMotion({ addEventListener: (name, handler) => listeners.set(name, handler) });
    listeners.get('pointerdown')(event); listeners.get('pointerup')(event);
    assert.equal(animations, 0);
    navigation = false;
    listeners.get('pointerdown')(event); listeners.get('pointerup')(event);
    assert.equal(animations, 1);
  } finally { if (previous) globalThis.matchMedia = previous; else delete globalThis.matchMedia; }
});


test('calendar close holds its modal layout until a short exit completes and ignores repeated taps', async () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    let finish, closes = 0, frames;
    const listeners = new Map();
    const dialog = { open: true, dataset: {}, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), close() { this.open = false; closes++; }, animate(value, options) { frames = value; assert.equal(options.duration, 160); return { finished: new Promise(resolve => { finish = resolve; }), cancel() {} }; } };
    const first = closeDialogSmooth(dialog), second = closeDialogSmooth(dialog);
    assert.equal(first, second); assert.equal(dialog.open, true); assert.equal(dialog.dataset.closing, 'true'); assert.equal(closes, 0);
    assert.ok(frames.every(frame => !Object.hasOwn(frame, 'height') && !/scale/.test(frame.transform)));
    finish(); await first;
    assert.equal(dialog.open, false); assert.equal(closes, 1); assert.equal(dialog.dataset.closing, undefined);
    assert.equal(listeners.size, 0);
  } finally { globalThis.matchMedia = previous; }
});

test('an external dialog handoff cancels the exit and cannot later close a reopened editor', async () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    let finish, closes = 0, cancelled = 0;
    const listeners = new Map();
    const dialog = { open: true, dataset: {}, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), close() { this.open = false; closes++; listeners.get('close')?.(); }, animate: () => ({ finished: new Promise(resolve => { finish = resolve; }), cancel() { cancelled++; } }) };
    const pending = closeDialogSmooth(dialog);
    dialog.close(); await pending; dialog.open = true; finish(); await Promise.resolve();
    assert.equal(dialog.open, true); assert.equal(closes, 1); assert.equal(cancelled, 1); assert.equal(dialog.dataset.closing, undefined);
  } finally { globalThis.matchMedia = previous; }
});

test('reduced-motion calendar closes immediately without a transitional frame', async () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: true });
  try {
    const dialog = { open: true, dataset: {}, addEventListener() {}, removeEventListener() {}, close() { this.open = false; }, animate() { assert.fail('Animation must be skipped'); } };
    await closeDialogSmooth(dialog); assert.equal(dialog.open, false); assert.equal(dialog.dataset.closing, undefined);
  } finally { globalThis.matchMedia = previous; }
});


test('a queued entrance cannot interrupt a closing dialog or restart its children', () => {
  const keys = ['MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia'];
  const originals = Object.fromEntries(keys.map(key => [key, globalThis[key]]));
  let notify, scheduled, animations = 0;
  globalThis.MutationObserver = class { constructor(callback) { notify = callback; } observe() {} disconnect() {} };
  globalThis.requestAnimationFrame = callback => { scheduled = callback; return 1; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.matchMedia = () => ({ matches: false });
  const dialog = { open: true, dataset: {}, hidden: false, isConnected: true, matches: selector => selector === 'dialog', getClientRects: () => [1], animate() { animations++; return { finished: Promise.resolve(), cancel() {} }; }, querySelector() { assert.fail('Children must not animate separately from their surface'); } };
  try {
    installSurfaceMotion({ querySelectorAll: () => [dialog] });
    notify([{ target: dialog }]); dialog.dataset.closing = 'true'; scheduled();
    assert.equal(animations, 0);
    delete dialog.dataset.closing; notify([{ target: dialog }]); scheduled();
    assert.equal(animations, 1);
  } finally { for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});

test('closing during entry continues from the visible opacity and position', async () => {
  const previous = globalThis.matchMedia, previousStyle = globalThis.getComputedStyle;
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.getComputedStyle = () => ({ opacity: '0.45', transform: 'matrix(1, 0, 0, 1, 0, 8)' });
  let finish, frames;
  const dialog = { open: true, dataset: {}, addEventListener() {}, removeEventListener() {}, close() { this.open = false; }, animate(value) { frames = value; return { finished: new Promise(resolve => { finish = resolve; }), cancel() {} }; } };
  try {
    const pending = closeDialogSmooth(dialog);
    assert.deepEqual(frames[0], { opacity: '0.45', transform: 'matrix(1, 0, 0, 1, 0, 8)' });
    assert.equal(dialog.open, true); finish(); await pending; assert.equal(dialog.open, false);
  } finally { globalThis.matchMedia = previous; if (previousStyle === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = previousStyle; }
});

test('Escape uses the complete dialog exit and removes its shared listener on teardown', async () => {
  const previous = globalThis.matchMedia, previousObserver = globalThis.MutationObserver;
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  let cancel, finish, prevented = 0, removed = 0;
  const dialog = { open: true, dataset: {}, matches: selector => selector === 'dialog', addEventListener() {}, removeEventListener() {}, close() { this.open = false; }, animate: () => ({ finished: new Promise(resolve => { finish = resolve; }), cancel() {} }) };
  try {
    const teardown = installSurfaceMotion({ querySelectorAll: () => [], addEventListener(name, handler, capture) { assert.equal(name, 'cancel'); assert.equal(capture, true); cancel = handler; }, removeEventListener(name, handler, capture) { assert.equal(handler, cancel); assert.equal(capture, true); removed++; } });
    cancel({ target: dialog, defaultPrevented: false, preventDefault() { prevented++; } });
    assert.equal(prevented, 1); assert.equal(dialog.open, true); assert.equal(dialog.dataset.closing, 'true');
    const pending = closeDialogSmooth(dialog); finish(); await pending; assert.equal(dialog.open, false);
    teardown(); assert.equal(removed, 1);
  } finally { globalThis.matchMedia = previous; if (previousObserver === undefined) delete globalThis.MutationObserver; else globalThis.MutationObserver = previousObserver; }
});


test('list entrances keep text at its final size and cap the stagger for long lists', () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    const calls = [];
    const elements = Array.from({ length: 30 }, () => ({ animate(frames, options) { calls.push({ frames, options }); return { finished: Promise.resolve(), cancel() {} }; } }));
    revealSequence(elements, { step: 25 });
    assert.equal(calls.length, 30);
    assert.ok(calls.every(({ frames }) => frames.length === 2 && frames.every(frame => !/scale/.test(frame.transform))));
    assert.ok(calls.every(({ options }) => options.delay <= 60 && options.duration <= 240));
    assert.deepEqual(calls[0].frames.at(-1), { opacity: 1, transform: 'none' });
  } finally { globalThis.matchMedia = previous; }
});

test('a reopened popover cannot be hidden by its previous exit animation', async () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches:false });
  try {
    let finish, hidden = 0, cancelled = 0;
    const surface = { inert:false, animate(frames, options) { return {finished: options.fill ? new Promise(resolve=>{finish=resolve;}) : Promise.resolve(),cancel(){cancelled++;}}; } };
    const motion = createPopoverMotion(surface,()=>{hidden++;});
    motion.close(); assert.equal(surface.inert,true);
    motion.open(); assert.equal(surface.inert,false);
    finish(); await Promise.resolve(); assert.equal(hidden,0); assert.ok(cancelled>0);
    motion.close(); finish(); await Promise.resolve(); assert.equal(hidden,1); assert.equal(surface.inert,false);
  } finally { globalThis.matchMedia=previous; }
});

test('reduced motion hides popovers immediately and skips content movement', () => {
  const previous=globalThis.matchMedia; globalThis.matchMedia=()=>({matches:true});
  try {
    let hidden=0; const surface={inert:false,animate(){assert.fail('Reduced motion must not animate');}};
    const motion=createPopoverMotion(surface,()=>hidden++);
    motion.open(); motion.close(); assert.equal(hidden,1); assert.equal(surface.inert,false);
    assert.equal(animateContentChange(surface),null);
  } finally {globalThis.matchMedia=previous;}
});

test('content changes use bounded movement and never scale text or change layout dimensions', () => {
  const previous=globalThis.matchMedia; globalThis.matchMedia=()=>({matches:false});
  try {
    const calls=[]; const surface={animate(frames,options){calls.push({frames,options});return {finished:Promise.resolve(),cancel(){}};}};
    animateContentChange(surface,{direction:42,distance:8});
    animateContentChange(surface,{direction:-42,distance:8});
    assert.equal(calls[0].frames[0].transform,'translateX(8px)');
    assert.equal(calls[1].frames[0].transform,'translateX(-8px)');
    assert.ok(calls.every(({frames})=>frames.every(frame=>!('height' in frame)&&!('width' in frame)&&!frame.transform.includes('scale'))));
  } finally {globalThis.matchMedia=previous;}
});


test('interrupted stop swaps continue from visible positions and batch all layout reads before animation writes', () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches:false });
  try {
    const work=[], frames=[];
    const row = name => ({name,top:0,offset:0,getBoundingClientRect(){work.push(`read:${name}`);return {left:0,top:this.top+this.offset};},animate(value){work.push(`animate:${name}`);frames.push([name,value]);this.offset=Number(/,(-?[\d.]+)px/.exec(value[0].transform)?.[1]||0);return {finished:new Promise(()=>{}),cancel:()=>{this.offset=0;}};}});
    const a=row('a'),b=row('b'); b.top=80;
    const initial=captureLayout([a,b]);a.top=80;b.top=0;
    animateLayoutChange([a,b],initial);
    a.offset=-30;b.offset=30; // Midway through the first swap.
    const visible=captureLayout([a,b]);a.top=0;b.top=80;work.length=0;
    animateLayoutChange([a,b],visible);
    assert.deepEqual(frames.at(-2)[1][0],{transform:'translate(0px,50px)'});
    assert.deepEqual(frames.at(-1)[1][0],{transform:'translate(0px,-50px)'});
    assert.deepEqual(work,['read:a','read:b','animate:a','animate:b']);
    assert.deepEqual(frames.at(-1)[1].at(-1),{transform:'translate(0,0)'});
    const calls=frames.length;animateLayoutChange([a,b],new Map());assert.equal(frames.length,calls);
  } finally {globalThis.matchMedia=previous;}
});

test('switching to reduced motion releases an in-flight swap without measuring or starting another animation', () => {
  const previous = globalThis.matchMedia; let reduced=false;
  globalThis.matchMedia = () => ({matches:reduced});
  try {
    let cancels=0,animations=0;
    const row={getBoundingClientRect(){assert.fail('Reduced motion must not measure layout');},animate(){animations++;return{finished:new Promise(()=>{}),cancel(){cancels++;}};}};
    playMotion(row,[{transform:'translateY(60px)'},{transform:'none'}]);
    reduced=true;
    const snapshot=captureLayout([row]);assert.equal(snapshot.size,0);
    animateLayoutChange([row],snapshot);
    assert.equal(cancels,1);assert.equal(animations,1);
  } finally {globalThis.matchMedia=previous;}
});
