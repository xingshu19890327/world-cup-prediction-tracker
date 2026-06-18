import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnFiltersState, MatchPrediction } from '../types';
import { clearTableLayout, loadTableLayout, saveTableLayout } from '../utils/storage';
import { matchTeamDisplayName } from '../utils/teamDisplay';

export type TableColumn = { key: keyof MatchPrediction; label: string; fullLabel?: string; group: string; defaultWidth: number; minWidth?: number; maxWidth?: number; lowFrequency?: boolean };

const columns: TableColumn[] = [
  { key: 'chatgptWdlPrediction', label: '主推', fullLabel: 'ChatGPT胜平负主推', group: 'gpt', defaultWidth: 70, minWidth: 62, maxWidth: 105 },
  { key: 'chatgptPredictedScore1', label: '比分1', fullLabel: 'ChatGPT比分1', group: 'gpt', defaultWidth: 65, minWidth: 58, maxWidth: 88 },
  { key: 'chatgptPredictedScore2', label: '比分2', fullLabel: 'ChatGPT比分2', group: 'gpt', defaultWidth: 65, minWidth: 58, maxWidth: 88 },
  { key: 'chatgptPredictedScore3', label: '比分3', fullLabel: 'ChatGPT比分3', group: 'gpt', defaultWidth: 65, minWidth: 58, maxWidth: 88 },
  { key: 'chatgptWdlHit', label: '赛果中', fullLabel: 'ChatGPT赛果命中', group: 'gpt', defaultWidth: 72, minWidth: 64, maxWidth: 92 },
  { key: 'chatgptAnyScoreHit', label: '比分中', fullLabel: 'ChatGPT比分命中', group: 'gpt', defaultWidth: 72, minWidth: 64, maxWidth: 92 },
  { key: 'matchNo', label: '场次', group: 'base', defaultWidth: 48, minWidth: 44, maxWidth: 58 },
  { key: 'round', label: '轮次', group: 'base', defaultWidth: 70, minWidth: 62, maxWidth: 100 },
  { key: 'homeTeam', label: '主队', group: 'base', defaultWidth: 118, minWidth: 92, maxWidth: 190 },
  { key: 'awayTeam', label: '客队', group: 'base', defaultWidth: 118, minWidth: 92, maxWidth: 190 },
  { key: 'australiaTime', label: '澳洲时间(AEST)', group: 'base', defaultWidth: 135, minWidth: 120, maxWidth: 165 },
  { key: 'group', label: '组', group: 'base', defaultWidth: 42, minWidth: 38, maxWidth: 52 },
  { key: 'city', label: '城市', group: 'base', defaultWidth: 95, minWidth: 82, maxWidth: 128 },
  { key: 'actualScore', label: '比分', fullLabel: '实际比分', group: 'actual', defaultWidth: 65, minWidth: 58, maxWidth: 86 },
  { key: 'actualResult', label: '赛果', fullLabel: '实际赛果', group: 'actual', defaultWidth: 70, minWidth: 62, maxWidth: 92 },
  { key: 'completionStatus', label: '状态', group: 'actual', defaultWidth: 68, minWidth: 60, maxWidth: 84 },
  { key: 'claudeWdlPrediction', label: '主推', fullLabel: 'Claude胜平负主推', group: 'claude', defaultWidth: 70, minWidth: 62, maxWidth: 105 },
  { key: 'claudePredictedScore1', label: '比分1', fullLabel: 'Claude比分1', group: 'claude', defaultWidth: 65, minWidth: 58, maxWidth: 88 },
  { key: 'claudePredictedScore2', label: '比分2', fullLabel: 'Claude比分2', group: 'claude', defaultWidth: 65, minWidth: 58, maxWidth: 88 },
  { key: 'claudePredictedScore3', label: '比分3', fullLabel: 'Claude比分3', group: 'claude', defaultWidth: 65, minWidth: 58, maxWidth: 88 },
  { key: 'claudeWdlHit', label: '赛果中', fullLabel: 'Claude赛果命中', group: 'claude', defaultWidth: 72, minWidth: 64, maxWidth: 92 },
  { key: 'claudeAnyScoreHit', label: '比分中', fullLabel: 'Claude比分命中', group: 'claude', defaultWidth: 72, minWidth: 64, maxWidth: 92 },
  { key: 'chatgptActualWinner', label: '实际胜方', group: 'actual', defaultWidth: 110 },
  { key: 'predictionDisagreement', label: '预测分歧', group: 'extra', defaultWidth: 82 },
  { key: 'notes', label: '备注', group: 'extra', defaultWidth: 140, lowFrequency: true },
  { key: 'oddsSource', label: '赔率来源', group: 'extra', defaultWidth: 116, lowFrequency: true },
  { key: 'preMatchNotes', label: '赛前备注', group: 'extra', defaultWidth: 150, lowFrequency: true },
  { key: 'postMatchReview', label: '赛后复盘', group: 'extra', defaultWidth: 150, lowFrequency: true },
  { key: 'focusLevel', label: '关注级别', group: 'extra', defaultWidth: 86, lowFrequency: true },
];

