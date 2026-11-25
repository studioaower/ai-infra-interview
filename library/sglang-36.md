# SGLang 专项：36 道面试题清单

来源：https://cmcai0104.github.io/llm-infer-learning/08-career/implementations/sglang/questions.html

## 一、推理与执行基础

1. Prefill 与 Decode 有什么区别？
2. Decode 为什么经常受带宽限制？
3. 为什么缓存 K/V，通常不缓存 Q？
4. 如何估算 KV 显存？
5. FlashAttention 为什么快？
6. PagedAttention 与 RadixAttention 有什么区别？
7. Continuous batching 的收益是什么？
8. Chunked prefill 越小越好吗？
9. 重叠调度能消除自回归依赖吗？
10. CUDA Graph 为什么可能不加速？
11. 为什么 Radix 节点需要拆分？
12. 请求结束为什么不立即释放所有 KV？

值得回看的解释：

- RadixAttention 用前缀树复用相同 token 前缀，PagedAttention 更像分页的 KV 块管理；两者可以同时存在，不是替代关系。
- 请求结束后 KV 可能还被其他请求引用，或者还在缓存里等待复用，所以不能立刻全部释放。
- 重叠调度只能把 CPU 准备、通信等工作和 GPU 计算重叠，不能消除“第 n+1 个 token 依赖第 n 个 token”的自回归依赖。

## 二、KV 正确性与分层缓存

13. 文本相同是否一定能命中？
14. 完整 Prompt 命中后是否完全不用计算？
15. 分布式缓存 key 应包含什么？
16. RAG 文档块能否放在任意位置复用 KV？
17. GQA 为什么减少 KV？
18. MLA 能直接套 GQA 的公式吗？
19. Mamba 缓存与普通 KV 有何区别？
20. KV FP8 一定更快吗？
21. HiCache 如何提高复用？
22. 同机两个 SGLang 实例共享 HiCache L2 吗？
23. Mooncake Transfer Engine 与 Store 有何区别？
24. LMCache 与 Mooncake 是竞争关系吗？

值得回看的解释：

- 文本相同不一定命中：模型版本、tokenizer、模板、位置编码和缓存 key 都可能不同。
- 完整 prompt 命中后通常仍要算最后一个 token 的 logits 和采样，不能把“命中”理解成整个请求零计算。
- RAG 文档块只有在 token 序列中的位置和前缀关系一致时才能复用；位置变了，位置编码和 attention 结果都可能变。
- MLA 的 latent 表示和 GQA 的 KV 头结构不同，不能直接套 GQA 的显存公式，还要看引擎是否支持吸收/解耦。

## 三、系统、性能与工程判断

25. 当前 SGLang 能同时开 HiCache 与 LMCache 吗？
26. 命中率提高，TTFT 为什么变差？
27. 200 Gb/s 传 1 GiB 至少多久？
28. 什么情况下适合 PD 分离？
29. 缓存节点故障怎么办？
30. 异步回写有哪些正确性风险？
31. TP 与服务副本 DP 如何选择？
32. MoE 激活参数少，为什么可能仍然慢？
33. GPU 利用率低如何排查？
34. 开缓存后输出错误如何定位？
35. SGLang 一定比 vLLM 快吗？
36. 如何设计长上下文 RAG 推理集群？

值得回看的解释：

- 命中率提高但 TTFT 变差，常见原因是缓存查询/传输本身有开销，或者命中的远端 KV 要等网络，反而不如本地重算。
- 200 Gb/s 传 1 GiB 的理想时间约为 1×8/200 秒 ≈ 0.04 秒，实际还要加上协议、拥塞、拷贝和握手开销。
- SGLang 不一定比 vLLM 快；负载形态、模型、版本、并行配置和调参都会改变结论，必须固定条件做端到端测量。
- 缓存后输出错误，先查 key 是否漏了模型/模板/位置等身份，再查 KV 布局、dtype 和异步回写是否完成。

## 版本提醒

HiCache、LMCache、Mooncake 的集成方式和默认行为随版本变化很快；题目里只保留机制，不把某个版本的开关当成普遍事实。
