export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ ok: false, error: '仅支持 GET 请求' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: false,
    source: 'manual-fallback',
    fetchedAt: new Date().toISOString(),
    matches: [],
    error: '当前没有配置可高置信匹配的实际赛果数据源。实际赛果抓取失败，可能是数据源限制、页面结构变化或比赛尚未完赛。已保留现有比分，可手动填写或导入 JSON。'
  });
}
