// Accept the upstream v2 event shape and older flattened events.
export function isPendingStreak(event) {
  const type = event.giftDetails?.giftType ?? event.giftType ?? event.gift?.gift_type;
  return Number(type) === 1 && !Number(event.repeatEnd ?? event.gift?.repeat_end ?? 0);
}
export function normalizeGift(evt, timestamp = Date.now()) {
  const id = String(evt.uniqueId || evt.user?.uniqueId || 'viewer').slice(0, 80);
  const nickname = String(evt.nickname || evt.user?.nickname || id).slice(0, 100);
  const giftName = String(evt.giftDetails?.giftName || evt.giftName || evt.extendedGiftInfo?.name || evt.gift?.name || 'Gift').slice(0, 100);
  const avatar = evt.profilePictureUrl || evt.user?.profilePictureUrl || evt.user?.profilePicture?.urls?.[0] || evt.user?.avatarThumb?.urlList?.[0] || '';
  const count = Number(evt.repeatCount);
  const repeatCount = Number.isFinite(count) ? Math.max(1, Math.min(9999, Math.floor(count))) : 1;
  return { type: 'gift', id, nickname, giftName, avatar: typeof avatar === 'string' && /^https:\/\//i.test(avatar) ? avatar : '', repeatCount, timestamp };
}
