# 2026 世界杯 ChatGPT vs Claude 预测对比 Tracker

V4 clean rebuild：一个本地优先的 Excel 风格网页 tracker，用于对比 Claude 和 ChatGPT 的 2026 世界杯预测。

## 数据来源

本版使用用户上传的 `世界杯2026_整合对比表` 图片和 `reference/seedMatches.from_excel.json` 作为小组赛基准数据参考。`src/data/seedMatches.ts` 保留完整 104 场结构：1–72 为小组赛基准行，73–104 为淘汰赛占位行。

## 核心能力

- Excel 阅读模式主表：基础内容区 / Claude 区 / ChatGPT 区 / 补充区。
- 点击行打开右侧编辑器，修改比分、预测、赔率、备注、赔率来源、复盘等字段。
- `localStorage` 本地保存，支持导入 JSON、导出 JSON、一键备份 JSON、导出 CSV、重置为 Excel 基准数据。
- 手动点击“更新结果 / 重新计算”后，重新计算实际胜负、命中状态、预测分歧和高赔率标签。
- 手动点击“更新实际赛果”时，前端会调用 `/api/results`，尝试从 football-data.org 抓取已完赛比分并写入尚未填写实际比分的本地比赛。
- 支持轮次、组、完赛状态、命中状态、球队、城市、快捷筛选和清空全部筛选。
- Dashboard 显示记录数、完赛数、双方赛果/比分命中率、当前领先和重点关注比赛数。

## football-data.org 实际赛果更新

- 需要在 Vercel 环境变量中配置 `FOOTBALL_DATA_TOKEN`。
- 实际赛果不是实时同步；系统不会后台轮询，也不会自动刷新页面。
- 只有用户点击“更新实际赛果”按钮时，才会请求一次 football-data.org。
- 已有 `actualScore` 的比赛默认不会被覆盖，会计入“已有比分跳过”。
- 如果 football-data.org 尚未开放 2026 World Cup 数据，或 token/权限不可用，用户仍可手动填写实际比分或导入 JSON 作为 fallback。

## 不包含

本版不包含后台轮询、登录或数据库。

## 开发命令

```bash
npm run validate:seed
npm run validate:reference
npm run build
```
