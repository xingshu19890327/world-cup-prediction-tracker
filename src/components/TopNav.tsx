export default function TopNav() {
  return <header className="top heroTop">
    <div className="heroBackdrop" aria-hidden="true">
      <div className="starLayer messi"><span>10</span></div>
      <div className="starLayer mbappe"><span>7</span></div>
      <div className="starLayer ronaldo"><span>7</span></div>
      <svg className="nySkyline" viewBox="0 0 900 170" role="img" aria-label="New York skyline and stadium silhouette">
        <path className="bridgeLine" d="M36 126 C150 60 264 60 378 126 M522 126 C636 60 750 60 864 126" />
        <path className="stadiumGlow" d="M276 137 C352 97 548 97 624 137" />
        <path className="skylineFill" d="M0 150H42V118H62V91H82V150H118V106H139V74H163V150H198V94H216V52H235V94H254V150H304V118H328V84H350V118H374V150H414V104H434V82H454V104H473V150H515V92H534V64H548V38H563V64H579V92H599V150H644V116H668V88H694V150H732V102H756V76H782V102H806V150H846V121H870V150H900V170H0Z" />
        <path className="liberty" d="M111 150V116h10l4-32 4 32h10v34m-20-35-13-17m26 17 16-24m-26-8-10-14m13 14 5-20m-1 20 12-16" />
      </svg>
      <div className="stadiumArc" />
      <div className="ballTrail" />
    </div>

    <div className="heroCopy">
      <p className="heroBadge">NEW YORK / NEW JERSEY • WORLD CUP 2026</p>
      <h1>2026 世界杯 ChatGPT vs Claude 预测对比 Tracker</h1>
      <p className="heroSubtitle">World Cup 2026 • New York Spotlight • Prediction Tracker</p>
      <div className="matchCards" aria-hidden="true">
        <span>Claude XI</span><b>vs</b><span>ChatGPT XI</span>
      </div>
    </div>
    <div className="worldCupArt" aria-hidden="true">
      <span className="hostFocus">Host Focus: New York</span>
      <span className="trophy">🏆</span>
      <span className="ball">⚽</span>
      <div className="pitchLine" />
    </div>
  </header>;
}
