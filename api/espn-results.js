const baseEndpoint = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const summaryEndpoint = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';

const send = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const isCornerStat = (stat) => {
  const name = String(stat?.name ?? '').toLowerCase();
  const abbr = String(stat?.abbreviation ?? '').toLowerCase();
  const label = String(stat?.label ?? '').toLowerCase();
  const display = String(stat?.displayName ?? '').toLowerCase();
  return name.includes('corner') || label.includes('corner') || display.includes('corner') || abbr === 'ck' || abbr === 'cor';
};

// 从 scoreboard 的 competitor.statistics 里直接找角球（通常为空，作兜底）
const cornersFor = (competitor) => {
  const stats = Array.isArray(competitor?.statistics) ? competitor.statistics : [];
  const found = stats.find(isCornerStat);
  return found ? toNumber(found.displayValue ?? found.value) : null;
};

// 比赛详情接口（summary）里的 boxscore.teams[].statistics 才有角球
const fetchCornersFromSummary = async (eventId) => {
  if (!eventId) return { home: null, away: null };
  try {
    const response = await fetch(`${summaryEndpoint}?event=${encodeURIComponent(eventId)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return { home: null, away: null };
    const data = await response.json();
    const teams = Array.isArray(data?.boxscore?.teams) ? data.boxscore.teams : [];
    const cornersOf = (homeAway) => {
      const team = teams.find((t) => String(t?.homeAway ?? '').toLowerCase() === homeAway);
      const stats = Array.isArray(team?.statistics) ? team.statistics : [];
      const found = stats.find(isCornerStat);
      return found ? toNumber(found.displayValue ?? found.value) : null;
    };
    let home = cornersOf('home');
    let away = cornersOf('away');
    // 兜底：boxscore 没标 homeAway 时按数组顺序取
    if (home === null && away === null && teams.length >= 2) {
      const cornersAt = (idx) => {
        const stats = Array.isArray(teams[idx]?.statistics) ? teams[idx].statistics : [];
        const found = stats.find(isCornerStat);
        return found ? toNumber(found.displayValue ?? found.value) : null;
      };
      home = cornersAt(0);
      away = cornersAt(1);
    }
    return { home, away };
  } catch {
    return { home: null, away: null };
  }
};

const parseEvent = (event) => {
  const competition = Array.isArray(event?.competitions) ? event.competitions[0] : null;
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
  const home = competitors.find((competitor) => competitor?.homeAway === 'home') ?? competitors[0];
  const away = competitors.find((competitor) => competitor?.homeAway === 'away') ?? competitors[1];
  const homeScore = toNumber(home?.score);
  const awayScore = toNumber(away?.score);

  return {
    id: event?.id,
    utcDate: event?.date ?? competition?.date ?? '',
    completed: Boolean(event?.status?.type?.completed ?? competition?.status?.type?.completed),
    status: event?.status?.type?.description ?? event?.status?.type?.name ?? '',
    homeTeam: home?.team?.displayName ?? home?.team?.name ?? home?.team?.shortDisplayName ?? '',
    awayTeam: away?.team?.displayName ?? away?.team?.name ?? away?.team?.shortDisplayName ?? '',
    homeAbbreviation: home?.team?.abbreviation ?? '',
    awayAbbreviation: away?.team?.abbreviation ?? '',
    score: homeScore === null || awayScore === null ? null : { home: homeScore, away: awayScore },
    homeCorners: cornersFor(home),
    awayCorners: cornersFor(away),
  };
};

module.exports = async function handler(req, res) {
  const dates = typeof req.query?.dates === 'string' ? req.query.dates.trim() : '';
  const endpoint = dates ? `${baseEndpoint}?dates=${encodeURIComponent(dates)}` : baseEndpoint;

  try {
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!response.ok) return send(res, response.status, { error: 'source_unavailable', message: 'ESPN 数据源暂时不可用，请稍后重试或手动填写。' });

    const data = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    const matches = events.map(parseEvent).filter((match) => match.homeTeam && match.awayTeam);

    // 对已完赛但 scoreboard 没带角球的比赛，逐场拉详情接口补角球
    await Promise.all(matches.map(async (match) => {
      if (match.completed && match.homeCorners === null && match.awayCorners === null) {
        const corners = await fetchCornersFromSummary(match.id);
        match.homeCorners = corners.home;
        match.awayCorners = corners.away;
      }
    }));

    const completedCount = matches.filter((match) => match.completed).length;
    const unfinishedCount = matches.length - completedCount;

    return send(res, 200, { matches, stats: { completedCount, unfinishedCount, sourceCount: matches.length, dates: dates || null } });
  } catch (error) {
    return send(res, 503, { error: 'source_unavailable', message: `ESPN 数据源暂时不可用：${error instanceof Error ? error.message : '未知错误'}` });
  }
};
