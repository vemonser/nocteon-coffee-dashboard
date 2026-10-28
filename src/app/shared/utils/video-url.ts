/**
 * Turn a YouTube/Vimeo link into the embed URL the sanitizer allows.
 *
 * <p>Only players on the allowlist survive FE-01, so a bare watch/share link is converted
 * here; anything else returns null and the editor refuses it instead of storing an iframe
 * that would be stripped on save.
 */
export function parseVideoUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  // `https://evil@www.youtube.com/...` passes a host check but is not the provider's link.
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const embed = (id: string): string =>
    /^[A-Za-z0-9_-]{6,}$/.test(id) ? `https://www.youtube.com/embed/${id}` : '';

  if (host === 'youtu.be') return embed(url.pathname.slice(1).split('/')[0]) || null;

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname.startsWith('/embed/')) {
      return embed(url.pathname.replace('/embed/', '').split('/')[0]) || null;
    }
    const id = url.searchParams.get('v');
    return id ? embed(id) || null : null;
  }

  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }

  if (host === 'player.vimeo.com') {
    const match = url.pathname.match(/^\/video\/(\d+)\/?$/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  }

  return null;
}
