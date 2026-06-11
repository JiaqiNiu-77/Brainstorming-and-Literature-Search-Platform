# 家电技术创新关键词发散工具

面向家电专家的技术创新发散与文献、专利检索辅助原型。用户输入任意家电技术问题后，系统按物理机制、材料、结构、智能控制、用户痛点、相邻领域、评价指标和产品机会生成聚合分组气泡图，并根据探索路径生成检索策略。

未配置 API Key 时，系统自动使用本地 mock 模式，所有主要交互仍可正常演示。

## 文件结构

```text
.
├── index.html      # 单页前端、聚合气泡图与交互
├── innovation.html # 独立创新引导页面
├── server.js       # Express 服务、AI 调用、JSON 容错与 mock 回退
├── package.json    # 项目依赖与启动命令
├── .env.example    # 环境变量示例
└── README.md
```

## 安装与启动

需要 Node.js 18 或更高版本。

```bash
npm install
npm start
```

然后访问 [http://localhost:3000](http://localhost:3000)。

不要直接双击 `index.html` 使用真实接口；浏览器的 `file://` 页面无法稳定调用 Express API。

## 便携运行

便携压缩包包含 `node_modules` 和双击启动脚本，复制到其他电脑后无需再次执行 `npm install`：

- macOS：双击 `start-mac.command`
- Windows：双击 `start-windows.bat`

目标电脑仍需安装 Node.js 18 或更高版本。便携包不会包含 `.env` 或 API Key，未配置 Key 时自动使用 Mock 模式。

## 一键部署上线

项目已包含 `render.yaml` 和 `Dockerfile`，推荐使用 Render Blueprint 部署。上线后所有电脑直接访问同一个网址，不需要分别安装 Node.js 或配置环境。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/JiaqiNiu-77/Brainstorming-and-Literature-Search-Platform)

首次部署步骤：

1. 将项目上传到 GitHub，确认不要上传 `.env`。
2. 登录 Render，选择 **New > Blueprint**。
3. 连接该 GitHub 仓库，Render 会自动读取 `render.yaml`。
4. 在首次部署页面为 `AI_API_KEY` 填写密钥，然后点击部署。
5. 部署完成后，Render 会提供公开 HTTPS 网址。

之后每次推送 GitHub，Render 会自动重新部署。若不填写 `AI_API_KEY`，线上版本仍可使用 Mock 模式。

API Key 属于服务端密钥，任何安全的云部署平台都需要首次配置一次；不能写入公开代码或一键部署链接中。

也可以使用 Docker 部署到其他支持容器的平台：

```bash
docker build -t appliance-keyword-tool .
docker run -p 3000:3000 --env-file .env appliance-keyword-tool
```

## 配置 AI 模式

复制环境变量示例并填写 API Key：

```bash
cp .env.example .env
```

```dotenv
PORT=3000
AI_API_KEY=your_api_key
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_MODEL=qwen-turbo
```

重新运行 `npm start`。页面右上角会显示当前模式。

- 未设置 `AI_API_KEY`：始终使用本地 mock。
- 已设置 `AI_API_KEY`：调用兼容 OpenAI Chat Completions 的接口。
- AI 请求失败或返回格式异常：后端自动回退到 mock，前端保持可用。

默认配置使用阿里云百炼的 `qwen-turbo` 模型。免费额度和计费规则以百炼控制台显示为准。

API Key 只应写入本地 `.env`。`.env` 已加入 `.gitignore`，不要将其提交到版本库或放入前端代码。

## Prompt 与输出稳定性

- `/api/expand-keywords` 使用跨学科家电技术创新 Prompt，覆盖物理机制、材料、结构、控制、用户痛点、相邻领域、评价指标和产品机会。
- `/api/generate-search-query` 使用家电文献与专利检索 Prompt，生成中英文关键词、三类文献检索式、专利检索式、数据库建议和研究方向。
- 发散接口使用 `temperature=0.7`，检索接口使用 `temperature=0.4`。
- 默认关闭模型思考模式，以缩短交互等待时间。
- 后端会清理 Markdown JSON 代码块、补齐缺失字段、修复非法关键词类型，并在解析或 API 调用失败时自动回退到 mock。

## 使用方法

1. 输入任意家电技术问题及可选研究领域。
2. 点击“生成关键词地图”。
3. 点击彩色相关气泡继续发散。
4. 悬停气泡并点击右上角星标锁定关键词。
5. 点击历史路径节点或“返回上一步”恢复之前的探索节点。
6. 使用“重新生成”刷新当前节点，使用“清空路径”回到原始问题。
7. 点击“生成文献与专利检索式”查看完整检索策略，并可复制每条检索式。

气泡使用八类低饱和颜色区分关键词类型。接口不可用时，前端也会自动切换到通用家电 mock 数据。

