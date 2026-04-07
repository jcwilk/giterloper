AI agent performance degrades predictably as the context window fills during a session, producing a distinct class of within-session failure that is separate from the cross-session memory problem.

## Description

Stateless agent context (see `stateless-agent-context.md`) describes the problem of agents that have no memory *across* sessions — each session starts cold. Context rot is a different failure mode: the degradation that happens *within* a single session as the context window accumulates tokens.

As a session progresses, the agent's context fills with prior tool calls, intermediate results, error messages, and conversational history. The agent doesn't forget this material — it's still in the window — but the model's ability to attend to and reason about relevant information degrades as the context grows. The failure is not binary (context full → crash) but continuous: performance declines gradually, often reaching a quality cliff at 20–50 turns or somewhere between 30–60% of maximum context capacity.

The specific failure modes context rot produces include:

**Instruction forgetting**: Early constraints and directives that the user stated are gradually outweighed by more recent content. The agent stops applying rules it was given at turn 1 because those tokens are now far from the attention peak.

**Pattern repetition**: The agent begins looping — attempting the same failed approach repeatedly because it cannot effectively integrate all the history of what didn't work. The Debugging Decay Index paper quantifies this: fix rate drops 60–80% after just 2–3 debugging iterations with accumulated context.

**Semantic dilution**: As more tokens enter the window, the *effective* context — the content the model actually attends to heavily — shrinks. The "lost in the middle" phenomenon (Liu et al., 2023) shows performance is highest for content at the beginning and end of context, with systematic degradation for content placed in the middle. In long agentic sessions, most of the task history lands in the middle.

**Tool output noise**: Agents that use many tools accumulate large volumes of tool call outputs in context. Tool schemas, results, and error traces can occupy 20–30% of context in production systems (Hacker News, Mar 2026), leaving less effective space for reasoning.

Context rot is distinct from context exhaustion (hitting the hard limit). Most failures happen well before the limit — the model becomes unreliable long before it runs out of tokens. Increasing context window size delays the cliff but doesn't eliminate the underlying degradation curve.

The problem is particularly dangerous for agentic coding tasks because sessions tend to be long (many tool calls), the relevant content (original spec, early decisions) is placed early in context, and failure is silent — the agent continues producing plausible-looking output while its reasoning quality has substantially degraded.

## Related Concepts

