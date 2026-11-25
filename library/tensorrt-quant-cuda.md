# TensorRT-LLM、量化、CUDA/GPU 资料索引

新增三个专题时主要核对的一手资料。题库只做摘要和改写，不转载全文；每题的“资料来源”仍直接链到原文。

## TensorRT-LLM

- 官方文档：https://nvidia.github.io/TensorRT-LLM/
- 源码仓库：https://github.com/NVIDIA/TensorRT-LLM
- 量化：https://nvidia.github.io/TensorRT-LLM/features/quantization.html
- GPT Attention 与批处理：https://nvidia.github.io/TensorRT-LLM/advanced/gpt-attention.html

值得保留的理解角度：

- **build 与 runtime 分离**：build 阶段把模型编译成 engine，决定 kernel、精度、并行和最大 shape；runtime 只负责按配置加载和执行。engine 通常与 GPU 架构、TensorRT-LLM 版本和插件强相关，不能假设跨架构直接复用。
- **静态批 vs in-flight batching**：静态批要等整批结束；in-flight batching 每个 step 重新组批，完成的请求退出、新请求补入。它解决利用率，不减少单 token 计算。
- **paged KV 与块表**：KV 按块管理，逻辑位置通过块表映射到物理块；块大小影响碎片、查表开销和前缀共享粒度。
- **CUDA Graph**：把固定形状的计算图录制后回放，减少 launch 开销；动态 shape、控制流或未覆盖的 batch 形状可能回退到普通执行。
- **版本边界**：文档里的默认值、支持的量化格式、并行策略随版本变化很快；题目只用“通常/取决于版本”描述机制，不把某个版本的开关当成普遍事实。

## 量化

- Hugging Face 量化总览：https://huggingface.co/docs/transformers/main/en/quantization/overview
- vLLM 量化支持：https://docs.vllm.ai/en/latest/features/quantization/index.html
- GPTQ：https://arxiv.org/abs/2210.17323
- AWQ：https://arxiv.org/abs/2306.00978
- SmoothQuant：https://arxiv.org/abs/2211.10438
- FP8 格式：https://arxiv.org/abs/2209.05433

值得保留的理解角度：

- **weight-only 与 W8A8**：只压权重主要省显存和权重带宽，激活仍是高精度；W8A8 同时压激活，需要校准和处理离群值，收益更依赖 kernel 与硬件。
- **PTQ 与 QAT**：PTQ 用校准集估计范围，成本低；QAT 在训练中模拟量化，精度通常更好但成本高。推理部署多数先尝试 PTQ。
- **GPTQ / AWQ / SmoothQuant 的分工**：GPTQ 用二阶信息逐层补偿权重量化误差；AWQ 保护对激活重要的权重通道；SmoothQuant 把激活离群值部分迁移到权重，使 W8A8 更可行。三者不是同一层面的替代关系。
- **group size 与粒度**：group 越小，缩放因子越细，精度通常更好但元数据和 kernel 开销更高；per-channel 也不等于免费。
- **量化不一定更快**：如果瓶颈在 KV 读取、调度或通信，或者量化 kernel 没有被目标硬件高效支持，端到端可能不变甚至变慢。要用固定输入分布做 TTFT、TPOT、吞吐和精度对比。
- **KV Cache 量化**：省显存和 KV 带宽，但会影响长上下文精度；要单独评估，不能只看权重精度。

## CUDA / GPU 基础

- CUDA C++ Programming Guide：https://docs.nvidia.com/cuda/cuda-programming-guide/
- CUDA C++ Best Practices Guide：https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/
- PTX ISA：https://docs.nvidia.com/cuda/parallel-thread-execution/
- Nsight Systems：https://docs.nvidia.com/nsight-systems/
- Roofline 模型：https://arxiv.org/abs/2009.02449

值得保留的理解角度：

- **执行模型**：grid → block → warp → thread；一个 warp 通常 32 个线程，分支分歧会让同一 warp 的不同路径串行执行。
- **内存层级**：寄存器、shared memory、L1/L2、global memory、host memory。越靠近 SM 容量越小、带宽越高；shared memory 有 bank conflict，global memory 要尽量合并访问。
- **occupancy**：由每线程寄存器数、每 block shared memory、block 大小等共同决定；occupancy 高不等于快，关键是能否隐藏延迟、是否受带宽或指令依赖限制。
- **roofline**：算术强度决定落在带宽区还是算力区。decode 每步只算一个 token，算术强度低，通常受权重和 KV 读取带宽限制；prefill 的矩阵乘更大，更容易接近算力上限。
- **异步与重叠**：stream、异步拷贝、CUDA Graph 用来重叠 CPU 准备、数据传输和 GPU 计算；重叠能否生效取决于依赖关系和形状是否稳定。
- **多卡通信**：NCCL 的 all-reduce / all-gather / reduce-scatter 是 TP/PP 的基础；拓扑、消息大小和重叠策略会影响扩展效率。

## 使用提醒

公开文档里的性能数字、默认值和推荐配置都依赖具体 GPU、驱动、CUDA、框架版本与模型。题库把它们当机制线索，不写成普遍定律；回答面试题时，先说假设，再说结论和边界。
