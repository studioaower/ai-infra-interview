# AI Infra 面试练习

一个不需要构建、数据与页面分离的中文面试练习网站。覆盖 AI Infra、vLLM、SGLang、MindIE Motor、牛客面经，以及 TensorRT-LLM、量化、CUDA/GPU 基础和昇腾（Ascend）软件栈。

- 448 道题：343 道单选，105 道简答自评
- 专题分布：AI Infra 98、vLLM 98、SGLang 98、Motor 42、面经 24、TensorRT-LLM 24、量化 24、CUDA/GPU 32、昇腾 8
- 每道题都有参考回答、评分要点、通俗解析、日常类比、易错点、递进追问和核对来源
- 面向零基础：每题另有 3–5 个术语拆解、200 字以上的深入讲解，以及单选四个选项的逐项对错分析
- 固定舞台的讲义式界面：一屏一页，不滚动页面；每题按“题目 → 参考答案 → 名词拆解 → 为什么 → 再深一层 → 选项辨析 → 易错与追问 → 自评”翻页
- 每道题的讲解页都有按题目内容定制的电影感图解：左侧场景动画、右侧大字讲解
- JSON 只声明预置、数据和时间点，动画与样式在项目里；新增题目没写图解时，页面会按内容自动生成兜底场景
- 讲解页可自动播放并逐页推进，停在选项、易错与自评前；任意点击或滚动会暂停本页计时
- 字号会按本页内容多少自动调整；窄屏或高倍缩放时改为舞台内滚动，页面本身仍不滚动
- 单选选中即提交并显示解析；简答只做自评，不自动判断文字对错
- 支持 A–D / 1–4 选答案，← → / J K / PageUp PageDown 翻页，移动端左右滑动切页
- 支持专题 / 难度 / 题型筛选、搜索、错题、收藏、进度与简答草稿本地保存，并可导出/导入进度 JSON
- 题库在 `data/questions.json`，页面不硬编码题目内容

## 启动

```bash
cd infra-interview
python3 -m http.server 4180 --bind 127.0.0.1
```

打开 <http://127.0.0.1:4180>。

页面按 1600×900 的讲义舞台设计，打开后自动缩放到当前窗口。键盘操作：

- `A`–`D` 或 `1`–`4`：选择对应选项
- `←` / `→`、`J` / `K`、`PageUp` / `PageDown`：上一页 / 下一页
- `Esc`：关闭题目总览

窄屏会切换成纵向单页布局，内容在舞台内滚动，仍然不出现整页滚动。

必须通过 HTTP 打开；直接双击 `index.html` 时，浏览器会因 `file://` 的同源策略拒绝 `fetch` 题库。

## GitHub Pages

已部署：

- 练习站：<https://studioaower.github.io/ai-infra-interview/>
- Motor 图解：<https://studioaower.github.io/ai-infra-interview/motor-explained/>
- 仓库：<https://github.com/studioaower/ai-infra-interview>

仓库根目录就是静态站点，`motor-explained/index.html` 是另一份单文件课程。推送到 `main` 后，在仓库 Settings → Pages 选择 `Deploy from a branch`、分支 `main`、目录 `/ (root)` 即可。仓库里的 `.nojekyll` 会关闭 Jekyll 处理。

`motor-explained/` 是 13 章 51 页的 Motor 图解课程：明亮电影感舞台、逐字标题、自动播放并自动翻页、箭头/空格控制、手机竖屏纵向布局、左右滑动，以及 llm-d、AIBrix、Dynamo、SGLang Router、vLLM Production Stack、KServe、Mooncake、Ray Serve、Triton 的对比章节。每页带“为什么需要 / 拿掉以后会怎样”的深度卡；讲解面板里还有现场信号、代价边界和核对入口。

进度默认保存在当前浏览器同一站点的 `localStorage`。换设备或清站点数据后，可以在“题目总览 → 导出进度 / 导入进度”之间迁移；导入会按题目 `revision` 跳过版本已变化的题。

## 目录