**Context Rot (Named Term, Chroma Research)**  
The term was coined and empirically established by Chroma Research's 2025 study. Their finding: "performance degrades across models as context length increases," with degradation beginning well before context limits are reached. Jeff Huber (Chroma CEO) promoted the term broadly in fall 2025. The concept was further extended in 2026 with agent-specific analysis showing a performance cliff at 20–30 turns.
- Chroma Research: ["Context Rot: How Increasing Input Tokens Impacts LLM Performance"](https://www.trychroma.com/research/context-rot) (Jul 14, 2025): Original empirical research establishing the named concept.
- Morph LLM: ["Context Rot: Why LLMs Degrade as Context Grows"](https://morphllm.com/context-rot) (Mar 13, 2026): Extends the Chroma research into continuous degradation curve with engineering implications.
- TechAhead: ["Context Rot: Why AI Agents Fail After Turn Twenty"](https://www.techaheadcorp.com/blog/context-rot-problem/) (Apr 2026): Applies Chroma findings to agentic sessions; documents 20–30 turn cliff.

**"Lost in the Middle" (Academic Foundation)**  
Liu et al.'s 2023 paper established the academic basis: LLMs use positional attention over long contexts non-uniformly — content at the beginning and end of context is privileged, while content in the middle is systematically underweighted. In agentic sessions, the original specification and instructions are placed early (privileged) but the accumulated task history lands in the middle (degraded). This means the very material the agent most needs to reason about — what was tried, what failed, what was decided — is the content it attends to least.
- Liu et al. (2023): ["Lost in the Middle: How Language Models Use Long Contexts"](https://arxiv.org/abs/2307.03172) — arXiv:2307.03172. *Transactions of the ACL*. Cited 3,700+ times.
- NeurIPS 2024: ["Found in the Middle"](https://neurips.cc/virtual/2024/poster/94207) — follow-up work proposing attention reranking as mitigation; demonstrates the problem persists into 2024 frontier models.

**Debugging Decay Index (Academic, Dec 2025)**  
The most precise quantification of context rot for debugging tasks: a formal framework showing that LLM debugging capability follows predictable exponential decay as context accumulates. Key finding: 60–80% drop in fix rate after just 2–3 failed debugging iterations within the same context. The mechanism is "context pollution" — accumulated failed attempts crowd out the signal needed to find the correct fix.
- Arxiv:2506.18403: ["The Debugging Decay Index: Rethinking Debugging Strategies for Code LLMs"](https://arxiv.org/abs/2506.18403) (Jun 2025 / Dec 2025 published)
- Nature Scientific Reports: ["Measuring and Mitigating Debugging Effectiveness Decay in Code LLMs"](https://www.nature.com/articles/s41598-025-27846-5) (Dec 18, 2025): Peer-reviewed empirical study confirming the decay curve.
- r/LocalLLaMA: ["Why LLM context pollution causes an 80% drop in fix rate after 3 attempts"](https://www.reddit.com/r/LocalLLaMA/comments/1po3s5f/paper_debugging_decay_why_llm_context_pollution/) (Dec 2025): Community discussion of the paper with practitioner replication examples.

**Limits of Long-Context Reasoning (Academic, Feb 2026)**  
A February 2026 paper directly tests the hypothesis that longer context windows solve agentic debugging tasks on SWE-bench. Finding: they don't. "The limits of long-context code reasoning" shows that context length alone doesn't explain failures — the model's ability to reason about all that context is the bottleneck.
- arXiv:2602.16069: ["The Limits of Long-Context Reasoning in Automated Bug Fixing"](https://arxiv.org/html/2602.16069v1) (Feb 17, 2026): Empirical study using SWE-bench Verified; shows increasing context past a threshold hurts rather than helps.

**Tool Schema Overhead (Practitioner Observation, Mar 2026)**  
A Hacker News submission (Mar 25, 2026) documented that AI agents waste approximately 30% of their context window on tool schemas — the structured definitions of available tools that must be included in every prompt. This is a specific, measurable form of context poisoning that accelerates context rot for tool-heavy agents.
- HN: ["Ark — AI agents waste ~30% of context on tool schemas"](https://news.ycombinator.com/item?id=47517514) (Mar 25, 2026): Motivated a new tool (Ark) for context compression of tool schemas; includes empirical measurement of schema overhead.

**Context Window Isn't the Real Bottleneck (Practitioner, Feb 2026)**  
A practitioner survey on r/AI_Agents (Feb 2026) that resonated widely: "Increasing the context window mostly delays failure, it doesn't fix it." The argument: context rot is a reasoning quality problem, not a storage problem. More tokens doesn't help if the model can't attend to them effectively.
- r/AI_Agents: ["Context windows aren't the real bottleneck for agents (memory is)"](https://www.reddit.com/r/AI_Agents/comments/1r7cc6p/context_windows_arent_the_real_bottleneck_for/) (Feb 18, 2026)

**Relationship to Stateless Agent Context**  
Context rot (within-session degradation) and stateless agent context (cross-session memory loss) are complementary failure modes. Stateless agents that reset context on each session avoid context rot but pay the cost of cold starts. Agents with persistent context avoid cold starts but accumulate rot over long sessions. Neither is solved by simply making context larger. The design tension is real: compression/summarization loses fidelity; full history degrades reasoning.

**Mitigation Approaches**  
The 2026 practitioner community has converged on several context management strategies:
1. *Rolling window* — drop oldest context beyond a threshold; loses early instructions but prevents quality cliffs
2. *Hierarchical summarization* — compress older context into summaries; loses detail but preserves high-level narrative
3. *State externalization* — write intermediate state to files or memory stores; treat context as ephemeral compute, not storage
4. *Fresh-context spawning* — start a new agent session from a clean slate with injected state summary for long tasks
5. *Tool schema compression* — strip redundant schema tokens; can recover 20–30% context budget
- buildmvpfast.com: ["Debugging AI Agents in Production: Error Recovery 2026"](https://www.buildmvpfast.com/blog/debugging-ai-agents-production-error-recovery-self-healing-2026) (Mar 27, 2026): "Anthropic uses a CHANGELOG.md pattern for their long-running research agents — on failure, read the state and resume from the last checkpoint."
- dev.to (Bob Renze): ["AI Agent Context Window Management"](https://dev.to/bobrenze/ai-agent-context-window-management-how-i-handle-tasks-that-take-longer-than-my-memory-4b47) (Apr 2026): Practical write-to-disk checkpoint pattern for resumable agents.

## Sources & Further Reading

- [Chroma Research: "Context Rot"](https://www.trychroma.com/research/context-rot) (Jul 2025): Foundational empirical research; established the named concept with quantitative degradation curves.
- [Liu et al. (2023): "Lost in the Middle" — arXiv:2307.03172](https://arxiv.org/abs/2307.03172): Academic foundation; 3,700+ citations; established non-uniform attention over long contexts as the underlying mechanism.
- [arXiv:2506.18403 — Debugging Decay Index](https://arxiv.org/abs/2506.18403) (Dec 2025): Quantifies context pollution as 60–80% debugging capability loss; most precise measurement of the coding-specific failure mode.
- [Nature: "Measuring and Mitigating Debugging Effectiveness Decay"](https://www.nature.com/articles/s41598-025-27846-5) (Dec 18, 2025): Peer-reviewed confirmation of the decay curve in code LLMs.
- [arXiv:2602.16069 — Limits of Long-Context Reasoning](https://arxiv.org/html/2602.16069v1) (Feb 17, 2026): Shows extending context windows doesn't solve the quality degradation; reasoning quality is the bottleneck.
- [Morph LLM: Context Rot Guide](https://morphllm.com/context-rot) (Mar 2026): Practical engineering guide; continuous vs. cliff degradation distinction; mitigation strategies.
- [The New Stack: "Context Rot, Enterprise AI, LLMs"](https://thenewstack.io/context-rot-enterprise-ai-llms/) (Mar 9, 2026): Enterprise perspective on how context rot manifests in production agentic systems.
- [Understanding AI: "Context Rot — The Emerging Challenge"](https://www.understandingai.org/p/context-rot-the-emerging-challenge) (Nov 10, 2025): Tim Lee's accessible treatment of the research; good secondary source.
- [arXiv:2601.15300 — "Intelligence Degradation in Long-Context LLMs"](https://arxiv.org/html/2601.15300v1) (Jan 7, 2026): Academic study documenting "catastrophic performance degradation" at long context lengths; validates the context rot phenomenon against the "Lost in the Middle" foundation.
- [OAJAIML: "Maximum Effective Context Window for Real World Limits of LLMs"](https://www.oajaiml.com/uploads/archivepdf/643561268.pdf) (Jan 19, 2026): Introduces the concept of a *maximum effective context window* — the practical performance limit as distinct from the technical limit. Key finding: "agentic systems relying on large context windows for long-running tasks fundamentally rely on degraded model performance." This frames context rot as a hard engineering constraint, not just a quality concern.
- [atlan.com: "LLM Context Window Limitations: Impacts, Risks, & Fixes in 2026"](https://atlan.com/know/llm-context-window-limitations/) (Feb 9, 2026): Notes Chroma's finding that context rot degrades accuracy 30%+ in mid-window positions across all 18 frontier models tested; enterprise-scale framing.
- [r/LocalLLaMA: 847-Agent-Run Context Degradation Tracking](https://www.reddit.com/r/LocalLLaMA/comments/1qio9nj/i_tracked_context_degradation_across_847_agent/) (Jan 2026): Practitioner empirical tracking showing performance cliff at ~30–40% context fill.

**Atlassian Rovo Dev: "Structured Forgetting" and Cascade Pruning (Production Implementation, Mar 31, 2026)**
Atlassian published a detailed engineering post on how they tackled context rot in Rovo Dev, their production agentic coding tool. Their approach distinguishes between the conceptual problem (context rot) and the operational solution (structured forgetting). Key techniques:

- *Cascade pruning* — a multi-stage removal heuristic that targets intermediate tool outputs and reasoning traces first, preserving task specification and final conclusions. Named "cascade" because removing one type of content frees space for the next; the sequence is ordered by information density.
- *"Protect the edges" heuristic* — the observation that the first and last messages in context carry disproportionate weight (consistent with Liu et al.'s "Lost in the Middle" finding). Their implementation explicitly protects content at both ends of context when pruning, targeting middle-window intermediate content first.
- *Semantic compression* — replacing detailed intermediate tool outputs with compressed summaries that preserve the decision, not the trace. Tested against full-context retrieval as a baseline.
- *Re-injection on task resume* — when a task is resumed after context clearing, they inject a structured task-state document (current goal, decisions made, next steps) rather than replaying history.

The post is notable as one of the first published production evaluations of context pruning heuristics in agentic coding, with concrete engineering tradeoffs. It frames the problem not as "how long can a session run" but "how do we maintain decision fidelity as sessions grow."
- Atlassian: ["How Rovo Dev Keeps Long Sessions Useful: A Deep Dive into Context Pruning"](https://www.atlassian.com/blog/developer/rovo-dev-keeps-long-sessions-useful) (Mar 31, 2026): First detailed production account of cascade pruning implementation; "protect the edges" heuristic; structured forgetting as a named operational approach.

## Additional Sources (Added Apr 2026)

- [Atlassian: "How Rovo Dev Keeps Long Sessions Useful"](https://www.atlassian.com/blog/developer/rovo-dev-keeps-long-sessions-useful) (Mar 31, 2026): Production implementation of "structured forgetting" / cascade pruning with "protect the edges" heuristic; first published production evaluation of agentic context pruning tradeoffs.
