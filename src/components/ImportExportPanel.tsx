import type { MatchPrediction } from '../types';
import { toCsv } from '../utils/csv';
import { download } from '../utils/storage';

type SharedProps = {
  matches: MatchPrediction[];
  onImport:(text:string)=>void;
  onReset:()=>void;
};

type ActionProps = {
  onRecalc:()=>void;
  onUpdateResults:()=>void;
  updatingResults:boolean;
  lastResultsUpdate:string;
};

const jsonFor = (matches: MatchPrediction[]) => JSON.stringify(matches, null, 2);

export default function ImportExportPanel({ onRecalc, onUpdateResults, updatingResults, lastResultsUpdate }: ActionProps) {
  return <section className="panel actions primaryActions">
    <button onClick={onRecalc}>更新结果 / 重新计算</button>
    <button onClick={onUpdateResults} disabled={updatingResults}>{updatingResults ? '正在更新赛果…' : '更新实际赛果'}</button>
    {lastResultsUpdate && <span className="count">最后更新赛果时间：{lastResultsUpdate}</span>}
  </section>;
}

export function DataManagementPanel({ matches, onImport, onReset }: SharedProps) {
  return <section className="panel dataManagement">
    <div className="panelTitle">
      <p className="eyebrow">Data tools</p>
      <h2>数据管理 / 导入导出 / 备份</h2>
      <p>数据保存在 localStorage；清缓存、更换设备或浏览器会丢数据，建议定期导出 JSON。</p>
    </div>
    <div className="dataGroups">
      <div>
        <h3>导入 / 导出</h3>
        <div className="buttonRow">
          <button onClick={() => download('world-cup-tracker-v4.json', jsonFor(matches), 'application/json')}>导出 JSON</button>
          <button onClick={() => download('world-cup-tracker-v4.csv', toCsv(matches), 'text/csv;charset=utf-8')}>导出 CSV</button>
          <label className="file">导入 JSON<input type="file" accept="application/json" onChange={e=>{const f=e.target.files?.[0]; if(f) void f.text().then(onImport)}}/></label>
        </div>
      </div>
      <div>
        <h3>备份</h3>
        <div className="buttonRow"><button onClick={() => download(`backup-${Date.now()}.json`, jsonFor(matches), 'application/json')}>一键备份 JSON</button></div>
      </div>
      <div>
        <h3>重新载入基准数据</h3>
        <div className="buttonRow"><button onClick={onReset}>重新载入 Excel 基准数据</button></div>
      </div>
    </div>
  </section>;
}
