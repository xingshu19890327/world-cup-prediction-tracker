# 项目说明（给 Claude Code）

这是一个**单文件静态网页**：`index.html`。
- 完全自包含：HTML / CSS / JS、48 面国旗（base64 内嵌）全部写在这一个文件里。
- **没有构建步骤、没有依赖、没有后端**。直接当静态文件托管即可。
- 入口文件就是 `index.html`，不要改名（静态托管默认找它）。

## 我最常让你做的事：把它发布到网上

默认用 **GitHub Pages**。请按下面流程执行（每一步先确认我已登录对应账号）：

1. 在当前文件夹执行：`git init`、`git add .`、`git commit -m "publish bracket"`。
2. 用 GitHub CLI 创建仓库并推送，例如：
   `gh repo create wc2026-bracket --public --source=. --push`
   （如果没装 `gh`，改为提示我在 github.com 手动建仓库，再 `git remote add origin ...` + `git push -u origin main`。）
3. 开启 Pages：仓库 Settings → Pages → Source 选 `main` 分支、根目录 `/`。
   （能用 `gh` API 自动开启就自动开，不能就把手动步骤列给我。）
4. 等 1–2 分钟，把最终网址（形如 `https://<用户名>.github.io/wc2026-bracket/`）发给我。

### 备选托管（任选其一，我指定时再用）
- **Netlify**：`npx netlify deploy --prod --dir .`
- **Vercel**：`npx vercel --prod`
- **Cloudflare Pages**：`npx wrangler pages deploy .`

## 改动须知
- “更新比分/赛果/默认对阵”时：真实小组排名写在 `index.html` 里的 `REAL_RANK` 和 `REAL_THIRD` 两个常量，改完 `DATA_VERSION` 记得 +1（旧存档会自动迁移、保留用户填的比分与晋级）。
- 不要破坏淘汰赛联动、比分面板、国旗、缩放/字号/存档等现有功能；改完最好用浏览器打开 `index.html` 自查一遍。
- “存档”用浏览器 localStorage，按域名+浏览器隔离，属正常现象，不要试图改成跨设备同步（除非我明确要求加后端）。
