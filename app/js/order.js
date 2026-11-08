// Builds the order text and the SMS / call links. The app only sets link hrefs;
// the customer reviews the message in their own SMS app and presses Send.
import { formatCents, lineTotalCents, subtotalCents } from './cart.js';

export const SELLER_PHONE = '+13526068731';
export const SELLER_PHONE_DISPLAY = '(352) 606-8731';

export function buildOrderText(cart, index, t, { name = '' } = {}) {
  const parts = [t('order.greeting')];
  if (cart.lines.length) {
    const lines = cart.lines.map((l) =>
      t('order.line', {
        qty: l.qty,
        name: t(`sku.${l.sku}`),
        price: formatCents(lineTotalCents(l, index)),
      })
    );
    parts.push(`${t('order.intro')} ${lines.join('; ')}.`);
    parts.push(t('order.subtotal', { amount: formatCents(subtotalCents(cart, index)) }));
  }
  if (cart.askMaria) parts.push(t('order.maria'));
  const cleanName = String(name).replace(/\s+/g, ' ').trim().slice(0, 60);
  parts.push(t('order.name', { name: cleanName || '___' }));
  parts.push(t('order.confirm'));
  return parts.join(' ');
}

/** iPadOS 13+ reports itself as a Mac, so also check touch points. */
export function isIOS(ua = '', platform = '', maxTouchPoints = 0) {
  return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

/** iOS uses "&body=", Android and others use "?body=". */
export function smsHref(body, { ios = false } = {}) {
  const sep = ios ? '&' : '?';
  return `sms:${SELLER_PHONE}${sep}body=${encodeURIComponent(body)}`;
}

export function telHref() {
  return `tel:${SELLER_PHONE}`;
}