```text
infra-interview/
├── index.html            页面骨架
├── styles.css            固定舞台的浅色讲义样式与窄屏适配
├── scene.css             图解场景、镜头运动和窄屏布局
├── scene-presets.js      13 个场景预置、时间点与自动图解
├── app.js                加载题库、筛选、答题、存储与渲染
├── quiz-core.js          可独立测试的状态、统计与题库校验
├── data/questions.json   题目与来源（唯一题库来源）
├── library/              公开资料存档与阅读笔记（Markdown）
├── motor-explained/      Motor 单文件课程
├── scripts/validate-bank.js
├── tests/quiz-core.test.js
└── package.json          只包含校验和测试命令，无运行时依赖
```

## 检查

```bash
npm run validate   # 校验题库结构、专题覆盖和答案引用
npm test           # 状态恢复、筛选、统计、校验规则测试
```

需要 Node.js 20 或更新版本。

## 题库格式

顶层是 `schemaVersion`、`updatedAt`、`sources` 和 `questions`：

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-24",
  "sources": [
    { "id": "paged", "title": "PagedAttention 原始论文", "url": "https://arxiv.org/abs/2309.06180", "kind": "paper" }
  ],
  "questions": [
    {
      "id": "vllm-001",
      "revision": 1,
      "topic": "vLLM",
      "difficulty": "基础",
      "type": "single",
      "title": "PagedAttention 解决什么",
      "prompt": "PagedAttention 的重要价值更接近哪项？",
      "tags": ["vLLM", "概念辨析"],
      "options": [
        { "id": "A", "text": "选项一" },
        { "id": "B", "text": "选项二" }
      ],
      "answer": {
        "optionId": "B",
        "reference": "参考答案",
        "keyPoints": ["要点一", "要点二", "要点三"],
        "explanation": "通俗解释",
        "analogy": "日常类比",
        "terms": [
          { "term": "术语", "plain": "面向新手的解释", "sourceId": "paged" }
        ],
        "deepDive": "带具体例子的深入讲解，220–400 字。",
        "optionNotes": {
          "A": "为什么 A 错",
          "B": "为什么 B 对",
          "C": "为什么 C 错",
          "D": "为什么 D 错"
        },
        "pitfalls": ["易错点"],
        "followUps": ["追问"]
      },
      "sourceIds": ["paged"],
      "origin": { "kind": "adapted", "note": "参考公开面试主题重新编写，不宣称企业真题。" }
    }
  ]
}
```

简答题把 `type` 改为 `short`，删除 `options`、`answer.optionId` 和 `answer.optionNotes`，保留其余解析字段（包括 `terms` 与 `deepDive`）。

### 视觉场景 `visual`（可选）

题目可以带一个 `visual` 对象。页面只认识预置名和数据，不执行题库里的代码；渲染器、动画和样式都在 `scene-presets.js` 与 `scene.css`。现在每道题都有自己的场景；新增题目如果暂时没写 `visual`，页面会按 `answer` 里的要点、术语和易错点自动生成兜底场景。

```json
"visual": {
  "preset": "kv-grid",
  "duration": 11000,
  "camera": "push",
  "headline": "逻辑连续，物理可以散",
  "data": {
    "logical": [0, 1, 2, 3],
    "physical": [7, 3, 9, 1],
    "hit": [1],
    "note": "逻辑块 1 与其他请求共享同一物理前缀块。"
  },
  "beats": [
    { "at": 0, "focus": "logical-0", "caption": "请求按固定块切分。" },
    { "at": 2600, "focus": "physical-1", "caption": "块表把逻辑块 1 指向物理块 3。" }
  ],
  "deep": {
    "preset": "compare",
    "headline": "分页省的是浪费与碎片",
    "data": {
      "left": { "kicker": "省下的", "title": "预留与碎片", "items": ["按需分配", "共享前缀"] },
      "right": { "kicker": "没省下的", "title": "块尾与查表", "items": ["块尾浪费", "块表开销"] }
    }
  }
}
```

- `preset`：`flow`、`compare`、`kv-grid`、`queue`、`orbit`、`layers`、`matrix`、`numberline`、`lanes`、`memory`、`formula`、`quote`、`option-board`。
- `duration`：场景时长，4000–20000ms；自动播放会在此基础上多等 500ms。
- `camera`：`push`、`pull`、`track`、`pan`、`tilt`、`drift`；窄屏和“减少动态效果”下自动关闭镜头运动。
- `headline`：讲解页的大标题；`headlines` 可按 `summary`、`terms`、`explain`、`deep`、`options` 分别覆盖。
- `data`：必须满足对应预置的结构。例如 `flow` 要 `nodes`，`compare` 要 `left`/`right`，`matrix` 固定 3 列，`formula` 要 `formula`；`numberline` 还可用 `bands` 标出区间。
- `beats`：`{ at, focus, caption }`。`focus` 对应渲染出的 `data-focus`，例如 `logical-0`、`physical-1`、`option-2`；省略时按场景元素每 2.2 秒自动生成。
- `deep`：只覆盖“再深一层”这一页，可换预置、数据、镜头和标题；其余字段继承顶层 `visual`。

自动播放只在带 `visual` 的题上启用，从参考答案推进到选项辨析，进入“易错与追问”或自评后停止；新增题目自动生成的场景同样适用。点击、滚动或按方向键会暂停当前页的计时，底部按钮可全局关闭。

### 新增或修改题目

1. 在 `data/questions.json` 的 `questions` 里新增记录，`id` 必须唯一；专题只能是 `AI Infra`、`vLLM`、`SGLang`、`Motor`、`面经`、`TensorRT-LLM`、`量化`、`CUDA/GPU`、`昇腾`，难度只能是 `基础`、`进阶`。
2. 新增来源时写入顶层 `sources`，再在题目的 `sourceIds` 中引用；不要只写裸链接。
3. 修改已有题目的答案或语义时，把该题 `revision` 加 1。浏览器会丢弃旧版本的作答，避免把旧答案当成新答案。
4. 更新 `updatedAt`，运行 `npm run validate` 和 `npm test`。
5. 单选必须有一个有效 `optionId`，并为每个选项写 `optionNotes`；简答不能带选项或选项讲解。每题还要有 3–5 条 `terms` 和 `deepDive`。

## 作答与统计口径

- 单选：选中选项后立即提交并进入参考答案；提交后选项锁定，可“重做本题”。
- 简答：先写自己的回答，再展开参考答案，然后选择“未掌握 / 部分掌握 / 已掌握”。这是自评，不是自动评分。
- 顶部“单选正确率”只统计已提交的单选；简答自评单独显示，两者不会混成一个准确率。
- 未提交的题不计为完成；答错或自评未掌握会进入“待复习”。
- 进度、作答、简答笔记和收藏保存在浏览器 `localStorage` 的 `infra-interview-practice-v1` 键中，不会上传。换浏览器、清除站点数据或无痕窗口不会保留。

## 公开资料存档

`library/` 里保存了编写题库时采集的公开资料索引、题目清单、讲解角度和递进追问：

- `library/README.md`：资料库索引与使用说明
- `library/cptz-vllm-sglang-series.md`：Cptz 的 60 题源码面试系列
- `library/vllm-60.md`：vLLM 60 题清单与解释角度
- `library/sglang-36.md`：SGLang 36 题清单与解释角度
- `library/nowcoder-inference.md`：牛客等公开面经中的推理岗问法
- `library/inference-themes.md`：PagedAttention、PD、投机解码、MLA 等主题总结
- `library/tensorrt-quant-cuda.md`：TensorRT-LLM、量化、CUDA/GPU 的资料与理解角度

资料库只做摘要和索引，不转载全文；每题“资料来源”仍直接链到原文。

## 来源与题目属性

每题都标了 `origin`：

- `adapted`：参考公开面试主题重新编写，并用题目引用的官方文档、论文或源码核对；不声称是某公司的真实面试题。
- `original`：基于 MindIE Motor 本地源码编写的项目练习。

来源列表共 166 条，包含 vLLM / SGLang / TensorRT-LLM / 昇腾 CANN 官方文档与论文、Hugging Face 与 NVIDIA 文档、公开面试题主题页、牛客面经，以及 MindIE Motor 的 GitCode 仓库文件。题目优先引用官方文档、原始论文和可核对源码；技术结论以题目列出的核对入口为准，性能和兼容性判断不应脱离具体版本与部署条件。

## 浏览器

使用原生 ES modules、`fetch`、`localStorage` 和 CSS `:has()`，面向近年的 Chrome、Safari、Firefox 和 Edge。页面不依赖外部字体、脚本或样式，可离线通过本地 HTTP 服务使用。
