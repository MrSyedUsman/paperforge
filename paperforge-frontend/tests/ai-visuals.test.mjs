import test from 'node:test';
import assert from 'node:assert/strict';
import { progressWidth, signedWidth, feeWidth } from '../src/components/ai-visual-geometry.ts';
test('participation graphics cap the fill without changing the recorded requirement', () => {
 assert.equal(progressWidth(250,500),50); assert.equal(progressWidth(750,500),100);
 assert.equal(progressWidth(0,500),0); assert.equal(progressWidth(100,0),null);
 assert.equal(progressWidth(-1,500),null); assert.equal(progressWidth(NaN,500),null);
});
test('signed comparison geometry shares a zero baseline and handles missing and zero results', () => {
 assert.equal(signedWidth(100,200),25); assert.equal(signedWidth(-100,200),25);
 assert.equal(signedWidth(0,0),0); assert.equal(signedWidth(null,100),0);
 assert.equal(signedWidth(Infinity,100),0); assert.equal(signedWidth(300,200),50);
});
test('fee proportions are available only against a positive known gross profit', () => {
 assert.equal(feeWidth(10,2),20); assert.equal(feeWidth(10,10),100); assert.equal(feeWidth(10,12),100);
 assert.equal(feeWidth(10,0),0);
 for(const [gross,fees] of [[0,1],[-5,1],[null,1],[1,null],[1,-1],[Infinity,1]]) assert.equal(feeWidth(gross,fees),null);
});
