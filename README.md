# 2026 世界杯 ChatGPT vs Claude 预测对比 Tracker

V4 clean rebuild：一个本地优先的 Excel 风格网页 tracker，用于对比 Claude 和 ChatGPT 的 2026 世界杯小组赛预测。

## 数据来源

本版只使用用户上传的 `世界杯2026_整合对比表` 图片作为主数据参考，重点还原 `整合对比`、`GPT小组赛预测`、`说明` 中可见字段。`src/data/seedMatches.ts` 保留 72 条小组赛主表行，不再生成旧版 TBD 占位淘汰赛。

## 核心能力

- Excel 阅读模式主表：基础内容区 / Claude 区 / ChatGPT 区 / 补充区。
- 点击行打开右侧编辑器，修改比分、预测、赔率、备注、赔率来源、复盘等字段。
- `localStorage` 本地保存，支持导入 JSON、导出 JSON、一键备份 JSON、导出 CSV、重置为 Excel 基准数据。
- 手动点击“更新结果 / 重新计算”后，重新计算实际胜负、命中状态、预测分歧和高赔率标签。
- 支持轮次、组、完赛状态、命中状态、球队、城市、快捷筛选和清空全部筛选。
- Dashboard 显示记录数、完赛数、双方赛果/比分命中率、当前领先和重点关注比赛数。

## 不包含

本版不包含 football-data.org、Sportsbet 自动抓取、serverless API、后台轮询、登录或数据库。

## 开发命令

```bash
npm run validate:seed
npm run build
```
