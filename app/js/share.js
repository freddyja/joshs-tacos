// Share: Web Share API -> clipboard copy -> manual (caller shows the URL to select).
export async function shareApp({ nav, url, title, text }) {
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // otherwise fall through to copy
    }
  }
  if (await copyText(nav, url)) return 'copied';
  return 'manual';
}

export async function copyText(nav, text) {
  try {
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  return legacyCopy(text);
}

function legacyCopy(text) {
  try {
    if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
