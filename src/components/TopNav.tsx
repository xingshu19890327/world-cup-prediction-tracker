export default function TopNav() {
  return <header className="top heroTop">
    <div className="heroCopy">
      <p className="eyebrow">V4 Clean Rebuild · 2026 World Cup</p>
      <h1>2026 世界杯 ChatGPT vs Claude 预测对比 Tracker</h1>
      <p>基于上传 Excel 图片重建：整合对比 / GPT小组赛预测 / 说明。表格优先，轻量追踪实际赛果与预测命中。</p>
      <div className="matchCards" aria-hidden="true">
        <span>Claude XI</span><b>vs</b><span>ChatGPT XI</span>
      </div>
    </div>
    <div className="worldCupArt" aria-hidden="true">
      <span className="trophy">🏆</span>
      <span className="ball">⚽</span>
      <div className="pitchLine" />
    </div>
  </header>;
}
