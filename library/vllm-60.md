# vLLM 专项：60 道面试题清单

来源：https://cmcai0104.github.io/llm-infer-learning/08-career/implementations/vllm/questions.html

原站按 A–F 分组，每题有参考回答，适合按主题刷。这里保留题目清单和值得回看的解释角度；具体答案请回原文和官方文档核对。

## A. 模型、显存与指标

1. Prefill 和 Decode 有什么区别？
2. KV Cache 到底节省了什么？
3. 为什么通常缓存 K/V，不把历史 Q 一起保存？
4. 怎么估算 KV 显存？
5. MHA、MQA、GQA 的区别及推理意义？
6. 模型权重能放进 GPU，为什么仍然 OOM？
7. TTFT、ITL、TPOT 怎么区分？
8. 为什么吞吐提高不代表服务变好？

解释角度：缓存 Q 没有复用价值，因为每一步的 Q 只对当前 token 使用；K/V 会被后续所有 token 读取。权重放得下仍 OOM，通常要查激活、工作区、KV 池、碎片和峰值。

## B. vLLM 引擎与调度

9. vLLM 的核心价值是什么？
10. V1 的主要组件如何协作？
11. Continuous Batching 与传统动态 batching 有何不同？
12. V1 调度器为什么用 token budget？
13. Chunked Prefill 为什么能改善 Decode 延迟？
14. max_num_batched_tokens、max_num_seqs、max_model_len 有什么区别？
15. PagedAttention 为什么能改善吞吐？
16. KV 不足时抢占为什么会有代价？
17. 请求结束后 KV 为什么可能还占着内存？
18. 怎么安全取消正在运行的请求？

解释角度：token budget 是“这一轮总共能算多少 token”的统一预算；chunked prefill 把长输入拆成多轮，让 Decode 不必等一整段 Prefill；抢占的代价来自重算或换入换出。

## C. GPU、kernel 与执行优化

19. 如何区分计算受限和带宽受限？
20. FlashAttention 与 PagedAttention 是同一类优化吗？
21. CUDA Graph 和 torch.compile 分别做什么？
22. 为什么更多异步 stream 不一定更快？
23. 怎么定位 CPU 开销限制 GPU 的情况？
24. 量化为什么可能更省显存但更慢？
25. 投机解码如何在保持目标分布的同时加速？
26. 优化一个 RMSNorm/Triton kernel 应该怎么做？

解释角度：FlashAttention 优化 attention 内部的数据搬运和显存占用；PagedAttention 优化 KV 的存储与共享，两者不是同一层。CUDA Graph 省 launch 开销，torch.compile 省图优化和 kernel 融合，不能互相替代。

## D. 并行与分布式推理

27. TP、PP、DP、EP 怎么选？
28. 为什么 TP 增大后延迟可能变高？
29. 模型单卡能放下，为什么仍可能用 TP？何时用副本？
30. TP 后 KV 显存是不是除以 TP 数？
31. All-Reduce、All-Gather、Reduce-Scatter、All-to-All 的区别？
32. MoE 为什么可能通信比计算更难优化？
33. PD 分离的价值和代价是什么？
34. P 和 D 的 TP 不同，可以直接传 KV 吗？

解释角度：TP 切的是层内张量和 KV 头，单卡 KV 份额通常下降，但通信增加；P/D 的 TP 布局不同时，KV 需要重排或转换，不能假设直接 memcpy。

## E. KV Cache、LMCache 与 Mooncake

35. 跨请求 Prefix Cache 为什么需要前序 hash？
36. 温度、top-p 要放进 KV key 吗？
37. KV block 的 ref_cnt=0 是否意味着缓存失效？
38. vLLM 本地 APC、LMCache、Mooncake 分别做什么？
39. MooncakeConnector 和 MooncakeStoreConnector 有什么区别？
40. vLLM 直接接 Mooncake 与经过 LMCache，有何取舍？
41. LMCache MP 为什么要独立进程？
42. LMCache chunk 与 vLLM block 必须相同吗？
43. 什么时候取回 KV 比重算更快？
44. 命中率提高，TTFT 却变差，怎么排查？
45. lookup 命中为什么不代表可立即执行？
46. 异步传输时最容易出现的生命周期错误是什么？
47. Mooncake Store 的 Master 会转发所有 KV 数据吗？
48. RDMA、GPUDirect RDMA 与零拷贝如何理解？
49. CacheBlend 为什么不能等同于精确前缀缓存？
50. 外部 KV Store 宕机后如何回退？

解释角度：链式 hash 让相同前缀得到相同 key；采样参数通常不影响 KV，但会影响输出，是否进 key 取决于缓存语义。命中只是“索引里有”，还要等传输完成、空间可用、布局兼容才能执行。

## F. 系统设计、性能诊断与工程实践

51. 怎样设计一个同时支持长文档与短对话的服务？
52. 缓存感知路由是不是优先去命中最多的实例？
53. P99 TTFT 上升但 ITL 基本稳定，可能是什么原因？
54. ITL 出现周期性尖峰，怎么查？
55. 为什么固定并发与固定到达率压测结果不同？
56. 怎么避免 benchmark 得出虚假结论？
57. 如何估算服务容量与成本？
58. 缓存共享有哪些正确性和隔离风险？
59. 如果要求实现一个 KV 缓存组件，你会先实现什么？
60. 怎样讲一个有说服力的推理优化项目？

解释角度：固定并发会随着服务变慢自动降低到达率，掩盖排队；固定到达率更接近真实流量。容量估算要同时看 TTFT SLO、ITL SLO、KV 池和 goodput，不能只看峰值吞吐。

## 四个计算练习

- 32 层、8 个 KV heads、head dim 128、BF16，8192 token 的 KV 是多少？
- 1 GiB KV 经 400 Gbit/s 链路，理想传输时间是多少？
- TTFT=0.2s，输出 101 个 token，TPOT=0.01s，E2E 约多少？
- token budget=8，两条 Decode 各占 1 token，长 Prefill 本轮最多能占多少？

计算题的价值在于把“公式”落到单位：字节、bit/s、token 数不要混。