const defaultOrder = columns.map((column) => column.key);
const columnByKey = new Map(columns.map((column) => [column.key, column]));
const clampWidth = (column: TableColumn, width: number) => Math.max(column.minWidth ?? 56, Math.min(column.maxWidth ?? 220, width));
const labelFor = (column: TableColumn, labels: Record<string, string>) => labels[column.key] || column.label;
const titleFor = (column: TableColumn, labels: Record<string, string>) => labels[column.key] || column.fullLabel || column.label;
const filterableKeys = new Set<keyof MatchPrediction>([
  'chatgptWdlPrediction','chatgptPredictedScore1','chatgptPredictedScore2','chatgptPredictedScore3','chatgptWdlHit','chatgptAnyScoreHit',
  'matchNo','round','homeTeam','awayTeam','australiaTime','group','city','actualScore','actualResult','completionStatus',
  'claudeWdlPrediction','claudePredictedScore1','claudePredictedScore2','claudePredictedScore3','claudeWdlHit','claudeAnyScoreHit',
]);
const blankValueLabel = '空白';
const filterValue = (value: unknown) => String(value ?? '').trim() || blankValueLabel;

const actualResultKeys: (keyof MatchPrediction)[] = ['actualScore', 'actualResult', 'completionStatus', 'chatgptActualWinner'];

const VALUE_ODDS_THRESHOLD = 2.5;
// Claude 的胜平负主推映射到具体球队，便于与 ChatGPT 主推（球队名）比较
const claudePickTeam = (m: MatchPrediction) =>
  m.claudeWdlPrediction === '主胜' ? m.homeTeam : m.claudeWdlPrediction === '客胜' ? m.awayTeam : m.claudeWdlPrediction === '平局' ? '平局' : '';
// 双方主推一致且对应赔率偏高 → 潜在高价值
const isValueBet = (m: MatchPrediction) => {
  const pick = claudePickTeam(m);
  if (!pick || pick !== String(m.chatgptWdlPrediction ?? '').trim()) return false;
  const odds = Number(m.claudeCorrespondingSbWdlOdds);
  return Number.isFinite(odds) && odds >= VALUE_ODDS_THRESHOLD;
};

