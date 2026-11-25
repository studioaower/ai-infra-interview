# 推理框架高频主题：PagedAttention、PD、投机解码、MLA

来源：

- AI 面试八股文：大模型推理框架面试题 vLLM / SGLang / TensorRT-LLM  
  https://developer.aliyun.com/article/1772295
- vLLM 与 SGLang 源码面试题：17 个 AI Infra 高频问题  
  https://hd9568.github.io/blog/vllm-sglang-infra-interview-questions/
- ai-interview-guide：大厂面试题与推理优化  
  https://github.com/guocong-bincai/ai-interview-guide/tree/main/docs/18-big-tech-interview-questions

## PagedAttention

- 要解决的问题：传统 KV 预留按最大长度分配，序列长度未知，造成大量内部/外部碎片。
- 做法：把 KV 切成固定大小的 block，用 block table 把逻辑位置映射到物理块；块可以不连续。
- 收益：降低碎片、提高 KV 池利用率、支持块级共享和引用计数。
- 边界：它不减少 attention 的计算量；块太小会增加查表和访存开销；前缀命中还要求块对齐和缓存 key 一致。
- 递进追问：块大小怎么选？请求结束后块为什么可能不立即释放？prefix cache 的引用计数怎么维护？

## Continuous Batching

- 要解决的问题：静态 batching 要等整批请求都结束才能换下一批，短请求被长请求拖住。
- 做法：每个 Decode step 都重新决定这一轮参加哪些请求，完成的请求立刻退出，新请求可以补进来。
- 收益：提高 GPU 利用率、降低短请求等待。
- 边界：不减少单 token 的计算量；会引入更复杂的调度、公平性和抢占问题。
- 递进追问：token budget 怎么定？长 Prefill 会不会拖慢 Decode？优先级和抢占怎么处理？

## PD 分离（Prefill / Decode Disaggregation）

- 动机：Prefill 更偏计算密集，Decode 更偏访存密集；混跑时长 Prefill 会打断 Decode 的节奏，两阶段也不好独立扩容。
- 收益：两阶段各自选型、扩容和调优；隔离长 Prefill 对 ITL 的干扰。
- 代价：KV 要从 P 传到 D，多一次传输、配对和失败处理；短 prompt、低并发时传输开销可能盖过收益。
- 边界：不是“分离就一定更快”；KV 传输时间、链路带宽、P/D 比例、故障恢复都要算。
- 递进追问：P 和 D 的 TP 不同，KV 怎么传？传输失败怎么回滚？P/D 比例怎么定？

## 投机解码（Speculative Decoding）

- 动机：Decode 每步只生成一个 token，串行步数多，GPU 算力利用不足。
- 做法：草稿模型/草稿方法先猜多个 token，主模型一次前向并行验证；接受的 token 保留，第一个不匹配之后丢弃。
- 收益：减少串行步数，而不是减少总计算量；小 batch、草稿质量高时更明显。
- 成本：草稿模型占显存和算力；接受率低时大部分草稿白跑；大 batch 时多算的位置不再“免费”。
- 度量：不要只看接受率，要看接受长度、草稿开销、TPOT、额外显存和端到端 goodput。
- 递进追问：温度/采样参数怎么处理？草稿长度怎么选？大 batch 下为什么可能负优化？

## MLA（Multi-head Latent Attention）

- 与 MHA/GQA 的区别：MLA 把 KV 压缩成低维 latent，再用投影恢复；目标是降低 KV 显存和带宽。
- 工程影响：KV 布局、吸收（absorb）方式、位置编码（如 RoPE 解耦）和 attention kernel 都要适配；不能直接套 GQA 的公式。
- 边界：压缩率、精度、kernel 支持和并行切分都会影响实际收益。
- 递进追问：MLA 的 latent 能直接喂标准 attention kernel 吗？RoPE 为什么要解耦？TP 后 latent 怎么切？

## 共通面试方法

1. 先定义指标和起点：TTFT、ITL/TPOT、E2E、goodput。
2. 再定位瓶颈：算力、带宽、CPU、通信、调度、缓存。
3. 然后给优化：PagedAttention / batching / chunked prefill / 量化 / 投机 / PD。
4. 最后说代价和边界：额外显存、通信、复杂度、正确性风险。
5. 用 profiling 和固定条件的 benchmark 验证，不用“感觉更快”。

## 数字与版本提醒

公开文章里的加速比、碎片率、显存节省比例通常来自特定模型、卡型和版本。题库只把它们当量级线索，不写成普遍定律；需要数字时，按当前环境的公式和实测重新算。
