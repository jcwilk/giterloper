Every line an agent writes without explicit human direction embeds an assumption about intent, and these assumptions compound silently over time.

When a human gives a directive, the agent must make many micro-decisions to fulfill it: how to structure a function, what to name a variable, what edge cases to handle, what to ignore. Each of these is a guess. Most guesses are fine. But some embed a wrong assumption about what the system is supposed to do at a deeper level — not just stylistically wrong, but semantically wrong.

The dangerous part isn't any single wrong assumption. It's that subsequent code is built on top of it. The wrong assumption becomes load-bearing. Other code aligns itself to the assumed behavior. Refactoring around it becomes expensive. Identifying it as the root cause of a problem becomes difficult because the surface manifestation is distant from the original wrong turn.

This is analogous to how technical debt compounds in traditional development, except it's faster, harder to see, and easier to generate in volume. A single session with an agent can embed more compounding assumptions than weeks of human-written code.

The antidote is not to ask agents to make fewer assumptions — that would paralyze them. It's to create mechanisms that surface assumptions explicitly, allow humans to audit them at a cadence they can sustain, and make wrong assumptions cheap to catch and correct early.

## Related Concepts

**Compounding Error Problem (Multi-Agent Reliability Math)**  
The mathematical formalization most directly related: if each agent step has probability *p* of success, a sequential pipeline of *n* steps has success probability *pⁿ*. A 95%-reliable agent across 10 steps yields ~60% overall success. This is Lusser's Law (named for German reliability engineer Robert Lusser, pioneer of aerospace reliability theory), applied to LLM pipelines. The compound *semantic* assumption problem described here is distinct but analogous — wrong assumptions don't manifest as hard failures, they manifest as silent misalignment, which makes them harder to detect than the numeric reliability problem.
- Zartis engineering blog: ["The Compounding Errors Problem: Why Multi-Agent Systems Fail"](https://www.zartis.com/the-compounding-errors-problem-why-multi-agent-systems-fail-and-the-architecture-that-fixes-it/)
- Towards Data Science: ["The Multi-Agent Trap"](https://towardsdatascience.com/the-multi-agent-trap/) — sequential step math illustrated concretely
- O'Reilly Radar: ["The Hidden Cost of Agentic Failure"](https://www.oreilly.com/radar/the-hidden-cost-of-agentic-failure/) (Feb 2026) — "the Multi-Agent Reliability Tax"

**AI Technical Debt (Assumption-Based)**  
Augment Code's analysis frames the mechanism precisely: AI code "looks correct by design" (syntactically valid, stylistically consistent) but embeds assumption errors invisible to code review. They note AI tools produce 3–4× the code volume of human engineers, multiplying the assumption surface. Their proposed remedy — spec-driven development — treats specifications as executable contracts so drift triggers build failures rather than silent accumulation.
- Augment Code: ["What Happens When AI Technical Debt Compounds"](https://www.augmentcode.com/guides/ai-technical-debt-compounds-spec-driven-development) (Apr 2026)

**Graceful Failure in Compound Systems**  
In traditional software an error produces a detectable signal (crash, exception, null). Compound AI systems tend instead toward *graceful degradation into wrongness* — outputs that are plausible but wrong, with no signal surface. This makes assumption errors in agent code particularly dangerous.
- Mark J. Williams on Medium: ["Designing for Graceful Failure in Compound AI Systems"](https://medium.com/@markjwilliams/designing-for-graceful-failure-in-compound-ai-systems-fc3b9dabdcd3) (Mar 2026)

**Load-Bearing Wrong Assumptions**  
The concept of a wrong assumption becoming structural (subsequent code aligns to assumed behavior, making correction expensive) mirrors what software engineers call *architectural debt* — decisions that seemed local but propagated system-wide. Unlike stylistic debt, architectural debt must be paid with wholesale refactoring. Agent-generated architectural debt accrues faster because agents produce more code per unit time than humans.

**Error Cascading (Named Concept, Apr 2026)**  
The agentic development community has now named the downstream failure pattern directly: "error cascading" is when a single agent's wrong assumption becomes amplified as downstream agents build on incorrect outputs. LearnaGentic's analysis (Mar 2026) describes this as distinct from Lusser's Law (which is about raw failure probability) — error cascading is about *semantic* propagation of wrongness through a pipeline, where each step makes the original error harder to detect.
- LearnaGentic: ["What is Error Cascading in Multi-Agent Systems?"](https://learnagentic.substack.com/p/what-is-error-cascading-in-multi) (Mar 2026)

**OWASP ASI08: Cascading Failures (Security Framing)**  
The OWASP Top 10 for Agentic Applications (2026) codifies cascading failure as a first-class security risk (ASI08): "A cascading failure in agentic AI occurs when a single fault — hallucination, malicious input, corrupted tool, or poisoned memory — propagates across the agent network." This extends assumption compounding into a formal security model, with mitigation patterns including circuit breakers, sandboxing, and fallback checkpointing.
- OWASP: ["Top 10 for Agentic Applications 2026"](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) (Dec 2025)
- Adversa AI: ["Cascading Failures in Agentic AI: Complete OWASP ASI08 Security Guide 2026"](https://adversa.ai/blog/cascading-failures-in-agentic-ai-complete-owasp-asi08-security-guide-2026/)

**Gartner's Production Failure Forecast**  
Gartner projects that over 40% of agentic AI projects will be cancelled by 2027 (RAND estimates total AI project failure rate is even higher). The primary mechanism cited is compound failure from undetected assumption errors accumulating in production pipelines.
- Medium/System Design Mastery: ["Why Your Agentic AI System Will Fail (And How to Design Around It)"](https://medium.com/system-design-mastery-series/why-your-agentic-ai-system-will-fail-and-how-to-design-around-it-6e9e9d2b85c0) (Mar 13, 2026)

**Silent Error Swallowing (Production Case Study)**  
A notable 2026 production case: an agent "consistently approved a specific pattern of error handling that technically compiled and passed tests but silently swallowed exceptions" — a compound assumption failure where a wrong micro-decision about error handling became structural.
- Level Up Coding: ["5 Real Projects Where Agentic AI Failed Badly in 2026"](https://levelup.gitconnected.com/5-real-projects-where-agentic-ai-failed-badly-in-2026-and-what-engineers-learned-from-it-2d0fedcb8e3d) (Mar 2, 2026)

**SWE-CI: Long-Term Maintenance Failures (Alibaba / arXiv, Mar 2026)**  
A new benchmark (SWE-CI) directly measures assumption compounding over time: 100 real open-source projects tracked across 233 days each. Finding: 75% of models break previously working code during maintenance tasks, even when they pass the immediate test suite. Only Claude Opus 4.5/4.6 maintained >50% pass rate over the full time horizon. This is assumption compounding made measurable — assumptions embedded during initial development become increasingly costly as maintenance tasks require reasoning about the accumulated state. The benchmark distinguishes between one-shot patch quality (what SWE-bench measures) and iterative maintenance quality (what SWE-CI measures), and shows that the latter is dramatically worse.
- arXiv:2603.03823: ["SWE-CI: Evaluating Agent Capabilities in Maintaining Codebases Over Evolving Environments"](https://arxiv.org/abs/2603.03823) (Mar 4, 2026): Primary paper; 18 agents tested; 75% break existing functionality during maintenance.
- Towards AI: ["Benchmarking AI Agents on Code Maintenance Is Finally Here"](https://pub.towardsai.net/benchmarking-ai-agents-on-code-maintenance-is-finally-here-19e2813ea089) (Mar 11, 2026): "The core difference: SWE-bench measures one-shot patch quality; SWE-CI measures iterative maintenance quality over dozens of rounds."

**Intent Formalization: A Grand Challenge (arXiv, Mar 2026)**  
A position paper from a group of software engineering researchers identifies assumption compounding (under the framing of "intent formalization") as one of seven grand open problems for reliable coding in the age of AI agents. They argue that without mechanisms to formalize and verify change intent, assumption accumulation is structurally guaranteed. Their key claim: compositionality over changes — ensuring new changes are consistent with accumulated prior assumptions — is an unsolved formal verification challenge.
- arXiv:2603.17150: ["Intent Formalization: A Grand Challenge for Reliable Coding in the Age of AI Agents"](https://arxiv.org/abs/2603.17150) (Mar 17, 2026): Seven open problems in reliable agentic coding; assumption compounding framed as a formal verification challenge.

## Sources & Further Reading

- [Lusser's Law — MIL-HDBK-338B](https://www.navsea.navy.mil/Portals/103/Documents/NSWC_Crane/SD-18/Test%20Methods/MILHDBK338B.pdf): Original reliability engineering principle that "the reliability of a series system is equal to the product of the reliability of its component subsystems." Foundational framing for understanding compound failure math.
- [Compounding Error Problem (LinkedIn / Sophie Halbeisen)](https://www.linkedin.com/posts/sophie-halbeisen-5449a23a_i-cant-stop-thinking-about-the-compounding-activity-7401711284502700032-NflS) (Dec 2025): Practitioner discussion of *latent errors* — assumption errors that slip through early review and become entrenched.
- [Compound Failure (Marek Kowalkiewicz, Substack)](https://marekkowal.substack.com/p/compound-failure) (Sep 2025): Clear framing of sequential reliability as a product of individual agent reliabilities; applies Lusser's Law directly to agentic workflows.
- [LearnaGentic: "What is Error Cascading in Multi-Agent Systems?"](https://learnagentic.substack.com/p/what-is-error-cascading-in-multi) (Mar 2026): Distinguishes semantic error cascading from numerical reliability failure; describes propagation patterns and detection strategies.
- [OWASP Agentic Top 10 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) (Dec 2025): ASI08 (Cascading Failures) is the first industry-standard security taxonomy entry for this failure mode.
- [Prodigal Tech: "Why Most AI Agents Fail in Production"](https://www.prodigaltech.com/blog/why-most-ai-agents-fail-in-production): Reliability math applied to production agent pipelines.
- [Augment Code: Spec-Driven Development guide](https://www.augmentcode.com/guides/what-is-spec-driven-development) (Feb 2026): The most developed practitioner framework for preventing assumption compounding via executable specs.
- [arXiv:2603.03823 — SWE-CI](https://arxiv.org/abs/2603.03823) (Mar 4, 2026): First empirical benchmark of assumption compounding over time; 75% of models break prior functionality during maintenance; 233-day timeline across 100 real codebases.
- [arXiv:2603.17150 — Intent Formalization Grand Challenge](https://arxiv.org/abs/2603.17150) (Mar 17, 2026): Frames compositionality over changes as an unsolved formal verification problem; the academic framing of what assumption compounding requires to solve.
