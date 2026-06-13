# 2026 世界杯预测对比 Tracker

这是一个 **ChatGPT vs Claude** 的 2026 世界杯预测对比 Tracker，用来追踪：

- ChatGPT / Claude 胜平负预测
- ChatGPT / Claude 三个比分预测
- Sportsbet 胜平负与 Correct Score 赔率快照
- 实际比分、实际胜负、比分命中率、赛果命中率
- 导入、导出、备份与本地保存

## 数据存储

数据保存在当前浏览器的 `localStorage` 中。清除浏览器缓存、更换设备或更换浏览器可能导致数据丢失，建议每次更新后点击 **一键备份 JSON** 或 **导出 JSON**。

## Sportsbet 赔率更新方式

Sportsbet 赔率 **不是实时同步**，也不会自动刷新。

- 只有用户点击 **更新 Sportsbet 赔率** 时，系统才尝试抓取一次。
- 成功后，赔率会写入表格并保存为静态记录。
- 之后赔率保持不变，除非用户再次点击更新按钮。
- 抓取失败时不会清空已有赔率。
- 抓取失败时可以手动填写，或通过 JSON / CSV 导入赔率。

项目新增了 Vercel Serverless Function：`/api/sportsbet?url=...`。前端调用自己的接口，由服务端函数请求 Sportsbet 页面并尝试解析赔率，以减少浏览器直接跨站请求受到 CORS 限制的问题。

接口包含错误处理：URL 缺失、非 `sportsbet.com.au`、请求失败、页面无法解析和超时都会返回 JSON 错误，不会让前端白屏。

## 导入 / 导出 JSON

- 点击 **导入 JSON** 选择比赛数组 JSON 文件。
- 点击 **导出 JSON** 下载当前数据。
- 点击 **一键备份 JSON** 下载备份文件，建议每次重要更新后使用。

## 导出 CSV

点击 **导出 CSV** 可将当前表格数据导出为 CSV，便于在 Excel / Numbers / Google Sheets 中查看。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 部署到 Vercel

1. 将仓库连接到 Vercel。
2. Framework 选择 Vite（通常可自动识别）。
3. Build Command 使用：`npm run build`。
4. Output Directory 使用：`dist`。
5. `api/sportsbet.js` 会作为 Vercel Function 部署，用于一次性手动抓取 Sportsbet 赔率快照。

> 注意：Sportsbet 页面结构、地区限制、反爬策略或网络限制可能导致抓取失败。失败时页面会保留现有赔率，用户仍可手动填写或通过 JSON/CSV 导入。
