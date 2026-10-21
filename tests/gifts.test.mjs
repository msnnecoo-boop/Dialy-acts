import { test } from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGift,isPendingStreak} from '../gifts.js';
test('upstream nested gift events retain sender photo and gift details',()=>{
 const event={user:{uniqueId:'viewer',nickname:'بیننده',profilePicture:{urls:['https://example.com/avatar.jpg']}},giftDetails:{giftName:'Rose',giftType:1},repeatCount:3,repeatEnd:0};
 assert.equal(isPendingStreak(event),true);
 assert.equal(isPendingStreak({...event,repeatEnd:1}),false);
 assert.deepEqual(normalizeGift(event,123),{type:'gift',id:'viewer',nickname:'بیننده',giftName:'Rose',avatar:'https://example.com/avatar.jpg',repeatCount:3,timestamp:123});
});
test('legacy events and unsafe photo URLs',()=>{
 assert.equal(isPendingStreak({giftType:1,repeatEnd:false}),true);
 assert.equal(isPendingStreak({giftType:0,repeatEnd:false}),false);
 const gift=normalizeGift({uniqueId:'old',giftName:'Heart',profilePictureUrl:'javascript:alert(1)',repeatCount:Infinity});
 assert.equal(gift.giftName,'Heart');assert.equal(gift.avatar,'');assert.equal(gift.repeatCount,1);
});
