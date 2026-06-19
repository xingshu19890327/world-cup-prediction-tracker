import { useMemo, useState } from 'react';
import type { MatchPrediction } from '../types';

const num = (v: unknown) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null;
};

const actualCornerWinner = (m: MatchPrediction): '主队多' | '客队多' | '相近' | null => {
  const h = num(m.homeCorners);
  const a = num(m.awayCorners);
  if (h === null || a === null) return null;
  if (h > a + 1) return '主队多';
  if (a > h + 1) return '客队多';
  return '相近';
};

const hitStatus = (prediction: string, actual: '主队多' | '客队多' | '相近' | null): '✓' | '×' | '待赛' | '' => {
  if (!prediction.trim()) return '';
  if (actual === null) return '待赛';
  return prediction.trim() === actual ? '✓' : '×';
};

const cornerWinnerOptions = ['主队多', '客队多', '相近'] as const;

export default function CornerPredictionTable({
  matches,
  onEdit,
  onSave,
}: {
  matches: MatchPrediction[];
  onEdit: (m: MatchPrediction) => void;
  onSave: (m: MatchPrediction) => void;
}) {
  const [filter, setFilter] = useState<'全部' | '已完赛' | '未赛'>('全部');

  const rows = useMemo(() => {
    return matches
      .filter((m) => {
        if (filter === '已完赛') return m.completionStatus === '已完赛';
        if (filter === '未赛') return m.completionStatus !== '已完赛';
        return true;
      })
      .map((m) => {
        const actual = actualCornerWinner(m);
        const claudeHit = m.claudeCornerHit || hitStatus(m.claudeCornerWinner ?? '', actual);
        const chatgptHit = m.chatgptCornerHit || hitStatus(m.chatgptCornerWinner ?? '', actual);
        const h = num(m.homeCorners);
        const a = num(m.awayCorners);
        const totalActual = h !== null && a !== null ? h + a : null;
        return { m, actual, claudeHit, chatgptHit, totalActual };
      });
  }, [matches, filter]);

  const stats = useMemo(() => {
    const completed = rows.filter((r) => r.m.completionStatus === '已完赛' && r.actual !== null);
    const claudeAttempted = completed.filter((r) => (r.m.claudeCornerWinner ?? '').trim());
    const chatgptAttempted = completed.filter((r) => (r.m.chatgptCornerWinner ?? '').trim());
    const claudeHits = claudeAttempted.filter((r) => r.claudeHit === '✓').length;
    const chatgptHits = chatgptAttempted.filter((r) => r.chatgptHit === '✓').length;
    return {
      claudeRate: claudeAttempted.length ? `${claudeHits}/${claudeAttempted.length} (${Math.round(claudeHits / claudeAttempted.length * 100)}%)` : '—',
      chatgptRate: chatgptAttempted.length ? `${chatgptHits}/${chatgptAttempted.length} (${Math.round(chatgptHits / chatgptAttempted.length * 100)}%)` : '—',
    };
  }, [rows]);

  return (
    <section className="panel cornerPredPanel">
      <div className="cornerPredHeader">
        <b>角球预测对决</b>
        <span className="cornerPredStats">
          <span className="cpStatClaude">Claude 角球方向命中率：{stats.claudeRate}</span>
          <span className="cpStatGpt">ChatGPT 角球方向命中率：{stats.chatgptRate}</span>
        </span>
        <span className="cornerPredFilters">
          {(['全部', '已完赛', '未赛'] as const).map((f) => (
            <button key={f} className={`qbtn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </span>
      </div>

      <div className="tableWrap">
        <table className="cornerPredTable">
          <thead>
            <tr>
              <th>#</th>
              <th>赛事</th>
              <th>时间</th>
              <th>实际角球</th>
              <th>角球归属</th>
              <th>Claude预测</th>
              <th>Claude命中</th>
              <th>Claude总数预测</th>
              <th>ChatGPT预测</th>
              <th>ChatGPT命中</th>
              <th>ChatGPT总数预测</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, actual, claudeHit, chatgptHit, totalActual }) => (
              <tr
                key={m.id}
                className={`cpRow${m.completionStatus === '已完赛' ? ' cpDone' : ''}`}
                onDoubleClick={() => onEdit(m)}
                title="双击编辑"
              >
                <td className="cpNo">{m.matchNo}</td>
                <td className="cpMatch">{m.homeTeam} <span className="cpVs">vs</span> {m.awayTeam}</td>
                <td className="cpTime">{m.australiaTime}</td>
                <td className="cpCorners">
                  {num(m.homeCorners) !== null || num(m.awayCorners) !== null
                    ? <><span className="cpHome">{m.homeCorners}</span> – <span className="cpAway">{m.awayCorners}</span>{totalActual !== null ? <span className="cpTotal"> (合计{totalActual})</span> : ''}</>
                    : <span className="cpNone">—</span>
                  }
                </td>
                <td className="cpActual">{actual ?? '—'}</td>
                <td className="cpPred">
                  <select
                    value={m.claudeCornerWinner ?? ''}
                    onChange={(e) => onSave({ ...m, claudeCornerWinner: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">—</option>
                    {cornerWinnerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className={`cpHit${claudeHit === '✓' ? ' cpHitY' : claudeHit === '×' ? ' cpHitN' : claudeHit === '待赛' ? ' cpHitP' : ''}`}>{claudeHit || '—'}</td>
                <td className="cpPred">
                  <input
                    type="text"
                    placeholder="如 9.5"
                    value={m.claudeCornerTotal ?? ''}
                    onChange={(e) => onSave({ ...m, claudeCornerTotal: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="cpTotalInput"
                  />
                </td>
                <td className="cpPred">
                  <select
                    value={m.chatgptCornerWinner ?? ''}
                    onChange={(e) => onSave({ ...m, chatgptCornerWinner: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">—</option>
                    {cornerWinnerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className={`cpHit${chatgptHit === '✓' ? ' cpHitY' : chatgptHit === '×' ? ' cpHitN' : chatgptHit === '待赛' ? ' cpHitP' : ''}`}>{chatgptHit || '—'}</td>
                <td className="cpPred">
                  <input
                    type="text"
                    placeholder="如 9.5"
                    value={m.chatgptCornerTotal ?? ''}
                    onChange={(e) => onSave({ ...m, chatgptCornerTotal: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="cpTotalInput"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cornerPredTip">双击行可在侧边栏编辑角球实际数据 · 下拉框和输入框可直接在表格内修改角球预测（修改后点击"保存到本地"）</p>
    </section>
  );
}
