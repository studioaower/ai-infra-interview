# Cptz：vLLM / SGLang 源码面试题系列

来源：

- 系列总索引：https://cptz.space/posts/vllm-sglang-interview-series/
- Level 1 推理服务基础：https://cptz.space/posts/vllm-sglang-interview-level-1-foundations/
- Level 3 调度、准入与资源预算：https://blog.cptz.space/posts/vllm-sglang-interview-level-3-scheduling/
- 源码与实验：https://cptz.space/posts/vllm-sglang-interview-source-labs/

这份系列的写法值得保留的地方：每题不是只给结论，而是按“现象 → 机制 → 代码位置 → 实验/边界 → 递进追问”展开。以下按 Level 记录主题和可复用的追问方式。

## Level 1：推理服务基础（Q1–10）

主题：Prefill/Decode、在线指标、batching、采样、并行、基础容量分析。

值得保留的解释角度：

- 先问“这一步的并行度来自哪里”。Prefill 的并行度来自输入长度；Decode 单请求的并行度只有 1，通常要靠 batch 把并行度补回来。
- 指标要固定起点和终点：TTFT 是排队 + Prefill + 首 token 出口；ITL/TPOT 是相邻输出 token 的间隔；E2E 还包含网络和客户端渲染。
- 容量分析先算单 token KV，再乘序列长度和并发，最后用显存统计校准；不要只背“7B 模型需要多少显存”。

可继续追问：

1. 长上下文 Prefill 为什么也可能被带宽拖住？
2. Decode batch 增大后，瓶颈为什么会从带宽移回算力？
3. 客户端 TTFT 与服务端 TTFT 的差值包含哪些环节？

## Level 2：请求生命周期与模块契约（Q11–20）

主题：HTTP → tokenizer → scheduler → GPU → detokenizer → SSE；IPC；状态所有权；取消；异步边界。

值得保留的解释角度：

- 把“请求状态”拆成所有权：谁持有 token 序列、谁持有 KV 块、谁负责在取消时释放。
- 取消不是关掉 HTTP 连接就结束：后台可能还有 Prefill、KV 传输和调度记账。
- 异步边界上最容易出错的是“回调到达时对象已经被释放”，所以要有 attempt 级身份和幂等清理。

可继续追问：

1. 客户端断开后，服务端如何知道要停止生成？
2. 取消和正常完成同时到达，怎样避免重复释放？
3. 流式响应在哪个阶段提交 HTTP 状态码？

## Level 3：调度、准入与资源预算（Q21–30）

主题：continuous batching、token budget、chunked prefill、公平性、背压。

值得保留的解释角度：

- vLLM V1 用统一的 token budget 管理本轮能放多少 token，而不是把 Prefill/Decode 完全分成两套状态。
- Chunked prefill 改善的是 Decode 的等待时间，不是减少总计算量；chunk 太小会增加调度和 kernel 开销。
- 准入控制要同时看 KV 空间、batch token 上限和等待队列；只看其中一个会把压力推到另一个瓶颈。

可继续追问：

1. token budget 给 Decode 预留多少？预留多了/少了分别怎样？
2. 长 Prefill 与短 Decode 混排时，怎样避免 Decode 的 ITL 尖峰？
3. 队列满时是拒绝、排队还是降级？依据是什么 SLO？

## Level 4：KV Cache 与 GPU 执行（Q31–40）

主题：Paged KV、Radix Cache、Beam Search、slot mapping、attention backend、显存。

值得保留的解释角度：

- PagedAttention 解决的是 KV 的碎片和共享问题，不减少 attention 的计算量。
- Radix Cache 用前缀树组织相同前缀，收益来自多轮对话、系统提示词和 RAG 公共文档；维护树和引用计数也有成本。
- Beam Search 会让多条候选共享前缀，KV 的引用计数和块复制要正确处理。

可继续追问：

1. 前缀命中的单位是什么？不足一个块的前缀能否命中？
2. 请求结束后 KV 为什么可能还被引用？
3. 更换 attention backend 会改变哪些布局和 kernel 选择？

## Level 5：高级优化、分布式与性能诊断（Q41–50）

主题：投机解码、CUDA Graph、TP/EP、P/D 分离、量化、benchmark。

值得保留的解释角度：

- 投机解码的收益 = 接受长度带来的串行步数下降 − 草稿模型和验证的额外开销；只看接受率不够。
- CUDA Graph 省的是 CPU launch 开销，动态 shape、控制流和 capture 失败会让它不生效。
- P/D 分离的收益来自瓶颈解耦，代价是 KV 传输和配对逻辑；短 prompt、低并发时可能不划算。
- 量化要同时看显存、带宽、kernel 支持和精度回退，不是“位数越低越快”。

可继续追问：

1. 什么负载下投机解码会负优化？
2. CUDA Graph 与 torch.compile 分别解决哪一层的问题？
3. P/D 分离后，KV 传输时间如何估算？什么情况下不如重算？

## Level 6：Staff 级系统设计（Q51–60）

主题：SLO、容量、故障恢复、正确性不变量、扩展点、演进路线。

值得保留的解释角度：

- 系统设计先写不变量：请求不丢、token 不乱序、取消可收敛、缓存不返回脏数据。
- 再写故障模型：实例挂、KV 传输失败、缓存节点故障、版本升级回滚。
- 最后才谈扩容和成本；没有 SLO 和故障模型，吞吐数字没有意义。

可继续追问：

1. 模型/引擎不停服升级时，旧请求和新请求如何隔离？
2. 缓存节点故障后，命中率下降会怎样传导到 TTFT 和容量？
3. 如何证明一次优化没有用正确性换性能？

## 版本提醒

系列文章里的版本号、默认值和单卡实验数字只代表写作时的环境。题库引用时只保留机制和边界，不把具体数字当成普遍结论。