export default function MatchTable({ matches, allMatches, columnFilters, onColumnFiltersChange, onOpen }: { matches: MatchPrediction[]; allMatches: MatchPrediction[]; columnFilters: ColumnFiltersState; onColumnFiltersChange:(filters:ColumnFiltersState)=>void; onOpen:(m:MatchPrediction)=>void }) {
  const [layout, setLayout] = useState(loadTableLayout);
  const [dragKey, setDragKey] = useState<keyof MatchPrediction | null>(null);
  const [openFilterKey, setOpenFilterKey] = useState<keyof MatchPrediction | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const [editingHeader, setEditingHeader] = useState<keyof MatchPrediction | null>(null);
  const [headerDraft, setHeaderDraft] = useState('');
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) setOpenFilterKey(null);
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  const uniqueValuesByColumn = useMemo(() => {
    const values = new Map<keyof MatchPrediction, string[]>();
    columns.forEach((column) => {
      if (!filterableKeys.has(column.key)) return;
      values.set(column.key, [...new Set(allMatches.map((match) => filterValue(match[column.key])))].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true })));
    });
    return values;
  }, [allMatches]);

  const openColumnFilter = (column: TableColumn) => {
    const values = uniqueValuesByColumn.get(column.key) ?? [];
    setOpenFilterKey(column.key);
    setFilterSearch('');
    setDraftValues(columnFilters[column.key]?.length ? [...columnFilters[column.key]!] : values);
  };

  const applyColumnFilter = (key: keyof MatchPrediction) => {
    const values = uniqueValuesByColumn.get(key) ?? [];
    const next = { ...columnFilters };
    if (draftValues.length === values.length) delete next[key];
    else next[key] = draftValues;
    onColumnFiltersChange(next);
    setOpenFilterKey(null);
  };

  const clearColumnFilter = (key: keyof MatchPrediction) => {
    const next = { ...columnFilters };
    delete next[key];
    onColumnFiltersChange(next);
    setDraftValues(uniqueValuesByColumn.get(key) ?? []);
  };

  const persist = (next: typeof layout) => {
    setLayout(next);
    saveTableLayout(next);
  };

  const orderedColumns = useMemo(() => {
    const valid = layout.columnOrder.filter((key) => columnByKey.has(key));
    const missing = defaultOrder.filter((key) => !valid.includes(key));
    return [...valid, ...missing].map((key) => columnByKey.get(key)!).filter((column) => !layout.hiddenColumns.includes(column.key));
  }, [layout.columnOrder, layout.hiddenColumns]);

  const calculateAutoWidths = (sourceColumns = orderedColumns, sourceMatches = matches) => {
    const sampleRows = sourceMatches.slice(0, 40);
    return sourceColumns.reduce<Record<string, number>>((widths, column) => {
      const values = sampleRows.map((match) => displayValue(match, column.key));
      const longest = values.reduce((max, value) => Math.max(max, [...value].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 12 : 7), 0)), 0);
      const filterSpace = filterableKeys.has(column.key) ? 24 : 10;
      widths[column.key] = clampWidth(column, Math.max(column.defaultWidth, Math.ceil(longest + filterSpace + 18)));
      return widths;
    }, {});
  };

  const effectiveWidths = useMemo(() => {
    const autoWidths = calculateAutoWidths();
    return orderedColumns.reduce<Record<string, number>>((widths, column) => {
      widths[column.key] = layout.columnWidths[column.key] ?? autoWidths[column.key] ?? column.defaultWidth;
      return widths;
    }, {});
  }, [orderedColumns, matches, layout.columnWidths, layout.columnLabels]);

  const widthForColumn = (column: TableColumn) => effectiveWidths[column.key] ?? column.defaultWidth;

  const leftOffsets = useMemo(() => {
    let left = 0;
    return orderedColumns.map((column, index) => {
      const offset = left;
      if (index < layout.frozenColumns) left += widthForColumn(column);
      return offset;
    });
  }, [orderedColumns, effectiveWidths, layout.frozenColumns]);

  const tableWidth = orderedColumns.reduce((sum, column) => sum + widthForColumn(column), 0);

  const resize = (column: TableColumn, startX: number, startWidth: number) => {
    const onMove = (event: MouseEvent) => {
      const width = clampWidth(column, Math.round(startWidth + event.clientX - startX));
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

  const autoFitColumns = () => persist({ ...layout, columnWidths: calculateAutoWidths() });
  const startHeaderEdit = (column: TableColumn) => {
    setEditingHeader(column.key);
    setHeaderDraft(labelFor(column, layout.columnLabels));
  };
  const saveHeaderEdit = (column: TableColumn) => {
    const value = headerDraft.trim();
    const nextLabels = { ...layout.columnLabels };
    if (!value || value === column.label) delete nextLabels[column.key];
    else nextLabels[column.key] = value;
    persist({ ...layout, columnLabels: nextLabels });
    setEditingHeader(null);
  };
  const cancelHeaderEdit = () => {
    setEditingHeader(null);
    setHeaderDraft('');
  };

  return <>
    <section className="panel tableSettings">
      <div>
        <b>表格设置</b>
        <p>拖动表头移动列顺序；拖动表头右边界调整列宽；双击表头文字可改显示名称。</p>
      </div>
      <label>冻结列数量
        <select value={layout.frozenColumns} onChange={(event) => persist({ ...layout, frozenColumns: Number(event.target.value) })}>
          <option value={0}>不冻结</option>
          <option value={4}>ChatGPT 主推 + 比分</option>
          <option value={7}>ChatGPT 主推/比分 + 场次</option>
          <option value={10}>ChatGPT 区 + 场次/轮次/主队/客队</option>
        </select>
      </label>
      <details>
        <summary>列显示 / 隐藏</summary>
        <div className="columnToggles">
          {columns.filter((column) => column.lowFrequency).map((column) => (
            <label key={column.key}>
              <input type="checkbox" checked={!layout.hiddenColumns.includes(column.key)} onChange={() => toggleColumn(column.key)} />
              {labelFor(column, layout.columnLabels)}
            </label>
          ))}
        </div>
      </details>
      <button onClick={autoFitColumns}>自动适配列宽</button>
      <button onClick={resetLayout}>恢复默认表格布局</button>
    </section>
    <section className="tableWrap">
      <table style={{ minWidth: tableWidth }}>
        <colgroup>
          {orderedColumns.map((column) => <col key={column.key} style={{ width: widthForColumn(column) }} />)}
        </colgroup>
        <thead>
          <tr>
            {orderedColumns.map((column, index) => {
              const frozen = index < layout.frozenColumns;
              const width = widthForColumn(column);
              const label = labelFor(column, layout.columnLabels);
              const title = titleFor(column, layout.columnLabels);
              const style = frozen ? { left: leftOffsets[index], width, minWidth: width } : { width, minWidth: width };
              return <th
                key={column.key}
                draggable
                onDragStart={() => setDragKey(column.key)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveColumn(column.key)}
                className={`${column.group} ${frozen ? 'frozen' : ''} ${column.key in columnFilters ? 'filteredHeader' : ''}`}
                style={style}
              >
                <span className="headerContent">{editingHeader === column.key ? <input
                  className="headerLabelInput"
                  value={headerDraft}
                  autoFocus
                  draggable={false}
                  onChange={(event) => setHeaderDraft(event.target.value)}
                  onBlur={() => saveHeaderEdit(column)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') saveHeaderEdit(column);
                    if (event.key === 'Escape') cancelHeaderEdit();
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                /> : <span className="headerLabel" title={title} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); startHeaderEdit(column); }}>{label}</span>}{filterableKeys.has(column.key) && <button
                  type="button"
                  className={`headerFilterButton ${column.key in columnFilters ? 'active' : ''}`}
                  title={`${title} 筛选`}
                  draggable={false}
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); openColumnFilter(column); }}
                  onMouseDown={(event) => event.stopPropagation()}
                >▼</button>}</span>
                {openFilterKey === column.key && <div className="columnFilterMenu" ref={filterMenuRef} onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                  <b title={title}>{label} 筛选</b>
                  <input className="columnFilterSearch" placeholder="搜索该列值" value={filterSearch} onChange={(event) => setFilterSearch(event.target.value)} />
                  <div className="columnFilterActions">
                    <button type="button" onClick={() => setDraftValues(uniqueValuesByColumn.get(column.key) ?? [])}>全选</button>
                    <button type="button" onClick={() => setDraftValues([])}>清空</button>
                    <button type="button" onClick={() => clearColumnFilter(column.key)}>清除本列筛选</button>
                  </div>
                  <div className="columnFilterOptions">
                    {(uniqueValuesByColumn.get(column.key) ?? []).filter((value) => value.toLowerCase().includes(filterSearch.toLowerCase())).map((value) => <label key={value}>
                      <input type="checkbox" checked={draftValues.includes(value)} onChange={(event) => setDraftValues(event.target.checked ? [...draftValues, value] : draftValues.filter((item) => item !== value))} />
                      <span title={value}>{value}</span>
                    </label>)}
                  </div>
                  <div className="columnFilterFooter">
                    <button type="button" onClick={() => applyColumnFilter(column.key)}>确认</button>
                    <button type="button" onClick={() => setOpenFilterKey(null)}>取消</button>
                  </div>
                </div>}
                <span className="resizeHandle" onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  resize(column, event.clientX, widthForColumn(column));
                }} />
              </th>;
            })}
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const isCompleted = match.completionStatus === '已完赛';
            const isPending = match.completionStatus === '未赛';
            const claudeOnlyHit = match.claudeWdlHit === '✓' && match.chatgptWdlHit === '×';
            const gptOnlyHit = match.chatgptWdlHit === '✓' && match.claudeWdlHit === '×';
            const valueBet = isValueBet(match);
            return <tr
              key={match.id}
              className={[
                isCompleted ? 'matchCompleted' : isPending ? 'matchPending' : '',
                claudeOnlyHit ? 'claudeOnlyHit' : '',
                gptOnlyHit ? 'gptOnlyHit' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onOpen(match)}
            >
              {orderedColumns.map((column, index) => {
                const frozen = index < layout.frozenColumns;
                const width = widthForColumn(column);
                const style = frozen ? { left: leftOffsets[index], width, minWidth: width } : { width, minWidth: width };
                const value = displayValue(match, column.key);
                const pendingActual = isPending && actualResultKeys.includes(column.key);
                const completedActual = isCompleted && actualResultKeys.includes(column.key);
                const hitClass = value === '✓' ? 'ok' : value === '×' ? 'bad' : '';
                return <td
                  key={column.key}
                  className={`${column.group} ${frozen ? 'frozen' : ''} ${completedActual ? 'actualCompleted' : ''} ${pendingActual ? 'actualPending' : ''} ${hitClass}`}
                  style={style}
                  title={value}
                >
                  {column.key === 'completionStatus' && (isCompleted || isPending)
                    ? <span className={`statusBadge ${isCompleted ? 'statusDone' : 'statusPending'}`}>{value}</span>
                    : <>{value}{column.key === 'claudeWdlPrediction' && valueBet && <span className="valueTag" title="双方主推一致且赔率偏高，潜在高价值">高价值</span>}</>}
                </td>;
              })}
            </tr>;
          })}
        </tbody>
      </table>
    </section>
  </>;
}
