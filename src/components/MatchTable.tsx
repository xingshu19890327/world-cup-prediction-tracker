import { useMemo, useState } from 'react';
import type { MatchPrediction } from '../types';
import { clearTableLayout, loadTableLayout, saveTableLayout } from '../utils/storage';

export type TableColumn = { key: keyof MatchPrediction; label: string; group: string; defaultWidth: number; lowFrequency?: boolean };

const columns: TableColumn[] = [
  { key: 'matchNo', label: '场次', group: 'base', defaultWidth: 64 },
  { key: 'round', label: '轮次', group: 'base', defaultWidth: 92 },
  { key: 'homeTeam', label: '主队', group: 'base', defaultWidth: 112 },
  { key: 'awayTeam', label: '客队', group: 'base', defaultWidth: 112 },
  { key: 'group', label: '组', group: 'base', defaultWidth: 56 },
  { key: 'australiaTime', label: '澳洲时间(AEST)', group: 'base', defaultWidth: 160 },
  { key: 'city', label: '城市', group: 'base', defaultWidth: 112 },
  { key: 'actualScore', label: '实际比分', group: 'actual', defaultWidth: 96 },
  { key: 'actualResult', label: '实际赛果', group: 'actual', defaultWidth: 122 },
  { key: 'completionStatus', label: '状态', group: 'actual', defaultWidth: 96 },
  { key: 'claudePredictedScore1', label: 'Claude比分1', group: 'claude', defaultWidth: 132 },
  { key: 'claudePredictedScore2', label: 'Claude比分2', group: 'claude', defaultWidth: 132 },
  { key: 'claudePredictedScore3', label: 'Claude比分3', group: 'claude', defaultWidth: 132 },
  { key: 'claudeWdlPrediction', label: 'Claude胜平负主推', group: 'claude', defaultWidth: 138 },
  { key: 'claudeAnyScoreHit', label: 'Claude比分命中', group: 'claude', defaultWidth: 126 },
  { key: 'claudeWdlHit', label: 'Claude赛果命中', group: 'claude', defaultWidth: 126 },
  { key: 'chatgptWdlPrediction', label: 'ChatGPT胜平负主推', group: 'gpt', defaultWidth: 138 },
  { key: 'chatgptActualWinner', label: '实际胜方', group: 'actual', defaultWidth: 158 },
  { key: 'chatgptWdlHit', label: 'ChatGPT赛果命中', group: 'gpt', defaultWidth: 132 },
  { key: 'chatgptAnyScoreHit', label: 'ChatGPT比分命中', group: 'gpt', defaultWidth: 132 },
  { key: 'chatgptPredictedScore1', label: 'ChatGPT比分1', group: 'gpt', defaultWidth: 138 },
  { key: 'chatgptPredictedScore2', label: 'ChatGPT比分2', group: 'gpt', defaultWidth: 138 },
  { key: 'chatgptPredictedScore3', label: 'ChatGPT比分3', group: 'gpt', defaultWidth: 138 },
  { key: 'predictionDisagreement', label: '预测分歧', group: 'extra', defaultWidth: 88 },
  { key: 'notes', label: '备注', group: 'extra', defaultWidth: 160, lowFrequency: true },
  { key: 'oddsSource', label: '赔率来源', group: 'extra', defaultWidth: 130, lowFrequency: true },
  { key: 'preMatchNotes', label: '赛前备注', group: 'extra', defaultWidth: 180, lowFrequency: true },
  { key: 'postMatchReview', label: '赛后复盘', group: 'extra', defaultWidth: 180, lowFrequency: true },
  { key: 'focusLevel', label: '关注级别', group: 'extra', defaultWidth: 96, lowFrequency: true },
];

const defaultOrder = columns.map((column) => column.key);
const columnByKey = new Map(columns.map((column) => [column.key, column]));
const widthFor = (column: TableColumn, widths: Record<string, number>) => widths[column.key] ?? column.defaultWidth;
const actualResultKeys: (keyof MatchPrediction)[] = ['actualScore', 'actualResult', 'completionStatus', 'chatgptActualWinner'];

