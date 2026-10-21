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

// Emit the first streak event immediately, then update one print as its count grows.
export function createGiftTracker() {
  const active = new Map();
  const grouped = new Map();
  const seen = new Map();
  let sequence = 0;
  return (evt, now = Date.now()) => {
    for (const map of [active, grouped, seen]) for (const [key, item] of map) if (now - item.time > 120000) map.delete(key);
    const gift = normalizeGift(evt, now);
    const msgId = evt.event?.msgId || evt.msgId;
    const pending = isPendingStreak(evt);
    const type = Number(evt.giftDetails?.giftType ?? evt.giftType ?? evt.gift?.gift_type);
    const messageKey = msgId ? `${msgId}:${gift.repeatCount}:${pending}` : null;
    if (messageKey && seen.has(messageKey)) return null;
    if (messageKey) seen.set(messageKey, { time: now });
    if (type !== 1) return { ...gift, printId: `print-${now}-${++sequence}`, final: true };
    const base = `${gift.id}:${evt.giftId || gift.giftName}`;
    const group = evt.groupId && String(evt.groupId) !== '0' ? `${base}:${evt.groupId}` : null;
    let entry = group ? grouped.get(group) : active.get(base);
    if (!entry) {
      entry = { printId: `print-${now}-${++sequence}`, count: 0, time: now, ended: false };
      if (group) grouped.set(group, entry);
      active.set(base, entry);
    }
    if (gift.repeatCount < entry.count || (entry.ended && gift.repeatCount === entry.count)) return null;
    const first = entry.count === 0;
    const changed = gift.repeatCount !== entry.count;
    entry.count = gift.repeatCount; entry.time = now; entry.ended = !pending;
    if (!pending && active.get(base) === entry) active.delete(base);
    if (!first && !changed) return null;
    return { ...gift, type: first ? 'gift' : 'gift-update', printId: entry.printId, final: !pending };
  };
}
