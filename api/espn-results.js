const endpoint = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

const send = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const toNumber = (value) => {
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
};

const pickTeamName = (competitor) => ({
  displayName: competitor?.team?.displayName ?? '',
  shortDisplayName: competitor?.team?.shortDisplayName ?? '',
  abbreviation: competitor?.team?.abbreviation ?? '',
});

module.exports = async function handler(req, res) {
  try {
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return send(res, response.status, { error: 'source_unavailable', message: '无法从 ESPN 更新实际赛果，请稍后重试。已有比分不会被清空。' });
    }

    const data = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    const matches = events.flatMap((event) => {
      const competition = Array.isArray(event?.competitions) ? event.competitions[0] : undefined;
      const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
      const home = competitors.find((competitor) => competitor?.homeAway === 'home');
      const away = competitors.find((competitor) => competitor?.homeAway === 'away');
      const homeScore = toNumber(home?.score);
      const awayScore = toNumber(away?.score);
      const completed = event?.status?.type?.completed === true;

      if (!completed || !home || !away || homeScore === null || awayScore === null) return [];

      return [{
        id: event?.id ?? competition?.id,
        date: event?.date ?? competition?.date ?? '',
        utcDate: event?.date ?? competition?.date ?? '',
        status: {
          completed,
          description: event?.status?.type?.description ?? '',
          detail: event?.status?.type?.detail ?? '',
        },
        homeTeam: pickTeamName(home),
        awayTeam: pickTeamName(away),
        score: { home: homeScore, away: awayScore },
      }];
    });

    return send(res, 200, { matches, sourceCompleted: matches.length });
  } catch (error) {
    return send(res, 503, { error: 'source_unavailable', message: '无法从 ESPN 更新实际赛果，请稍后重试。已有比分不会被清空。' });
  }
};
