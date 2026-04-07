Human intent is necessarily sparse and high-level, but agents require dense, low-level specification to produce correct behavior — and bridging that gap reliably is an unsolved problem.

A human thinks in goals, constraints, and concepts. They say things like "add authentication" or "make this faster" or "it should behave like X." These directives are meaningful to another human who shares context, culture, and common sense. They are profoundly underspecified for an agent that must translate them into working code.

The agent will fill the gap. It has to. But the way it fills it is determined by its training, its context window, and the current state of the codebase — not by the human's actual intent, which remains largely implicit. The agent makes plausible choices. Most of the time those choices are reasonable. Sometimes they're not.

The problem compounds because the human doesn't know what the agent doesn't know. They assume shared context that doesn't exist. They say "add authentication" without specifying which kind, what the session model should be, how it should interact with existing user state, what the error behavior should be — because to them these feel like obvious details, not decisions. The agent guesses.

Asking humans to be more explicit is not a solution — it recreates the burden of traditional software specification, which is why people moved to higher-level abstractions in the first place. The real problem is that there's no good mechanism for making implicit human knowledge legible to an agent without requiring the human to re-express it from scratch every time.

## Related Concepts

**Tacit Knowledge (Polanyi)**  
Michael Polanyi's concept of tacit knowledge — "we know more than we can tell" — is the epistemological foundation of the sparse directive problem. Human engineers carry enormous amounts of implicit knowledge about system design, tradeoffs, organizational context, and domain semantics that they cannot easily articulate. When directing an agent, they are trying to transfer tacit knowledge via explicit utterances, which is a structurally lossy process. Polanyi identified this gap in 1966; the LLM agent context makes it an engineering bottleneck.
- Polanyi, M. (1966). *The Tacit Dimension*. Doubleday.

**Underspecification in ML (Academic)**  
The ML research community has a formal concept of *underspecification*: a trained model may be compatible with many different solutions that all perform well on training data but diverge badly in deployment. D'Amour et al. (Google, 2020) showed this problem is pervasive. In the agent coding context, the directive is underspecified in the same structural sense — many different code implementations satisfy the directive, and only human domain knowledge distinguishes correct from incorrect ones.
- D'Amour et al. (2020): ["Underspecification Presents Challenges for Credibility in Modern Machine Learning"](https://arxiv.org/abs/2011.03395) — arXiv:2011.03395

