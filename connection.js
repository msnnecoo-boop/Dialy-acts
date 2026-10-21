// The optional gift-catalog request requires a separately signed HTTP route.
// Normal gift messages already carry giftDetails (including diamondCount).
export function liveOptions(env = process.env) {
  return {
    enableExtendedGiftInfo: env.EXTENDED_GIFT_INFO === 'true',
    processInitialData: false,
    ...(env.SIGN_API_KEY ? { signApiKey: env.SIGN_API_KEY } : {})
  };
}
export function requiresProviderAccess(err) {
  const message = `${err?.name || ''} ${err?.constructor?.name || ''} ${err?.message || err || ''}`;
  return /PremiumFeatureError|Business plan|requires? (?:a |an )?(?:paid|premium)|do not have permission|invalid api key|unauthorized/i.test(message);
}