气泡图采用紧密圆形碰撞打包布局：当前相关关键词使用分类颜色高亮，外围上下文词使用灰色填充空隙。点击彩色气泡后，该气泡会平滑移动并放大为新的中心词，随后新一轮关键词从中心周围扩散出现。

分类会随探索深度自动切换：

- 第 1-2 层：按物理机制、材料、结构、控制、用户痛点、相邻领域、评价指标和产品机会进行多维发散。
- 第 3 层及以后：按“已有技术”和“近一年创新技术”分类，聚焦具体技术细节和成熟度。

“近一年创新技术”用于生成值得重点检索的新方向，不代表系统已经核验具体论文、专利或发布日期；正式研究时仍需在推荐数据库中验证。

## 创新引导工作流

创新引导已拆分为独立页面。用户可在关键词探索与文献检索页点击顶部“创新引导”进入，探索路径与锁定关键词会自动带入；返回检索页时，原有探索状态会继续保留。

工具不会把“创新”理解为随机联想，而是引导用户完成：

1. 选择创新目标，例如突破性能上限、降低成本、解决痛点或跨领域迁移。
2. 从不同路径锁定 2-3 个可能产生协同作用的技术关键词。
3. 自动形成技术组合假设。
4. 生成创新方案卡，说明组合逻辑、潜在新颖性和关键工程风险。
5. 在独立创新引导页使用 `novelty_query` 检索该技术组合是否已有论文或专利公开。
6. 在独立创新引导页使用 `innovative_query` 在相邻领域寻找可迁移机制；主页使用 `patent_query` 排查已有专利。

创新方案只是待验证假设。是否真正新颖，需要结合论文、专利、工程实验和商业约束进一步确认。

## 概念关系、评分与多源融合

- “关系网络”是默认主视图，以中心主题、类型分支和方形关键词卡片组成思维导图；支持点击居中、锁定、悬停说明和路径返回。
- 左上角类型图例可点击筛选，只显示所选技术方向；点击“全部方向”恢复完整思维导图。
- 每个关键词包含 `parent` 和 `relation`，悬停详情卡优先展示约 100 字的针对性名词解释，包括定义、原理、作用与适用边界。
- 每个关键词包含 0-100 的创新度、检索价值和行业关注度 **AI 估算分数**。这些分数仅用于相对排序，并非真实文献、专利或行业统计数据；聚合气泡大小由三项 AI 估算分数综合决定。
- Prompt 会根据探索深度自适应：初期广覆盖，中期建立父子/依赖关系，深层聚焦具体机制、参数、部件、算法和实施路线。
- 配置 `KEYWORD_RETRIEVAL_URL` 后，可将文献/专利 embedding 检索候选与主模型结果融合。
- 配置 `SECONDARY_AI_API_KEY`、`SECONDARY_AI_BASE_URL` 和 `SECONDARY_AI_MODEL` 后，可将第二个 OpenAI-compatible 生成模型的候选词加入融合与去重流程。

## 后端接口

### `POST /api/expand-keywords`

输入原始问题、当前中心词、路径、锁定关键词和领域，返回最多 30 个结构化下一层关键词。结果不足 30 个时按实际数量展示，不使用通用词补足。

### `POST /api/generate-search-query`

输入原始问题、探索路径和锁定关键词，返回中英文关键词、四类 Boolean 检索式、相邻领域、数据库建议和研究方向。

### `GET /api/health`

返回服务状态和当前运行模式。

## 替换 AI 模型

修改 `.env` 中的：

```dotenv
AI_BASE_URL=https://your-compatible-provider.example/v1
AI_MODEL=your-model-name
```

当前 `server.js` 使用 `/chat/completions`、Bearer Token 和 JSON Object 输出格式。接入不兼容该协议的模型时，只需替换 `callAI()`，保留 `normalizeExpansion()` 与 `normalizeSearchQuery()` 即可继续使用现有容错层。

## 扩展关键词类型

需要同步修改三处：

1. `server.js` 中的 `VALID_TYPES` 和 `TYPE_DEFAULTS`。
2. `index.html` 中的 `TYPES`，为新类型添加中文名称与颜色。
3. 两个 system prompt 中关于类型和输出结构的说明。

## 连接文献数据库 API

建议在后端增加独立路由，不要由前端直接保存密钥。例如：

```text
GET /api/literature/search?database=openalex&query=...
GET /api/patents/search?database=lens&query=...
```

可以接入 OpenAlex、Semantic Scholar、Crossref 等公开 API；Web of Science、Scopus、Lens Patent 等服务通常需要机构权限或单独 API Key。应在服务端完成鉴权、速率限制、结果字段归一化与缓存，再将统一 JSON 返回给前端。
