const strip = (value = '') => String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
const hasTeam = (haystack, team) => team && strip(haystack).includes(strip(team));
const scoreFromText = (text, home, away) => {
  const clean = String(text || '').replace(/\s+/g, ' ');
  const namesPresent = !home || !away || (hasTeam(clean, home) && hasTeam(clean, away));
  if (!namesPresent) return null;
  const patterns = [
    new RegExp(`${home || '[^\\d]{2,40}'}[^\\d]{0,80}(\\d{1,2})\\s*[-–—:]\\s*(\\d{1,2})[^\\d]{0,80}${away || '[^\\d]{2,40}'}`, 'i'),
    new RegExp(`${away || '[^\\d]{2,40}'}[^\\d]{0,80}(\\d{1,2})\\s*[-–—:]\\s*(\\d{1,2})[^\\d]{0,80}${home || '[^\\d]{2,40}'}`, 'i'),
    /(\d{1,2})\s*[-–—:]\s*(\d{1,2})\s*(?:FT|Full Time|Final|已完赛|完场)/i
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match) return `${Number(match[1])}-${Number(match[2])}`;
  }
  return null;
};
const extractJsonLd = (html) => [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => {
  try { const parsed = JSON.parse(m[1].trim()); return Array.isArray(parsed) ? parsed : [parsed]; } catch { return []; }
});
const parseJsonLd = (nodes, home, away) => {
  const stack = [...nodes];
  while (stack.length) {
    const node = stack.shift();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) { stack.push(...node); continue; }
    if (node['@graph']) stack.push(node['@graph']);
    const text = JSON.stringify(node);
    if (!hasTeam(text, home) || !hasTeam(text, away)) continue;
    const score = scoreFromText(text, home, away);
    if (score) return score;
  }
  return null;
};

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') return res.status(405).json({ ok: false, error: '仅支持 GET 请求' });
  const url = req.query?.url;
  const homeTeam = req.query?.homeTeam || '';
  const awayTeam = req.query?.awayTeam || '';
  if (!url) return res.status(400).json({ ok: false, error: '缺少赛果来源 URL。请先为比赛填写 resultSource，或通过 JSON/CSV 导入实际比分。' });
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ ok: false, error: '赛果来源 URL 格式不正确。' }); }
  if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).json({ ok: false, error: '赛果来源 URL 必须是 http 或 https。' });
  try {
    const response = await fetch(parsed.toString(), { headers: { 'user-agent': 'Mozilla/5.0 world-cup-prediction-tracker result fetcher', accept: 'text/html,application/xhtml+xml,application/json' } });
    if (!response.ok) return res.status(502).json({ ok: false, error: `赛果来源请求失败：HTTP ${response.status}` });
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    let actualScore = null;
    if (contentType.includes('application/json')) {
      actualScore = scoreFromText(body, homeTeam, awayTeam);
    } else {
      actualScore = parseJsonLd(extractJsonLd(body), homeTeam, awayTeam) || scoreFromText(body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '), homeTeam, awayTeam);
    }
    if (!actualScore) return res.status(200).json({ ok: true, completed: false, status: '未完赛', error: '未在赛果来源页面中找到可高置信匹配的完场比分。' });
    return res.status(200).json({ ok: true, completed: true, actualScore, source: parsed.toString(), fetchedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(502).json({ ok: false, error: `实际赛果抓取失败：${error instanceof Error ? error.message : '未知错误'}` });
  }
}
