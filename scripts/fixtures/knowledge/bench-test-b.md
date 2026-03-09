# Benchmark Test Document B

Additional content for embedding benchmark. Explains the workflow.

To add knowledge: queue content with `gl add`, then run `gl reconcile` to merge into knowledge/. Run `gl index` to update the vector index. The `qmd embed` command processes documents that lack embeddings.

Verification: run `gl search "keyword"` or `gl query "question"` to confirm vectors work. Results should include relevant chunks from indexed documents.
