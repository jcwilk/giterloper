# Design rationale

## Data-layer analogy

The knowledge store is intended as a long-term incremental source of truth—analogous to a columnar database that serves as the full data source for a relational database's aggregates. Other systems (dashboards, views, tools) can run their own aggregates over it; the store itself remains the durable bottom layer.

## Interactivity

The system is designed to be interactive so that the user or agent gets feedback at each step. Installation, confirmation, and write workflows should surface clear choices and state rather than proceeding silently.

## Bootstrap variants and tooling

The main repository may provide build tooling for producing the bootstrap. Different bootstrap sizes are a design consideration: depending on context-window sensitivity, a smaller or larger bootstrap can be built from the same source. This allows projects to choose an appropriate tradeoff between completeness and token usage.
