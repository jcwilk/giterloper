# CUDA and GPU acceleration in giterloper

## Role in the paradigm

Giterloper uses **QMD** (Query Markup Documents) to index and search knowledge. QMD relies on **node-llama-cpp** for model-backed operations: embeddings, semantic search, query expansion, and reranking. These operations run locally using GGUF models. **CUDA** (NVIDIA's parallel computing platform) accelerates these workloads when an NVIDIA GPU and the CUDA Toolkit are available.

CUDA is optional. Without it, node-llama-cpp falls back to CPU execution. The system still works, but model-backed operations are slower.

## Features enabled by GPU acceleration

| Operation | What it does | Why it matters for giterloper |
|-----------|--------------|------------------------------|
| **Embeddings** | Converts markdown chunks into vector representations | Powers semantic search (`qmd vsearch`) and hybrid search. Faster embedding means quicker indexing when running `qmd embed` or `gl index`. |
| **Query expansion** | Expands a natural-language question into multiple search variants | Improves recall for `gl query`—agents get more relevant context when asking questions in varied phrasing. |
| **Reranking** | Scores and reorders search results by relevance | Improves precision for `gl query`—the most relevant chunks surface first, so agents make better retrieval decisions. |

## Why this matters in context

- **Answer from context** (`gl query`): Hybrid search with expansion and reranking yields higher-quality answers. GPU acceleration makes each query faster, especially on larger stores.
- **Retrieve relevant context**: Agents depend on fast, accurate retrieval. GPU-accelerated reranking surfaces the right documents sooner.
- **Verify claims**: Broad search plus reranking helps find both supporting and contradicting evidence efficiently.
- **Ingest knowledge** (`gl index`, `qmd embed`): Embedding many documents is compute-heavy. GPU acceleration significantly reduces indexing time when adding or updating pins.

## Prerequisites for CUDA

- **NVIDIA GPU** with compatible drivers
- **CUDA Toolkit** 12.4+ or 13.1+ (includes `nvcc`)
- `nvcc` available in `PATH` or `CUDAToolkit_ROOT` set

Verify with:

```sh
nvcc --version
```

If CUDA is missing, model-backed operations fall back to CPU. The first run may take 10–30 seconds while node-llama-cpp attempts and then abandons CUDA. Set `NODE_LLAMA_CPP_GPU=false` to skip GPU probing and go straight to CPU when CUDA is not installed.
