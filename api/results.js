const endpoint = 'https://api.football-data.org/v4/competitions/WC/matches?season=2026';

const send = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

module.exports = async function handler(req, res) {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return send(res, 500, { error: 'missing_token', message: '缺少 FOOTBALL_DATA_TOKEN，无法从 football-data.org 更新实际赛果。' });

  try {
    const response = await fetch(endpoint, {
      headers: {
        'X-Auth-Token': token,
        Accept: 'application/json',
      },
    });

    if (response.status === 403) return send(res, 403, { error: 'forbidden', message: 'football-data.org 拒绝访问，请检查 FOOTBALL_DATA_TOKEN 权限。' });
    if (!response.ok) return send(res, response.status, { error: 'source_unavailable', message: 'football-data.org 数据源暂时不可用，请稍后重试或手动填写。' });

    const data = await response.json();
    const sourceMatches = Array.isArray(data?.matches) ? data.matches : [];
    const matches = sourceMatches
      .filter((match) => match?.status === 'FINISHED' && Number.isFinite(match?.score?.fullTime?.home) && Number.isFinite(match?.score?.fullTime?.away))
      .map((match) => ({
        id: match.id,
        matchNo: match.matchNo,
        utcDate: match.utcDate,
        homeTeam: match.homeTeam?.name ?? '',
        awayTeam: match.awayTeam?.name ?? '',
        score: {
          home: match.score.fullTime.home,
          away: match.score.fullTime.away,
        },
      }));

    if (matches.length === 0) return send(res, 503, { error: 'source_unavailable', message: 'football-data.org 暂无可用的 2026 世界杯已完赛比分数据。' });
    return send(res, 200, { matches });
  } catch (error) {
    return send(res, 503, { error: 'source_unavailable', message: `football-data.org 数据源暂时不可用：${error instanceof Error ? error.message : '未知错误'}` });
  }
};
