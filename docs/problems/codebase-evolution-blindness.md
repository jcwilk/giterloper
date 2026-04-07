AI coding agents can fix isolated bugs but systematically fail at long-term codebase maintenance because they have no persistent model of how the codebase has evolved and why.

## Description

There is a meaningful difference between *writing code* and *maintaining a codebase*. Writing is a snapshot problem: given a requirement, produce code that satisfies it. Maintenance is a time problem: given a codebase with history, continue evolving it without breaking the accumulated invariants, architectural decisions, and implicit constraints that have built up over months.

Current AI coding agents are built primarily for the snapshot problem. Benchmarks like SWE-bench measure one-shot patch quality — can the agent fix this specific issue? — and agents have become quite good at this. But production software is not a series of isolated one-shot tasks. It is a system that evolves through hundreds of changes over months and years, each building on the last, with a growing accumulation of constraints that must be respected.

When an agent is dropped into a mature codebase for a maintenance task, it has no evolutionary memory. It sees the current state of the code but not how it got there. It doesn't know:
- Which invariants have been intentionally maintained (and which are accidental)
- Why a function is structured the way it is (historical constraint vs. design choice)
- What previous agents or engineers tried that didn't work
- Which modules are load-bearing in ways not visible from the code structure
- What the EvoScore history looks like — whether recent commits have been trending stable or accumulating fragility

The agent makes changes that are locally correct — the immediate task passes, tests pass — but globally destructive, because the agent had no model of the evolutionary context in which those changes are embedded.

This is structurally different from the stateless agent context problem (which is about session-to-session memory loss) and from assumption compounding (which is about wrong assumptions building up). Codebase evolution blindness is specifically about the agent's inability to reason about the *trajectory* of a codebase — where it's been, what's been deliberately maintained, and what will break if the trajectory changes.

**The SWE-CI finding**: The first empirical benchmark of this failure mode (Alibaba, Mar 2026) tested 18 models across 100 real Python repositories, each with 233 days of history and 71 consecutive commits. The task was to maintain the codebase through iterative evolution without breaking existing functionality. Result: 75% of models broke previously working code during maintenance iterations. Only Claude Opus 4.5/4.6 maintained >50% success rate; most models were below 25%. The gap between one-shot patch quality (what SWE-bench measures) and iterative maintenance quality (what SWE-CI measures) is extreme.

**The angelkurten observation**: Six months of daily production AI agent usage across multiple projects documented five distinct failure modes unique to the maintenance context: the silent regression (locally valid change breaks downstream assumption), the context window cliff (agent doesn't load the dependent modules), the confident downgrade (agent uses outdated API patterns from training data), the accumulating drift (codebase gradually loses architectural coherence), and the production destroyer (agent executes destructive operations without evolutionary awareness of what's real vs. safe).

The common thread: maintenance requires a *model of the system's past and trajectory*, which an agent that is dropped in fresh for each task cannot have.

## Related Concepts

**SWE-CI: Evolution-Based Evaluation (Alibaba / arXiv, Mar 2026)**
The first benchmark designed to measure codebase maintenance performance rather than one-shot patch quality. Distinguishes between *snapshot-based evaluation* (one requirement, one task, one solution) and *evolution-based evaluation* (requirements re-derive from current codebase state each iteration; past decisions accumulate). The iterative evaluation protocol runs agents through up to 20 rounds of CI, where each round builds on what was done in previous rounds. Results expose a capability wall that snapshot benchmarks miss entirely.

Key metric introduced: **EvoScore** — a future-weighted mean across iterations that penalizes short-term optimization. An agent that fixes things early but creates mounting technical debt sees its EvoScore erode as later iterations become harder. Named explicitly after the ISO/IEC 25010 definition of maintainability: "a quality only revealed through successive modifications."

Key finding: **zero-regression rate** (how often the agent completes a round without breaking previously passing tests). Most models: below 0.25 (i.e., >75% of rounds break something). Claude Opus 4.6 (best performer): 0.76. Most agents fail the basic bar of "do not break what was already working" more than 75% of the time.

