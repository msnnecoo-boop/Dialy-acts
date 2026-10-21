import { test } from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGift,isPendingStreak,createGiftTracker} from '../gifts.js';
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

test('prefer available high resolution avatar and skip unsafe candidates',()=>{
 assert.equal(normalizeGift({profilePictureUrl:'https://example.com/small.jpg',user:{avatarLarge:{urlList:['https://example.com/large.jpg']}}}).avatar,'https://example.com/large.jpg');
 assert.equal(normalizeGift({user:{avatarLarge:{urlList:['javascript:bad']},avatarMedium:{url:['https://example.com/medium.jpg']}}}).avatar,'https://example.com/medium.jpg');
});

test('first streak gift prints immediately, updates retain identity and final does not duplicate',()=>{
 const track=createGiftTracker();
 const base={uniqueId:'viewer',giftId:5655,groupId:'one',giftType:1,diamondCount:1};
 const first=track({...base,repeatCount:1,repeatEnd:0,msgId:'a'},1000);
 assert.equal(first.type,'gift');assert.equal(first.final,false);assert.equal(first.repeatCount,1);
 const next=track({...base,repeatCount:100,repeatEnd:0,msgId:'b'},1100);
 assert.equal(next.type,'gift-update');assert.equal(next.printId,first.printId);assert.equal(next.tier,'half');
 const vip=track({...base,repeatCount:500,repeatEnd:0,msgId:'c'},1200);
 assert.equal(vip.printId,first.printId);assert.equal(vip.tier,'full');
 assert.equal(track({...base,repeatCount:500,repeatEnd:1,msgId:'d'},1300),null);
 assert.equal(track({...base,repeatCount:500,repeatEnd:1,msgId:'e'},1400),null);
 const second=track({...base,groupId:'two',repeatCount:1,repeatEnd:0,msgId:'f'},1500);
 assert.notEqual(second.printId,first.printId);assert.equal(second.type,'gift');
});
test('streaks without group IDs and two viewers remain independent',()=>{
 const track=createGiftTracker();
 const a=track({uniqueId:'a',giftType:1,giftId:1,repeatCount:1,repeatEnd:0},1000);
 const b=track({uniqueId:'b',giftType:1,giftId:1,repeatCount:1,repeatEnd:0},1100);
 assert.notEqual(a.printId,b.printId);
 const updated=track({uniqueId:'a',giftType:1,giftId:1,repeatCount:2,repeatEnd:1},1200);
 assert.equal(updated.printId,a.printId);assert.equal(updated.type,'gift-update');
 const fresh=track({uniqueId:'a',giftType:1,giftId:1,repeatCount:1,repeatEnd:0},1300);
 assert.notEqual(fresh.printId,a.printId);
});
