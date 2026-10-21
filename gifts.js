// Accept the upstream v2 event shape and older flattened events.
export function isPendingStreak(event) {
  const type = event.giftDetails?.giftType ?? event.giftType ?? event.gift?.gift_type;
  return Number(type) === 1 && !Number(event.repeatEnd ?? event.gift?.repeat_end ?? 0);
}
export function normalizeGift(evt, timestamp = Date.now()) {
  const id = String(evt.uniqueId || evt.user?.uniqueId || 'viewer').slice(0, 80);
  const nickname = String(evt.nickname || evt.user?.nickname || id).slice(0, 100);
  const giftName = String(evt.giftDetails?.giftName || evt.giftName || evt.extendedGiftInfo?.name || evt.gift?.name || 'Gift').slice(0, 100);
  const imageUrl = image => image?.urlList?.[0] || image?.url?.[0] || image?.urls?.[0];
  const candidates = [imageUrl(evt.user?.avatarLarge), imageUrl(evt.avatarLarge), imageUrl(evt.user?.avatarMedium), imageUrl(evt.avatarMedium), evt.profilePictureUrl, evt.user?.profilePictureUrl, imageUrl(evt.user?.profilePicture), imageUrl(evt.user?.avatarThumb)];
  const avatar = candidates.find(url => typeof url === 'string' && /^https:\/\//i.test(url)) || '';
  const count = Number(evt.repeatCount);
  const repeatCount = Number.isFinite(count) ? Math.max(1, Math.min(9999, Math.floor(count))) : 1;
  const rawCoins = Number(evt.giftDetails?.diamondCount ?? evt.diamondCount ?? evt.extendedGiftInfo?.diamond_count ?? evt.extendedGiftInfo?.diamondCount);
  const unitCoins = Number.isFinite(rawCoins) && rawCoins >= 0 ? Math.floor(rawCoins) : null;
  const totalCoins = unitCoins === null ? null : unitCoins * repeatCount;
  const tier = totalCoins >= 500 ? 'full' : totalCoins >= 100 ? 'half' : totalCoins >= 10 ? 'pair' : 'small';
  return { unitCoins, totalCoins, tier, type: 'gift', id, nickname, giftName, avatar: typeof avatar === 'string' && /^https:\/\//i.test(avatar) ? avatar : '', repeatCount, timestamp };
}
