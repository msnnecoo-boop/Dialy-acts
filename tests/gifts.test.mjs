import { test } from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGift,isPendingStreak} from '../gifts.js';
test('upstream nested gift events retain sender photo and gift details',()=>{
 const event={user:{uniqueId:'viewer',nickname:'بیننده',profilePicture:{urls:['https://example.com/avatar.jpg']}},giftDetails:{giftName:'Rose',giftType:1},repeatCount:3,repeatEnd:0};
 assert.equal(isPendingStreak(event),true);
 assert.equal(isPendingStreak({...event,repeatEnd:1}),false);
 assert.deepEqual(normalizeGift(event,123),{unitCoins:null,totalCoins:null,tier:'small',type:'gift',id:'viewer',nickname:'بیننده',giftName:'Rose',avatar:'https://example.com/avatar.jpg',repeatCount:3,timestamp:123});
});
test('legacy events and unsafe photo URLs',()=>{
 assert.equal(isPendingStreak({giftType:1,repeatEnd:false}),true);
 assert.equal(isPendingStreak({giftType:0,repeatEnd:false}),false);
 const gift=normalizeGift({uniqueId:'old',giftName:'Heart',profilePictureUrl:'javascript:alert(1)',repeatCount:Infinity});
 assert.equal(gift.giftName,'Heart');assert.equal(gift.avatar,'');assert.equal(gift.repeatCount,1);
});

test('coin thresholds and repeated gift totals determine print size',()=>{
 for(const [coins,tier] of [[1,'small'],[9,'small'],[10,'pair'],[99,'pair'],[100,'half'],[499,'half'],[500,'full'],[1000,'full']]){
  assert.equal(normalizeGift({giftDetails:{diamondCount:coins}}).tier,tier);
 }
 assert.equal(normalizeGift({diamondCount:1,repeatCount:100}).tier,'half');
 assert.equal(normalizeGift({extendedGiftInfo:{diamond_count:250},repeatCount:2}).tier,'full');
 assert.equal(normalizeGift({giftDetails:{diamondCount:10},repeatCount:2}).totalCoins,20);
 assert.equal(normalizeGift({giftName:'Unknown'}).totalCoins,null);
});