- arXiv:2603.03823: ["SWE-CI: Evaluating Agent Capabilities in Maintaining Codebases Over Evolving Environments"](https://arxiv.org/abs/2603.03823) (Alibaba, Mar 4, 2026): Foundational paper; 18 agents, 100 repositories, 233 days of history; EvoScore metric; zero-regression rate data.
- Towards AI: ["Benchmarking AI Agents on Code Maintenance Is Finally Here"](https://pub.towardsai.net/benchmarking-ai-agents-on-code-maintenance-is-finally-here-19e2813ea089) (Mar 11, 2026): Best secondary source; "The core difference: SWE-bench measures one-shot patch quality; SWE-CI measures iterative maintenance quality over dozens of rounds."
- levelup.gitconnected.com: ["75% of AI Coding Agents Introduce Regressions During Long-Term Maintenance"](https://levelup.gitconnected.com/75-of-ai-coding-agents-introduce-regressions-during-long-term-maintenance-31e345331bb4) (Mar 2026): Accessible secondary coverage; detailed analysis of what the metric exposes.

**Writing vs. Maintaining: Fundamentally Different Tasks**
The angelkurten post (Mar 2026) articulates the core distinction most clearly: "Maintenance is not a coding task. Maintenance is a systems comprehension task that occasionally requires writing code." Human developers who maintain codebases accumulate a mental model of the system — implicit constraints, historical decisions, failure modes seen before, which utility functions are depended on by runtime processes not visible in the IDE — that they use to make changes that are locally appropriate and globally safe. Agents do not accumulate this model. They see the current code state, not the system's history, and their confidence scales inversely with their actual comprehension of the accumulated constraints.

Addy Osmani's "80% problem" framing captures this: agents can rapidly produce 80% of the code, but the remaining 20% requires deep knowledge of context, architecture, and tradeoffs. In maintenance tasks, that 20% is exactly where evolutionary awareness is most needed.

- angelkurten.com: ["AI Agents Are Breaking Your Codebase: A Six-Month Maintenance Report"](https://angelkurten.com/blog/ai-agents-breaking-codebases) (Mar 2026): First-person practitioner account; five named failure modes; production data; practical guardrails.
- Addy Osmani (Google Chrome): ["The 80% Problem in Agentic Coding"](https://addyo.substack.com/p/the-80-problem-in-agentic-coding): Frames the maintenance comprehension gap as the unsolved 20%.

**The Trajectory Problem: Memory of Decisions, Not Code**
A key observation from practitioners studying SWE-CI: "Memory in these agents is memory of the code, not memory of the decisions." A codebase is not its current state — it's the accumulated reasoning of everyone who built it, encoding why functions are structured the way they are, which invariants the team has silently agreed to preserve, and what was tried and rejected. Agents that have only the code state and not the decision history will optimize locally and degrade globally.

This connects to the Architecture Decision Record (ADR) pattern in traditional software engineering, which exists precisely to externalize the decision history that does not live in code. Agents need access to ADRs — or their equivalent — to reason about codebase trajectory. Without them, every maintenance session is a new agent with no institutional memory of the decisions that shaped the current state.

**Relationship to Related Problems**
- **Stateless agent context** (`stateless-agent-context.md`): cross-session memory loss is a *mechanism* for codebase evolution blindness. If agents can't remember what they did last Tuesday, they can't maintain evolutionary awareness. But this problem is broader: even if a single session were infinitely long, the agent would still lack access to the pre-session history that shaped the current codebase state.
- **Assumption compounding** (`assumption-compounding.md`): both are time-based failure modes. The difference: assumption compounding tracks errors embedded *during generation* that compound over time. Evolution blindness is about the agent's failure to *read* the evolutionary state when performing maintenance — it's an inference failure, not just an accumulation failure.
- **Comprehension debt** (`comprehension-debt.md`): closely related. Comprehension debt describes the human's inability to understand AI-generated code at the rate it's produced. Evolution blindness describes the agent's inability to understand the human-maintained codebase trajectory. Both create a comprehension gap; they just point in opposite directions.

**Dual-Agent Protocol as Partial Remedy**
The SWE-CI paper's evaluation protocol itself suggests a partial remedy: a *disciplined two-agent loop* where an Architect agent translates failing tests into structured requirements documents, and a Programmer agent implements changes strictly scoped to those requirements. The Architect's prompt explicitly forbids scope expansion; the Programmer's prompt prohibits unsolicited improvements. This architecture encodes the judgment that in maintenance contexts, disciplined scope limitation is the first guardrail against evolutionary disruption.

Even with this scaffolding, most agents fail the zero-regression threshold — suggesting that better process alone is insufficient and that some form of evolutionary memory (decision history, architectural invariants, past-failure records) is necessary.

**CodeRabbit Data: AI Code Has 1.7× More Issues**
CodeRabbit's analysis of 470 GitHub pull requests found AI-generated code produces 1.7× more issues than human-written code, with logic and correctness errors rising 75%. These are not syntax errors — they are semantic misunderstandings of existing system behavior. The implication for maintenance: the agent's failure is not in code generation skill but in comprehension of the evolutionary context into which its changes are inserted.
- CodeRabbit: ["State of AI vs. Human Code Generation Report"](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report) (2026)

**Connection to Intent Formalization Research**
The arXiv:2603.17150 position paper identifies *compositionality over changes* as an unsolved challenge: ensuring new changes are consistent with accumulated prior changes is a formal verification problem that current agents cannot perform. They treat each change in isolation; they have no compositional model of how changes stack.
- arXiv:2603.17150: ["Intent Formalization: A Grand Challenge for Reliable Coding in the Age of AI Agents"](https://arxiv.org/abs/2603.17150) (Mar 17, 2026): Identifies compositionality over changes as an open formal challenge; codebase evolution blindness is the practical manifestation of this.

## Sources & Further Reading

- [arXiv:2603.03823 — SWE-CI](https://arxiv.org/abs/2603.03823) (Alibaba, Mar 4, 2026): Primary paper; first benchmark of iterative maintenance quality; EvoScore and zero-regression rate; 75% of agents break previously working code; foundational evidence for codebase evolution blindness as a distinct failure mode.
- [angelkurten.com: "AI Agents Are Breaking Your Codebase"](https://angelkurten.com/blog/ai-agents-breaking-codebases) (Mar 2026): Six months of production maintenance data; five named failure modes; practical guardrails; most detailed practitioner account of the failure mode in maintenance contexts.
- [Addy Osmani: "The 80% Problem in Agentic Coding"](https://addyo.substack.com/p/the-80-problem-in-agentic-coding): Frames the maintenance comprehension gap; agents produce the easy 80% quickly but lack the contextual depth to complete the maintenance-critical 20%.
- [CodeRabbit: State of AI vs. Human Code Generation](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report) (2026): 1.7× more issues in AI code; logic and correctness errors up 75%; semantic comprehension failures, not syntax failures.
- [arXiv:2603.17150 — Intent Formalization Grand Challenge](https://arxiv.org/abs/2603.17150) (Mar 17, 2026): Compositionality over changes identified as an unsolved formal challenge; the academic framing of what evolution blindness requires to solve.
- [Towards AI: Benchmarking AI Agents on Code Maintenance](https://pub.towardsai.net/benchmarking-ai-agents-on-code-maintenance-is-finally-here-19e2813ea089) (Mar 2026): Accessible secondary coverage of SWE-CI with analysis of what the benchmark reveals.
- [Stack Overflow Blog: "Are Bugs and Incidents Inevitable with AI Coding Agents?"](https://stackoverflow.blog/2026/01/28/are-bugs-and-incidents-inevitable-with-ai-coding-agents/) (Jan 2026): Industry-level framing; "2025 was the year of AI coding speed; 2026 is the year of AI coding quality" — the shift toward maintenance accountability.
