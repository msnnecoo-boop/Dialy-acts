import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {extractTunnelUrl,verifyDownload} from '../direct-link.js';
test('extract temporary HTTPS overlay host from tunnel output',()=>{
 assert.equal(extractTunnelUrl('INF | https://paper-live-printer-test.trycloudflare.com |'),'https://paper-live-printer-test.trycloudflare.com');
 assert.equal(extractTunnelUrl('https://example.com'),null);
});
test('verify official binary digest before installing executable',()=>{
 const bytes=Buffer.from('fixture');const digest='sha256:'+createHash('sha256').update(bytes).digest('hex');
 assert.doesNotThrow(()=>verifyDownload(bytes,digest));
 assert.throws(()=>verifyDownload(Buffer.from('different'),digest),/mismatch/);
 assert.throws(()=>verifyDownload(bytes,''),/no SHA-256/);
});
