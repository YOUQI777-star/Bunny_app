# Cloudflare Pages 部署指南

本项目是 React + Vite SPA，推荐使用 **Cloudflare Pages**（静态托管，无需 Workers）。

## 为什么选 Cloudflare Pages 而非 Workers

- 本项目无服务端逻辑（后端是 Supabase），只需静态文件托管
- Cloudflare Pages 在全球（含中国大陆边缘节点）有更好的访问速度
- 比 Vercel 对中国大陆访问更稳定

---

## 方法一：通过 Cloudflare Dashboard（推荐首次部署）

### 1. 构建项目

```bash
npm run build
# 产物在 dist/ 目录
```

### 2. 登录 Cloudflare Dashboard

前往 https://dash.cloudflare.com → Pages → Create a project

### 3. 连接 GitHub 仓库

- 选择 `Bunny_app` 仓库
- Framework preset: **Vite**
- Build command: `npm run build`
- Build output directory: `dist`

### 4. 配置环境变量

在 Pages 项目 → Settings → Environment variables 中添加：

| 变量名 | 值 |
|--------|-----|
| `VITE_SUPABASE_URL` | 你的 Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | 你的 Supabase anon key |
| `VITE_OPENAI_API_KEY` | 你的 OpenAI API key |

> ⚠️ 注意：Cloudflare Pages 的环境变量需要在 Production 和 Preview 分别配置。

### 5. SPA 路由支持

项目已在 `public/_redirects` 中添加：
```
/* /index.html 200
```
Cloudflare Pages 会自动处理，直达链接（如 `/share/xxx`）不会返回 404。

---

## 方法二：通过 Wrangler CLI

```bash
# 安装 wrangler
npm install -g wrangler

# 登录
wrangler login

# 构建
npm run build

# 部署到 Cloudflare Pages
wrangler pages deploy dist --project-name bunny-app
```

首次运行会提示创建新项目，之后每次运行会推送到同一项目。

---

## 自定义域名

在 Cloudflare Pages 项目 → Custom domains → Add a custom domain，绑定你的域名即可（需要域名托管在 Cloudflare DNS）。

---

## 从 Vercel 迁移注意事项

- Vercel 的 `vercel.json` 中的 rewrites 规则，已由 `public/_redirects` 替代
- 环境变量需要重新在 Cloudflare Pages 配置（不会自动迁移）
- 如果之前在 Vercel 设置了自定义域名，需要将 DNS 指向 Cloudflare Pages

---

## 本地验证部署产物

```bash
npm run build
npm run preview
# 访问 http://localhost:4173 验证构建产物是否正常
```
