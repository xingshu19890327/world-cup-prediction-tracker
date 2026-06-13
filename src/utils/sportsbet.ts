export type SportsbetOdds = {
  sbHomeOdds?: number | '';
  sbDrawOdds?: number | '';
  sbAwayOdds?: number | '';
  predictedScore1Odds?: number | '';
  predictedScore2Odds?: number | '';
  predictedScore3Odds?: number | '';
};

const toNumber = (value: unknown): number | '' => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : '';
  }
  return '';
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const uniqueNumbers = (values: unknown[]) => [...new Set(values.map(toNumber).filter((v): v is number => typeof v === 'number'))];

function collectMarketOdds(node: unknown, marketTerms: string[], selectionTerms: string[] = []): number[] {
  const hits: unknown[] = [];
  const visit = (value: unknown, context = '') => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    const text = Object.values(record).filter(v => typeof v === 'string').join(' ');
    const nextContext = `${context} ${text}`;
    const normalizedContext = normalize(nextContext);
    const inMarket = marketTerms.some(term => normalizedContext.includes(normalize(term)));
    const inSelection = selectionTerms.length === 0 || selectionTerms.some(term => normalizedContext.includes(normalize(term)));
    if (inMarket && inSelection) {
      for (const key of ['price', 'odds', 'returnWin', 'displayPrice', 'decimalOdds']) {
        if (key in record) hits.push(record[key]);
      }
    }
    Object.values(record).forEach(child => visit(child, nextContext));
  };
  visit(node);
  return uniqueNumbers(hits);
}

function extractJsonBlobs(html: string): unknown[] {
  const blobs: unknown[] = [];
  for (const match of html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { blobs.push(JSON.parse(match[1])); } catch { /* ignore malformed script blobs */ }
  }
  for (const match of html.matchAll(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { blobs.push(JSON.parse(match[1])); } catch { /* ignore malformed next data */ }
  }
  return blobs;
}

async function fetchViaProxy(url: string) {
  let response: Response;
  try {
    response = await fetch(url, { credentials: 'omit' });
  } catch {
    response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  }
  if (!response.ok) throw new Error(`Sportsbet 返回 ${response.status}`);
  return response.text();
}

export async function fetchSportsbetOdds(url: string, homeTeam: string, awayTeam: string, scores: string[]): Promise<SportsbetOdds> {
  if (!url || !url.includes('sportsbet.com.au')) throw new Error('请先填写 Sportsbet 比赛链接。');
  const html = await fetchViaProxy(url);
  const sources = extractJsonBlobs(html);
  if (sources.length === 0) sources.push(html);
  const odds: SportsbetOdds = {};
  for (const source of sources) {
    odds.sbHomeOdds ||= collectMarketOdds(source, ['match result', 'head to head', '1x2'], [homeTeam, 'home'])[0] ?? '';
    odds.sbDrawOdds ||= collectMarketOdds(source, ['match result', 'head to head', '1x2'], ['draw'])[0] ?? '';
    odds.sbAwayOdds ||= collectMarketOdds(source, ['match result', 'head to head', '1x2'], [awayTeam, 'away'])[0] ?? '';
    scores.forEach((score, index) => {
      const key = `predictedScore${index + 1}Odds` as keyof SportsbetOdds;
      if (!odds[key] && score) odds[key] = collectMarketOdds(source, ['correct score'], [score])[0] ?? '';
    });
  }
  return odds;
}
