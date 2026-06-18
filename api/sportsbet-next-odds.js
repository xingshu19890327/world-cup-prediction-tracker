const send = (res, status, body) => res.status(status).setHeader('content-type', 'application/json; charset=utf-8').end(JSON.stringify(body));
const number = (value) => {
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 1 ? n : null;
};
const strip = (s) => String(s || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sportsbetUrl = (url) => /^https?:\/\/([^/]+\.)?sportsbet\.com\.au\//i.test(url || '');

const extractWdl = (text, homeTeam, awayTeam) => {
  const candidates = [];
  const labels = [
    ['主胜', homeTeam], ['平局', 'Draw'], ['平局', 'Tie'], ['客胜', awayTeam],
  ];
  for (const [result, label] of labels) {
    const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`${escaped}.{0,120}?([1-9]\\d?(?:\\.\\d{1,2})?)`, 'i'));
    const odds = number(match?.[1]);
    if (odds) candidates.push({ result, odds });
  }
  const unique = ['主胜', '平局', '客胜'].map((result) => candidates.find((c) => c.result === result)).filter(Boolean);
  if (unique.length < 3) return null;
  return Object.fromEntries(unique.map((c) => [c.result, c.odds]));
};

const extractScores = (text) => {
  const seen = new Set();
  const scores = [];
  const re = /\b([0-9])\s*[-–:]\s*([0-9])\b.{0,80}?\b([1-9]\d?(?:\.\d{1,2})?)\b/g;
  let match;
  while ((match = re.exec(text))) {
    const score = `${match[1]}-${match[2]}`;
    const odds = number(match[3]);
    if (!odds || seen.has(score)) continue;
    seen.add(score);
    scores.push({ score, odds });
  }
  return scores.sort((a, b) => a.odds - b.odds).slice(0, 20);
};

const searchSportsbet = async ({ homeTeam, awayTeam }) => {
  const query = encodeURIComponent(`site:sportsbet.com.au ${homeTeam} ${awayTeam} World Cup Sportsbet`);
  const response = await fetch(`https://duckduckgo.com/html/?q=${query}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await response.text();
  const hrefs = [...html.matchAll(/href="([^"]*sportsbet\.com\.au[^"]*)"/gi)].map((m) => m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '')).map(decodeURIComponent);
  return hrefs.find((url) => sportsbetUrl(url) && norm(url).includes(norm(homeTeam).split(' ')[0]) && norm(url).includes(norm(awayTeam).split(' ')[0]));
};

module.exports = async (req, res) => {
  try {
    const { homeTeam, awayTeam, matchNo, oddsSource, sportsbetUrl: suppliedUrl } = req.query;
    if (!homeTeam || !awayTeam) return send(res, 400, { error: 'missing_params', message: '缺少 homeTeam / awayTeam。' });
    let url = sportsbetUrl(suppliedUrl) ? suppliedUrl : sportsbetUrl(oddsSource) ? oddsSource : '';
    if (!url) url = await searchSportsbet({ homeTeam, awayTeam });
    if (!url) return send(res, 404, { error: 'no_high_confidence_match', message: '无法从 Sportsbet 高置信匹配该场比赛，请手动填写或导入赔率。' });
    const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html,application/xhtml+xml' } });
    if (!response.ok) return send(res, 502, { error: 'fetch_failed', message: 'Sportsbet 赔率抓取失败，未修改任何预测。请手动填写或导入赔率。' });
    const text = strip(await response.text());
    if (!norm(text).includes(norm(homeTeam).split(' ')[0]) || !norm(text).includes(norm(awayTeam).split(' ')[0])) return send(res, 404, { error: 'no_high_confidence_match', message: '无法从 Sportsbet 高置信匹配该场比赛，请手动填写或导入赔率。' });
    const wdlOdds = extractWdl(text, homeTeam, awayTeam);
    if (!wdlOdds) return send(res, 422, { error: 'wdl_missing', message: 'Sportsbet 赔率抓取失败，未修改任何预测。请手动填写或导入赔率。' });
    const correctScores = extractScores(text);
    const wdlPrediction = Object.entries(wdlOdds).sort((a, b) => a[1] - b[1])[0][0];
    return send(res, 200, { matchNo, url, wdlOdds, wdlPrediction, correctScores, topScores: correctScores.slice(0, 3) });
  } catch (error) {
    return send(res, 500, { error: 'sportsbet_failed', message: 'Sportsbet 赔率抓取失败，未修改任何预测。请手动填写或导入赔率。', detail: error instanceof Error ? error.message : String(error) });
  }
};
