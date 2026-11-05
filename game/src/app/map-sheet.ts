export async function loadMapSheet(signal: AbortSignal): Promise<string> {
  const res = await fetch(new URL('../../public/map-overlay.svg', import.meta.url).toString(), { signal, cache: 'default' });
  if (!res.ok) throw new Error(`map fetch failed: ${res.status}`);
  let text = await res.text();
  text = text.replace(/^\s*<\?xml[^>]*\?>\s*/, '');
  if (!text.includes('<svg')) throw new Error('map response is not SVG');
  return text;
}
