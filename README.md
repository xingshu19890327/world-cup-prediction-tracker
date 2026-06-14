# 2026 世界杯预测对比 Tracker

这是一个 **ChatGPT vs Claude 的 2026 世界杯预测结果对比网站**。它用于追踪每场比赛的胜平负预测、三个比分预测、Sportsbet 赔率快照、实际比分、实际胜负、命中结果和赛后复盘。

## 核心功能

- ChatGPT 与 Claude 两套独立预测字段：胜平负、三个比分、对应 Sportsbet 赔率、逐项命中结果。
- 实际比分、实际胜负和完赛状态前置显示；已完赛行会以绿色背景/边框突出。
- Dashboard 显示当前记录数、目标 104 场、已完赛场次、两方命中数和命中率、Sportsbet 更新场次、当前领先方、重点关注比赛数。
- 主表支持 sticky 表头和左侧关键列，横向滚动时仍能看到场次、组、轮次、澳洲时间、主队和客队。
- 快捷筛选：全部、已完赛、未赛、ChatGPT/Claude 赛果命中、比分命中、双方都错、预测分歧、赔率缺失、高赔率。切换轮次时会自动清除快捷筛选，避免“第1轮”被隐藏条件缩减。
- 筛选区显示“当前显示：X / 104 场”、轮次下拉数量，以及“清空全部筛选”按钮；如果组别、搜索、完赛状态或快捷筛选仍在生效，会提示“当前还有其他筛选条件生效，可能影响显示结果。”
- 预测分歧与高赔率标签：胜平负预测不一致显示“预测分歧”；胜平负对应赔率 >= 3.00 或 Correct Score 赔率 >= 8.00 显示“高赔率”。
- 比赛详情弹窗可编辑主要字段，包括赛前备注、赛后复盘和关注级别。
- 列显示设置会保存在当前浏览器 localStorage，只影响显示，不删除数据。
- 最近 5 次备份快照保存在 localStorage，可用于误删或误导入后的恢复。

## 数据存储

所有数据保存在当前浏览器的 `localStorage`。清除浏览器缓存、更换设备或更换浏览器可能导致数据丢失，建议每次更新后导出 JSON 或使用“一键备份 JSON”。

项目包含安全 migration：旧字段 `wdlPrediction`、`predictedScore1/2/3`、旧赔率字段会迁移到 ChatGPT 对应字段；Claude 字段缺失时保持为空；旧的美东时间字段不会再用于显示或导出。载入、导入和保存时会统一规范轮次字段，例如 `Round 1`、`第1轮 ` 会归一为 `第1轮`，避免筛选漏行。

如果浏览器里仍保存旧版少量数据，页面顶部会显示“当前本地数据少于104场，建议点击‘强制载入104场基础赛程’。”点击 **强制载入104场基础赛程** 后，系统会自动下载当前数据 JSON 备份、清除旧比赛数据、写入最新 104 场基础赛程，并提示“已载入104场基础赛程”。

## 实际赛果更新方式

实际赛果 **不是实时同步**，不会页面加载自动抓取，也没有后台轮询或 `setInterval`。只有点击 **更新实际赛果** 时，前端才会调用 `/api/results` 从 football-data.org 尝试抓取一次 2026 World Cup 已完赛赛果。

`/api/results` 使用 football-data.org API：`https://api.football-data.org/v4/competitions/WC/matches?season=2026`。部署到 Vercel 前，需要在项目环境变量中配置 `FOOTBALL_DATA_TOKEN`，服务端函数会用 `X-Auth-Token: process.env.FOOTBALL_DATA_TOKEN` 和 `Accept: application/json` 请求数据。

如果 football-data.org 暂未开放 World Cup 2026 已完赛数据、token 缺失或权限不足，页面会显示中文错误，并保留已有实际比分。用户仍可手动填写实际比分，或通过 JSON/CSV 导入实际比分作为 fallback。

## Sportsbet 赔率更新方式

Sportsbet 赔率 **不是实时同步**，不会页面加载自动抓取，也没有后台轮询或定时刷新。

- 只有点击 **更新 Sportsbet 赔率** 时，系统才尝试抓取一次。
- 成功抓取后会写入表格并保存到 localStorage，成为静态记录。
- 再次点击按钮时，会再次尝试更新并覆盖已抓到的字段。
- 抓取失败时会保留现有赔率，可手动填写或通过 JSON/CSV 导入。
- 如果只能抓到 SB 主胜/平局/客胜但抓不到 Correct Score 赔率，会保留已抓到的数据并标记为“部分赔率缺失”。

项目新增 Vercel Serverless Function：`/api/sportsbet?url=...`。前端调用自己的接口，由服务端函数请求 Sportsbet 页面并尝试解析赔率，以减少浏览器直接跨站请求受到 CORS 限制的问题。

> 注意：Sportsbet 页面结构、地区限制、反爬策略或网络限制可能导致抓取失败。失败时页面会显示中文提示，并保留现有赔率。本项目不提供投注建议，也没有自动下注功能。

## 导入 JSON

1. 点击 **导入 JSON**。
2. 导入前会提示“导入会覆盖当前数据，请先备份 JSON。”
3. 系统会自动把当前数据存入最近 5 次备份快照。
4. 选择 JSON 文件后，数据会迁移为 V2 格式并保存到 localStorage。

## 导出 JSON

点击 **导出 JSON**，会下载包含时间戳的文件：

```text
world-cup-prediction-tracker-YYYYMMDD-HHmm.json
```

JSON 包含 ChatGPT 和 Claude 两套预测字段、实际结果、Sportsbet 赔率、关注级别、赛前备注和赛后复盘。

## 导出 CSV

点击 **导出 CSV**，会下载包含时间戳的文件：

```text
world-cup-prediction-tracker-YYYYMMDD-HHmm.csv
```

CSV 字段顺序与主表顺序一致，包含新表的所有核心字段。

## 一键备份 JSON

点击 **一键备份 JSON**，会下载当前数据的 JSON 备份文件。建议在批量编辑、导入、删除或重置之前先备份。

## 本地运行

```bash
npm install
npm run dev
```

## Build

```bash
npm run validate:seed
npm run build
```

`npm run validate:seed` 会检查基础赛程：`seedMatches.length === 104`、`matchNo` 1–104 连续、第1/2/3轮各 24 场、1/16 决赛 16 场、1/8 决赛 8 场、1/4 决赛 4 场、半决赛 2 场、Third Place Playoff 1 场、决赛 1 场。

`package.json` 保持真实 Vite build：

```json
"build": "tsc -p tsconfig.json --noEmit && vite build"
```

## 部署到 Vercel

1. 将仓库导入 Vercel。
2. Framework Preset 选择 Vite（通常会自动识别）。
3. Build Command 使用 `npm run build`。
4. Output Directory 使用 `dist`。
5. `api/sportsbet.js` 会作为 Vercel Function 部署，用于一次性手动抓取 Sportsbet 赔率快照。

## 重要限制

- 不使用 FIFA 官方 logo 或侵权图片。
- 不需要用户登录。
- 不使用数据库。
- 不后端保存用户数据。
- 不提供投注建议或自动下注。
- 不使用付费 API key。
- 不实时刷新赔率、不后台轮询、不定时抓取。
