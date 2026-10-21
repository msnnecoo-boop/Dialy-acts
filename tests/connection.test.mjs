import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TikTokLiveConnection, RouteConfig, ControlEvent} from 'tiktok-live-connector';
import {liveOptions,requiresProviderAccess} from '../connection.js';
test('default connect skips signed gift catalog and reaches WebSocket provider',async()=>{
 const original=RouteConfig.fetchSignedWebSocketFromProvider;
 const sentinel=new Error('test reached WebSocket provider');
 const connection=new TikTokLiveConnection('test_creator',liveOptions({}));
 let catalogCalls=0, socketCalls=0;
 connection.on(ControlEvent.ERROR,()=>{});
 connection.fetchRoomId=async()=>'123';
 connection.fetchRoomInfo=async()=>({data:{status:2}});
 connection.fetchAvailableGifts=async()=>{catalogCalls++;throw new Error('Business plan required');};
 RouteConfig.fetchSignedWebSocketFromProvider=async()=>{socketCalls++;throw sentinel;};
 try{await assert.rejects(connection.connect(),e=>e===sentinel);assert.equal(catalogCalls,0);assert.equal(socketCalls,1);}
 finally{RouteConfig.fetchSignedWebSocketFromProvider=original;await connection.disconnect();}
});
test('optional provider configuration and permission errors',()=>{
 assert.equal(liveOptions({}).enableExtendedGiftInfo,false);
 assert.deepEqual(liveOptions({SIGN_API_KEY:'test-key'}),{enableExtendedGiftInfo:false,processInitialData:false,signApiKey:'test-key'});
 assert.equal(liveOptions({EXTENDED_GIFT_INFO:'true'}).enableExtendedGiftInfo,true);
 assert.equal(requiresProviderAccess(new Error('This endpoint requires a Business plan.')),true);
 assert.equal(requiresProviderAccess({name:'PremiumFeatureError',message:'Forbidden'}),true);
 assert.equal(requiresProviderAccess(new Error('Network timeout')),false);
});
