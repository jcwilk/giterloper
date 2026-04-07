As AI agents generate more code, the codebase progressively diverges from what the human controller believes or intends it to be.

The human can only express intent sparsely — a directive here, a correction there. Between those moments, the agent fills gaps with its own assumptions. Each gap-fill is invisible to the human unless they read and understand every line produced. Over time, a growing body of "unknown" agent-authored code accumulates, and it carries implicit assumptions about what the system is supposed to do. These assumptions may be internally consistent but externally wrong — misaligned with the human's actual intent.

The divergence is hard to detect because it doesn't produce errors; it produces a codebase that works, just not quite the way the human imagined. It compounds because each new agent session inherits the diverged state as ground truth. By the time a human notices something is off, the root cause may be buried under many layers of subsequent code that was built on top of the original wrong assumption.

This is intent drift: the slow, silent accumulation of misalignment between human intent and code reality.

## Related Concepts

**Agent Drift (Design Systems Framing)**  
Itamar Medeiros (designative.info) independently named this problem "Agent Drift" in March 2026, defining it as "the gradual divergence between a human's original intent and the actions or outcomes produced by an AI-driven system over time." His framing emphasizes that human intentions also *evolve* — meaning drift has two sources: the agent's gap-filling and the human's changing mental model. The article distinguishes between *intent drift* (what the agent does vs. what the human wanted) and *alignment drift* (what the agent optimizes for vs. what the human values).
- Designative.info: ["Preventing Agent Drift: Designing AI Systems That Stay Aligned With Human Intent"](https://www.designative.info/2026/03/08/preventing-agent-drift-designing-ai-systems-that-stay-aligned-with-human-intent/) (Mar 8, 2026)

**Spec Drift**  
A closely related named concept in software engineering: the divergence between documentation/specifications and the actual codebase over time. In traditional development, spec drift happens slowly (specs become stale). In agentic development, the direction reverses — the code produces a de facto "spec" that overrides the human's mental model. Kinde's engineering blog frames AI as a tool for detecting and correcting spec drift.
- Kinde: ["Spec Drift: The Hidden Problem AI Can Help Fix"](https://kinde.com/learn/ai-for-software-engineering/ai-devops/spec-drift-the-hidden-problem-ai-can-help-fix/)

**Intent Mismatch / "Lost in Conversation" (Academic)**  
A Feb 2026 paper directly addresses a mechanism of intent drift in multi-turn LLM dialogue: under incomplete information, LLMs "make premature assumptions early in the dialogue and subsequently 'lock in'" on those assumptions, resisting correction even when the human provides clarifying signals. The paper calls this the "Lost in Conversation" phenomenon and identifies *intent mismatch* as the root cause.
- arXiv:2602.07338 — ["Intent Mismatch Causes LLMs to Get Lost in Multi-Turn Conversation"](https://arxiv.org/abs/2602.07338) (Feb 7, 2026)

**AI Model Drift vs. Intent Drift**  
The ML community has an existing concept called "model drift" or "data drift" — when model performance degrades as the statistical distribution of inputs changes over time. This is distinct from intent drift, which is not a training problem but a *deployment context* problem: the model's behavior may be internally consistent while diverging from what any particular human operator intended. The names can cause confusion.

**Living Specs as a Mitigation**  
The most active practitioner response to intent drift is the "living spec" approach: maintaining human-authored specification documents that are updated as the codebase evolves, serving as the canonical source of intent that agents are required to reference and stay aligned with.
- Augment Code: ["How to Write Living Specs for AI Agent Development"](https://www.augmentcode.com/guides/living-specs-for-ai-agent-development) (Mar 2026)
- O'Reilly Radar: ["How to Write a Good Spec for AI Agents"](https://www.oreilly.com/radar/how-to-write-a-good-spec-for-ai-agents/) (Feb 2026)

**Asymmetric Goal Drift in Coding Agents (Academic, Mar 2026)**  
Saebo et al. at arXiv formalize a specific sub-type of intent drift: "asymmetric goal drift," where coding agents systematically violate explicit constraints more often in one direction when values are in conflict. The paper uses multi-step agentic tasks on OpenCode and finds that "goal drift correlates with three compounding factors: value alignment, adversarial pressure, and task length." This provides empirical evidence that drift is not random but structurally biased — agents drift in predictable directions based on their training values.
- arXiv:2603.03456 — ["Asymmetric Goal Drift in Coding Agents Under Value Conflict"](https://arxiv.org/abs/2603.03456) (Magnus Saebo, Spencer Gibson et al., Mar 3, 2026)

**Anthropic 2026 Agentic Coding Trends Report**  
Anthropic's industry-wide survey (Jan 2026) identifies the human role in agentic development as shifting from *writer* to *orchestrator*: "the primary human role in building software is orchestrating AI agents that write code, evaluating their output, providing strategic direction." This framing makes intent drift the central risk — if the human's role is to specify intent and evaluate alignment, then any drift in the agent's understanding of that intent is the primary failure mode of the new paradigm.
- Anthropic: ["2026 Agentic Coding Trends Report"](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf) (Jan 21, 2026)

**"Orchestration Era Needs Intent" (Industry Framing)**  
Pathmode's analysis of the Anthropic report argues that the shift to multi-agent orchestration makes intent *specification* — not code generation — the central engineering challenge: "the report predicts 2026 is the year single-agent workflows give way to coordinated multi-agent systems. One orchestrator decomposes a task... but the intent propagation chain is the failure point."
- Pathmode: ["Anthropic's Agentic Coding Report Confirms It"](https://pathmode.io/blog/orchestration-era-needs-intent) (Mar 11, 2026)

**Intent Formalization as a Grand Challenge (arXiv, Mar 2026)**  
A position paper from software engineering researchers argues that *intent formalization* — the problem of expressing, propagating, and verifying human intent through agentic coding pipelines — is one of seven grand open problems for reliable AI-assisted development. The paper identifies three specific sub-problems: (1) *intent elicitation* (how to extract sufficient intent from sparse human directives), (2) *intent propagation* (how to maintain intent fidelity through multi-step multi-agent execution), and (3) *compositionality over changes* (ensuring new changes are compositionally consistent with accumulated prior intent). All three are unsolved. The framing positions intent drift not as a UX problem but as a formal verification challenge.
- arXiv:2603.17150: ["Intent Formalization: A Grand Challenge for Reliable Coding in the Age of AI Agents"](https://arxiv.org/abs/2603.17150) (Mar 17, 2026): Academic position paper; establishes intent formalization as an open research program; distinguishes elicitation, propagation, and compositionality sub-problems.

## Sources & Further Reading

- [Designative.info: "Preventing Agent Drift"](https://www.designative.info/2026/03/08/preventing-agent-drift-designing-ai-systems-that-stay-aligned-with-human-intent/) (Mar 2026): Most developed practitioner treatment of agent drift as a design problem; introduces intent vs. alignment drift distinction and proposes feedback-loop design patterns.
- [arXiv:2602.07338](https://arxiv.org/abs/2602.07338) (Feb 2026): Academic paper on LLM intent mismatch in multi-turn conversation; experimental evidence for "premature lock-in" behavior that directly drives intent drift.
- [arXiv:2603.03456 — Asymmetric Goal Drift in Coding Agents](https://arxiv.org/abs/2603.03456) (Mar 2026): First formal measurement of directional bias in agent drift; shows drift is not random but shaped by training value alignment.
- [Anthropic: 2026 Agentic Coding Trends Report](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf) (Jan 2026): Industry baseline for understanding why intent drift is the central risk in the orchestration paradigm.
- [Augment Code: "Living Specs vs Static Specs"](https://www.augmentcode.com/guides/living-specs-vs-static-specs) (Mar 2026): Empirical comparison showing living specs outperform static specs on multi-step agent tasks with changing requirements.
- [Zenn / VirtualCraft: "Intent Drift Detection"](https://zenn.dev/virtualcraft/articles/idd-06_context-engineering?locale=en) (Feb 2026): Proposes intent drift detection tooling embedded in the development loop; includes emotional context and code review inference as signals.
- [LinkedIn: "AI-Generated Code Overwhelms Code Reviews: The Shift to Intent Verification"](https://www.linkedin.com/posts/edwardacee_how-to-kill-the-code-review-activity-7434991992679432192-sQeY) (Mar 2026): Practitioner argument that intent verification (checking what code *does* against what was *intended*) must replace traditional code review.