export default function MatchTable({ matches, onOpen }: { matches: MatchPrediction[]; onOpen:(m:MatchPrediction)=>void }) {
  const [layout, setLayout] = useState(loadTableLayout);
  const [dragKey, setDragKey] = useState<keyof MatchPrediction | null>(null);

  const persist = (next: typeof layout) => {
    setLayout(next);
    saveTableLayout(next);
  };

  const orderedColumns = useMemo(() => {
    const valid = layout.columnOrder.filter((key) => columnByKey.has(key));
    const missing = defaultOrder.filter((key) => !valid.includes(key));
    return [...valid, ...missing].map((key) => columnByKey.get(key)!).filter((column) => !layout.hiddenColumns.includes(column.key));
  }, [layout.columnOrder, layout.hiddenColumns]);

  const leftOffsets = useMemo(() => {
    let left = 0;
    return orderedColumns.map((column, index) => {
      const offset = left;
      if (index < layout.frozenColumns) left += widthFor(column, layout.columnWidths);
      return offset;
    });
  }, [orderedColumns, layout.columnWidths, layout.frozenColumns]);

  const tableWidth = orderedColumns.reduce((sum, column) => sum + widthFor(column, layout.columnWidths), 0);

  const resize = (column: TableColumn, startX: number, startWidth: number) => {
    const onMove = (event: MouseEvent) => {
      const width = Math.max(56, Math.round(startWidth + event.clientX - startX));
      persist({ ...layout, columnWidths: { ...layout.columnWidths, [column.key]: width } });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const moveColumn = (targetKey: keyof MatchPrediction) => {
    if (!dragKey || dragKey === targetKey) return;
    const nextOrder = orderedColumns.map((column) => column.key);
    const from = nextOrder.indexOf(dragKey);
    const to = nextOrder.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    nextOrder.splice(to, 0, ...nextOrder.splice(from, 1));
    const hidden = defaultOrder.filter((key) => layout.hiddenColumns.includes(key) && !nextOrder.includes(key));
    persist({ ...layout, columnOrder: [...nextOrder, ...hidden] });
    setDragKey(null);
  };

  const toggleColumn = (key: keyof MatchPrediction) => {
    const hiddenColumns = layout.hiddenColumns.includes(key) ? layout.hiddenColumns.filter((item) => item !== key) : [...layout.hiddenColumns, key];
    persist({ ...layout, hiddenColumns });
  };

  const resetLayout = () => {
    clearTableLayout();
    setLayout(loadTableLayout());
  };

  return <>
    <section className="panel tableSettings">
      <div>
        <b>表格设置</b>
        <p>拖动表头移动列顺序；拖动表头右边界调整列宽。</p>
      </div>
      <label>冻结列数量
        <select value={layout.frozenColumns} onChange={(event) => persist({ ...layout, frozenColumns: Number(event.target.value) })}>
          <option value={0}>不冻结</option>
          <option value={3}>场次 / 轮次 / 主队</option>
          <option value={4}>场次 / 轮次 / 主队 / 客队</option>
          <option value={7}>基础信息区</option>
        </select>
      </label>
      <details>
        <summary>列显示 / 隐藏</summary>
        <div className="columnToggles">
          {columns.filter((column) => column.lowFrequency).map((column) => (
            <label key={column.key}>
              <input type="checkbox" checked={!layout.hiddenColumns.includes(column.key)} onChange={() => toggleColumn(column.key)} />
              {column.label}
            </label>
          ))}
        </div>
      </details>
      <button onClick={resetLayout}>恢复默认表格布局</button>
    </section>
    <section className="tableWrap">
      <table style={{ minWidth: tableWidth }}>
        <colgroup>
          {orderedColumns.map((column) => <col key={column.key} style={{ width: widthFor(column, layout.columnWidths) }} />)}
        </colgroup>
        <thead>
          <tr>
            {orderedColumns.map((column, index) => {
              const frozen = index < layout.frozenColumns;
              const width = widthFor(column, layout.columnWidths);
              const style = frozen ? { left: leftOffsets[index], width, minWidth: width } : { width, minWidth: width };
              return <th
                key={column.key}
                draggable
                onDragStart={() => setDragKey(column.key)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveColumn(column.key)}
                className={`${column.group} ${frozen ? 'frozen' : ''}`}
                style={style}
              >
                {column.label}
                <span className="resizeHandle" onMouseDown={(event) => {
                  event.preventDefault();
                  resize(column, event.clientX, widthFor(column, layout.columnWidths));
                }} />
              </th>;
            })}
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const isCompleted = match.completionStatus === '已完赛';
            const isPending = match.completionStatus === '未赛';
            return <tr
              key={match.id}
              className={isCompleted ? 'matchCompleted' : isPending ? 'matchPending' : ''}
              onClick={() => onOpen(match)}
            >
              {orderedColumns.map((column, index) => {
                const frozen = index < layout.frozenColumns;
                const width = widthFor(column, layout.columnWidths);
                const style = frozen ? { left: leftOffsets[index], width, minWidth: width } : { width, minWidth: width };
                const value = String(match[column.key] ?? '');
                const pendingActual = isPending && actualResultKeys.includes(column.key);
                const completedActual = isCompleted && actualResultKeys.includes(column.key);
                const hitClass = value === '✓' ? 'ok' : value === '×' ? 'bad' : '';
                return <td
                  key={column.key}
                  className={`${column.group} ${frozen ? 'frozen' : ''} ${completedActual ? 'actualCompleted' : ''} ${pendingActual ? 'actualPending' : ''} ${hitClass}`}
                  style={style}
                >
                  {column.key === 'completionStatus' && (isCompleted || isPending)
                    ? <span className={`statusBadge ${isCompleted ? 'statusDone' : 'statusPending'}`}>{value}</span>
                    : value}
                </td>;
              })}
            </tr>;
          })}
        </tbody>
      </table>
    </section>
  </>;
}