**Vibe Coding as a Name for the Problem**  
The term "vibe coding" (coined by Andrej Karpathy, ~2025) describes development where the human operates entirely at the level of high-level intent and trusts the agent to fill in all details. Multiple practitioners have noted that vibe coding works well for prototypes but hits a wall at production scale, precisely because the accumulation of unspecified decisions creates an unmanageable codebase.
- Red Hat Developer: ["The Uncomfortable Truth About Vibe Coding"](https://developers.redhat.com/articles/2026/02/17/uncomfortable-truth-about-vibe-coding) (Feb 2026)
- Medium / Design Bootcamp: ["Vibe Coding Skipped the Spec. That's the Problem Nobody's Talking About"](https://medium.com/design-bootcamp/vibe-coding-skipped-the-spec-thats-the-problem-nobody-s-talking-about-99490312c3ca) (Apr 2026)
- Augment Code: ["Vibe Coding vs Spec-Driven Development"](https://www.augmentcode.com/guides/vibe-coding-vs-spec-driven-development) (Mar 2026): Empirically identifies "the 3-month wall" where vibe-coded projects become unmaintainable.

**Proactive Clarification (Academic Mitigation)**  
One active research direction: agents that proactively identify ambiguities in directives and request targeted clarification before acting. This doesn't solve the tacit knowledge problem (the human may not know what they don't know) but reduces the worst-case gap-filling.
- OpenReview: ["Dialogue as Discovery: Navigating Human Intent Through Principled Uncertainty Reduction"](https://openreview.net/forum?id=ftLqH4tgrh) (Nov 2025): Proposes mechanism for agents to proactively request information to reduce uncertainty about user intent.

**Intent-Based Task Automation (Engineering Research)**  
ScienceDirect (Mar 2026) published work on automating intent-based task-oriented dialogues using LLMs, specifically noting that "LLM outputs often violate platform constraints" — a form of the sparse directive problem where platform-level constraints are implicit to the human but invisible to the agent.
- ["Automating the Initial Development of Intent-Based Task-Oriented Dialogues"](https://www.sciencedirect.org/science/article/pii/S1546221826002043) (Mar 2026)

**Spec-Driven Development as a Structural Response**  
The industry response to the sparse directive problem is increasingly to formalize intent *before* generation, not audit it *after*. Spec-driven development (SDD) treats the specification as the primary artifact, with code as a derivative output validated against it.
- Augment Code: ["What Is Spec-Driven Development? A Complete Guide"](https://www.augmentcode.com/guides/what-is-spec-driven-development) (Feb 2026)
- O'Reilly: ["How to Write a Good Spec for AI Agents"](https://www.oreilly.com/radar/how-to-write-a-good-spec-for-ai-agents/) (Feb 2026)

**Knowledge Activation: AI Skills as Institutional Knowledge Primitive (Academic, Mar 2026)**  
Bakal et al. (arXiv:2603.14805) address the sparse directive problem from the infrastructure side: their "Knowledge Activation" framework proposes *AI Skills* — structured, agent-consumable representations of institutional knowledge — as the mechanism for making tacit organizational context legible to agents. The thesis: "the central challenge facing both autonomous AI agents and human-AI teams is not capability but knowledge access." They distinguish between raw information (available in codebases and docs) and *activated knowledge* (structured so agents can apply it to novel situations). This is the most academically developed attempt to operationalize the Polanyi gap as of 2026.
- arXiv:2603.14805 — ["AI Skills as the Institutional Knowledge Primitive for Agentic Software Development"](https://arxiv.org/abs/2603.14805) (Gal Bakal et al., Mar 2026)

**Anthropic 2026 Report: Context Engineering as the Frontier**  
Anthropic's 2026 trends report identifies context engineering — curating and structuring the information agents receive — as the emerging discipline that determines how much of the productivity potential of agentic development organizations actually capture. The bottleneck in 2026 is no longer model capability but context quality: what the agent knows about the project, its constraints, and the organization's intent at the moment it acts.
- The New Stack: ["Context Is AI Coding's Real Bottleneck in 2026"](https://thenewstack.io/context-is-ai-codings-real-bottleneck-in-2026/) (Jan 23, 2026)

**Intent Formalization as a Grand Challenge (Academic, Mar 2026)**  
A Mar 2026 position paper by software engineering researchers frames the sparse directive problem as the central unsolved challenge in reliable agentic coding. Their term "intent formalization" — transforming sparse, informal human directives into machine-verifiable specifications — is offered as the key open problem. They identify five sub-challenges: (1) scalability beyond toy benchmarks, (2) compositionality over incremental changes, (3) cost-effective clarification (knowing when to ask vs. infer), (4) automated verification that code satisfies spec, and (5) handling evolving intent over time. Each corresponds directly to a failure mode that stems from directive sparsity.
- arXiv:2603.17150: ["Intent Formalization: A Grand Challenge for Reliable Coding in the Age of AI Agents"](https://arxiv.org/abs/2603.17150) (Mar 17, 2026): Most rigorous academic framing of the sparse directive problem; provides vocabulary for the open research challenges.

**"Most AI Coding Agents Fail Before They Write a Single Line of Code" (Mar 2026)**  
Practitioner Juan C. Méndez's widely-circulated LinkedIn post (Mar 2026) distills the sparse directive problem to its operational root: agents fail not because the model is bad, but because the input (directive) is underspecified. His empirical claim from production deployment: most agent failures are traceable to insufficient input specification, not model capability.
- Juan C. Méndez: ["AI Coding Agents Fail Without Clear Requirements"](https://www.linkedin.com/posts/jcmendez_agenticcoding-agenticai-aiagents-activity-7439263804724740096-T8Dg) (Mar 16, 2026)

## Sources & Further Reading

- [arXiv:2011.03395 — Underspecification in Modern ML (D'Amour et al., Google)](https://arxiv.org/abs/2011.03395) (2020): Foundational paper showing underspecification is pervasive in ML; establishes formal vocabulary for the sparse directive problem.
- [arXiv:2603.14805 — Knowledge Activation](https://arxiv.org/abs/2603.14805) (Mar 2026): Most developed academic treatment of how to make institutional/tacit knowledge legible to agents; directly addresses the Polanyi gap.
- [OpenReview: "Dialogue as Discovery"](https://openreview.net/forum?id=ftLqH4tgrh) (Nov 2025): Research proposal for proactive clarification agents that reduce directive underspecification.
- [Red Hat Developer: "The Uncomfortable Truth About Vibe Coding"](https://developers.redhat.com/articles/2026/02/17/uncomfortable-truth-about-vibe-coding) (Feb 2026): Clear practitioner framing of why high-level directives produce unmaintainable code at scale.
- [Augment Code: "Vibe Coding vs Spec-Driven Development"](https://www.augmentcode.com/guides/vibe-coding-vs-spec-driven-development) (Mar 2026): Practical analysis of when each approach works and the "3-month wall" problem.
- [The New Stack: "Context Is AI Coding's Real Bottleneck in 2026"](https://thenewstack.io/context-is-ai-codings-real-bottleneck-in-2026/) (Jan 23, 2026): Industry framing of context engineering as the frontier discipline replacing prompt engineering; directly relevant to what Giterloper is building.
- [Medium: "Vibe Coding Skipped the Spec"](https://medium.com/design-bootcamp/vibe-coding-skipped-the-spec-thats-the-problem-nobody-s-talking-about-99490312c3ca) (Apr 2026): Recent practitioner essay directly naming the specification omission as the core failure mode of current AI-assisted development.
- [arXiv:2603.17150 — Intent Formalization Grand Challenge](https://arxiv.org/abs/2603.17150) (Mar 17, 2026): Most rigorous academic framing; names the five open sub-problems of intent formalization as the research agenda for solving directive sparsity.

**AGENTS.md Specification Quality Paradox (ETH Zurich / arXiv, Feb 2026)**
A February 2026 empirical study by ETH Zurich researchers (Gloaguen, Mündler, Müller, Raychev, Vechev) adds a critical nuance to the sparse directive problem: more specification is not always better. Testing four coding agents (Claude 3.5 Sonnet, Codex GPT-5.2, GPT-5.1 mini, Qwen Code) across three scenarios — no context file, LLM-generated AGENTS.md, and human-written AGENTS.md — on real-world SWE-bench tasks and a novel 138-task benchmark (AGENTbench):

- **LLM-generated AGENTS.md**: reduces task success rate by 3% compared to no context file, while increasing inference costs by 20%+
- **Human-written AGENTS.md**: provides marginal gains (+4% success rate) but still increases costs by up to 19%
- **Root cause**: Context files instruct agents to run more tests, read more files, perform more checks — behaviors that are individually reasonable but often unnecessary for the specific task at hand. "Unnecessary requirements from context files make tasks harder."
- **Key conclusion**: "Context files have only a marginal effect on agent behavior and are likely only desirable when manually written. Human-written context files should describe only *minimal requirements*."

The implication for the sparse directive problem: the remedy is not simply "write a more detailed spec" — it's "write a maximally *relevant and minimal* spec." Irrelevant specification imposes reasoning overhead and degrades performance. This reframes the sparse directive problem from a quantity problem to a quality problem: the agent needs not just more specification, but specification that is concise, task-relevant, and free of unnecessary requirements.

This is consistent with the Polanyi framing: tacit knowledge cannot be easily externalized into a specification without losing either relevance (too much context) or correctness (too little context). The specification channel is narrow and lossy in both directions.

- arXiv:2602.11988: ["Are Repository-Level Context Files Helpful for LLM-based Coding Agents?"](https://arxiv.org/abs/2602.11988) (Thibaud Gloaguen et al., ETH Zurich, Feb 12, 2026): Empirical study; 4 agents × 3 context scenarios; AGENTbench novel dataset; LLM-generated spec files reduce success and raise costs; human-written files marginally help but are costly.
- InfoQ: ["Despite Industry Recommendations, ETH Zurich Paper Concludes AGENTS.md Files May Often Hinder AI Coding Agents"](https://www.infoq.com/news/2026/03/agents-context-file-value-review/) (Mar 2026): Best secondary coverage; includes Hacker News community reaction — "it's actually vouching for *good* AGENTS.md files" vs. "context files may just be more useful to developers than to AI harnesses."

**AGENTS.md Files: On Impact (arXiv:2601.20404, Jan 2026)**
A companion empirical study from January 2026 evaluates AGENTS.md files across 60,000+ public repositories. Finding: AGENTS.md files reduce agent *runtime* by 28.64% and output tokens by 16.58%, even when their effect on task success is mixed. The efficiency gain is explained by more direct pathways through familiar codebases — the agent navigates the repository structure faster. This suggests AGENTS.md files solve a different problem than task success: they reduce the *cost and latency* of agent exploration, even when they don't increase solution quality. For long-running agentic workflows where token cost is a concern, minimal context files may be valuable primarily as navigation aids rather than as intent specifications.
- arXiv:2601.20404: ["On the Impact of AGENTS.md Files on AI Coding Agents"](https://arxiv.org/abs/2601.20404) (Jan 28, 2026): 60,000+ repositories; 28.64% runtime reduction; 16.58% output token reduction; efficiency vs. correctness tradeoff.

- [arXiv:2602.11988 — "Are Repository-Level Context Files Helpful?"](https://arxiv.org/abs/2602.11988) (ETH Zurich, Feb 12, 2026): Empirical evidence that LLM-generated AGENTS.md files *reduce* success and increase costs; human-written files offer marginal gains at high cost; key finding that "minimal requirements" is the right design principle.
- [arXiv:2601.20404 — "On the Impact of AGENTS.md Files"](https://arxiv.org/abs/2601.20404) (Jan 28, 2026): Efficiency dimension of AGENTS.md files; 28.64% runtime reduction suggests context files have value as navigation aids independent of their effect on solution quality.
- [InfoQ: AGENTS.md ETH Zurich Coverage](https://www.infoq.com/news/2026/03/agents-context-file-value-review/) (Mar 2026): Best secondary source on the ETH paper; captures both the study's findings and the nuanced community reaction.
