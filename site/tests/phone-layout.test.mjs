import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneDevices, phoneDevice, phoneViewport, dropdownBounds } from '../dist/phone-devices.js';
import { phoneHardware, phonePreviewScale } from '../dist/phone-hardware.js';

test('iPhone 18 frames retain the independent Apple drawing dimensions and cutouts', () => {
  for (const [id, body, display, inset, island] of [
    ['iphone18pro', [71.85, 150.01], [66.57, 144.73], 2.64, 15.66],
    ['iphone18promax', [77.98, 163.43], [72.86, 158.31], 2.56, 15.68],
  ]) {
    const device = phoneDevice(id), hardware = phoneHardware(device);
    assert.equal(hardware.measured, true);
    const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .02, `${actual} differs from ${expected}`);
    near(hardware.bodyWidth / hardware.scale, body[0]);
    near(hardware.bodyHeight / hardware.scale, body[1]);
    near(device.width / hardware.scale, display[0]);
    near(device.height / hardware.scale, display[1]);
    near(hardware.screenLeft / hardware.scale, inset);
    near(hardware.screenTop / hardware.scale, inset);
    near(hardware.cutoutWidth / hardware.scale, island);
    near(hardware.cutoutHeight / hardware.scale, 6.07);
    near(hardware.cutoutTop / hardware.scale, 2.315);
    near(hardware.cutoutLeft * 2 + hardware.cutoutWidth, device.width);
    assert.ok(hardware.cutoutTop + hardware.cutoutHeight < device.safeTop);
    assert.ok(hardware.bodyPath.startsWith('M') && hardware.bodyPath.endsWith('Z'));
    assert.ok(hardware.screenPath.startsWith('M') && !hardware.screenPath.includes('NaN'));
    near(hardware.buttons.action.top / hardware.scale, 30.83);
    near(hardware.buttons.side.height / hardware.scale, 17.7);
    assert.equal(hardware.buttons.camera.protrusion, 0);
  }
  assert.notEqual(phoneHardware(phoneDevice('iphone18pro')).screenLeft, phoneHardware(phoneDevice('iphone18promax')).screenLeft);
  assert.equal(phoneHardware(phoneDevice('iphone16')).measured, false);
});

test('phone fitting uses the measured housing and preserves a uniform scale', () => {
  for (const id of ['iphone18pro', 'iphone18promax', 'iphone16']) {
    const device = phoneDevice(id), hardware = phoneHardware(device);
    for (const [width, height] of [[1280, 720], [1440, 1000], [375, 812]]) {
      const scale = phonePreviewScale(device, width, height);
      assert.ok(hardware.bodyWidth * scale <= width - 48 + .001);
      assert.ok(hardware.bodyHeight * scale <= height - 64 + .001);
      assert.ok(scale <= 1);
    }
  }
});

test('phone previews span mini, notch, island and Max screens without shrinking their logical viewport', () => {
  assert.equal(new Set(phoneDevices.map(d => d.id)).size, phoneDevices.length);
  assert.deepEqual([phoneDevice('iphone13mini').width, phoneDevice('iphone13mini').height], [375, 812]);
  assert.deepEqual([phoneDevice('iphone16promax').width, phoneDevice('iphone16promax').height], [440, 956]);
  assert.deepEqual([phoneDevice('iphone18pro').width, phoneDevice('iphone18pro').height], [402, 874]);
  assert.deepEqual([phoneDevice('iphone18promax').width, phoneDevice('iphone18promax').height], [440, 956]);
  assert.equal(phoneDevice('iphone16e').cutout, 'notch');
  assert.equal(phoneDevice('iphone15pro').cutout, 'island');
  assert.equal(phoneDevice('unknown').id, 'iphone16');
});
test('browser chrome and page zoom cannot be mistaken for the software keyboard', () => {
  assert.deepEqual(phoneViewport({layoutHeight:852,visualHeight:550,editing:false}), {keyboard:false,rise:0,height:852});
  assert.equal(phoneViewport({layoutHeight:852,visualHeight:600,scale:1.5,editing:true}).keyboard, false);
  assert.equal(phoneViewport({layoutHeight:852,visualHeight:780,editing:true}).keyboard, false);
});
test('a focused keyboard raises sheet actions above the visible viewport and releases on blur', () => {
  assert.deepEqual(phoneViewport({layoutHeight:852,visualHeight:500,offsetTop:20,editing:true}), {keyboard:true,rise:332,height:500});
  assert.deepEqual(phoneViewport({layoutHeight:667,visualHeight:360,editing:true}), {keyboard:true,rise:307,height:360});
  assert.equal(phoneViewport({layoutHeight:852,visualHeight:852,editing:true}).rise, 0);
});
test('dropdowns open above low fields and remain inside a keyboard-reduced or panned viewport', () => {
  const rect = {left:240,top:420,bottom:468,width:130};
  const bounds = dropdownBounds(rect,600,{width:375,height:500});
  assert.equal(bounds.upward,true); assert.ok(bounds.left + bounds.width <= 367);
  assert.ok(bounds.top >= 8 && bounds.top + bounds.height <= 492);
  const panned = dropdownBounds({left:0,top:110,bottom:158,width:300},160,{width:320,height:340,top:100,left:10});
  assert.equal(panned.upward,false); assert.ok(panned.top >= 108 && panned.top+panned.height <= 432);
});
