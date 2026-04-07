Knowledge produced by agents during active work may be provisional or wrong, and if it bleeds into reference material it can corrupt subsequent agent behavior in hard-to-trace ways.

As agents work, they produce artifacts: code, documentation, notes, summaries, inferences. Some of this is reliable. Some of it is the agent's best guess at the time, based on incomplete information or a wrong assumption. If this provisional material gets mixed into the authoritative knowledge that future agents consult, it creates a contamination problem: wrong guesses become reference material, which shapes future behavior, which may entrench the original error further.

This is especially insidious because the contamination is silent. Future agents don't know which parts of their context are vetted human intent and which are unvetted agent inference. They treat it all as ground truth. A wrong assumption that was only ever a working hypothesis can become baked into the system's epistemic foundation.

The problem also affects humans trying to understand what happened. If knowledge from multiple sessions and multiple agents is mixed together without provenance, it becomes very hard to audit — to understand where a belief came from, whether it was ever validated, and whether it should still be trusted.

Maintaining strict separation between provisional knowledge (agent-produced, unreviewed) and authoritative knowledge (human-vetted), with version control and provenance tracking, is essential to preventing this contamination. Without it, the knowledge layer degrades in parallel with the codebase, and both become unreliable guides for future work.

## Related Concepts

**RAG Poisoning**  
In retrieval-augmented generation (RAG) systems, the equivalent problem has been named "RAG poisoning" or "knowledge base poisoning": injecting malicious or inaccurate documents into the retrieval corpus so future agent responses are shaped by wrong information. The agentic coding context features a *non-adversarial* form of the same problem — unvetted agent inferences that enter the knowledge layer through normal operation, not attack. The mechanisms and remedies (provenance tracking, integrity hashing, source separation) are directly applicable.
- Medium / InsTaTunnel: ["RAG Poisoning: Contaminating the AI's 'Source of Truth'"](https://medium.com/@instatunnel/rag-poisoning-contaminating-the-ais-source-of-truth-082dcbdeea7c) (Feb 2026)
- arXiv:2604.00387 — ["RAGShield: Provenance-Verified Defense-in-Depth Against Knowledge Base Poisoning"](https://arxiv.org/abs/2604.00387) (Apr 2026): Proposes cryptographic provenance verification for RAG corpora; directly applicable to agent knowledge layers.

**AgentPoison (Memory Poisoning Research)**  
Academic red-teaming work has demonstrated backdoor attacks on LLM agents via their long-term memory and RAG knowledge bases. The paper "AgentPoison" (Bill Chan et al.) is the first formal treatment of this attack surface. While adversarial, the underlying mechanism — that agents treat retrieved memory as ground truth without provenance checking — is the same as the non-adversarial contamination problem.
- [AgentPoison: Red-Teaming LLM Agents via Poisoning Memory or Knowledge Bases](https://billchan226.github.io/AgentPoison.html)

**Provenance Opacity (AI Risk Taxonomy)**  
A 2025 AI risk taxonomy paper (TechRxiv) identifies "provenance opacity" as a distinct risk in training data and inference behavior — the inability to trace where a belief or behavior originates. In agentic development, provenance opacity in the knowledge layer means humans cannot audit which agent-produced inferences have been incorporated into the authoritative context, making contamination invisible.
- TechRxiv: ["A Comprehensive Introspection on AI Risks: Taxonomy, Challenges, and Mitigation"](https://www.techrxiv.org/doi/pdf/10.36227/techrxiv.175339321.17050891) (Jul 2025): Lists "bias, contamination, poisoning, provenance opacity" as training-data risk categories; framing applies to agent knowledge layers.

**Cross-Agent Contamination**  
MintMCP's analysis of AI agent memory poisoning specifically notes cross-contamination: "When multiple agents share knowledge bases, a single compromised agent can poison the entire system. Cross-contamination occurs automatically." In multi-agent coding workflows (e.g., parallel agents sharing a project context), a single agent's wrong inference can propagate to all other agents in the next session.
- MintMCP: ["AI Agent Memory Poisoning: How Attackers Corrupt Long-Term Memory"](https://www.mintmcp.com/blog/ai-agent-memory-poisoning) (Jan 2026)

**The Attack Surface of Agentic AI**  
A comprehensive March 2026 arXiv survey maps the attack surface of agentic AI, including "knowledge-base poisoning" alongside prompt injection and tool exploits. The survey validates that the knowledge contamination problem is recognized as a first-class security concern (not just an epistemics concern).
- arXiv:2603.22928 — ["SoK: The Attack Surface of Agentic AI — Tools, and Autonomy"](https://arxiv.org/html/2603.22928v1) (Mar 2026)

**Provenance Tracking as Defense**  
The emerging consensus on defense: cryptographic integrity hashing per document, tied to source, author, and timestamp. RAGShield (arXiv:2604.00387) implements this for government RAG systems. The same pattern applies to agentic knowledge layers: every inference should carry provenance metadata so it can be traced back to whether it was human-vetted or agent-generated.
- CyberThrone: ["RAG Poisoning: When the Knowledge Base Becomes the Weapon"](https://thecyberthrone.in/2026/03/16/rag-poisoning-when-the-knowledge-base-becomes-the-weapon/) (Mar 2026): Signal 4 — "Every document in the RAG corpus should carry a cryptographic integrity hash tied to its source, author, and timestamp."

**OWASP Top 10 for Agentic Applications 2026 (Formal Security Taxonomy)**  
The OWASP Agentic AI Top 10 (released Dec 2025, 100+ security experts) canonizes knowledge contamination as a top-tier risk across multiple entries: RAG poisoning, memory poisoning (cross-agent propagation), and cascading failures from corrupted retrieval. This establishes that the problem is not just an epistemics concern — it is a recognized security control failure. Organizations are now legally exposed if they fail to implement provenance controls in agentic systems regulated under frameworks like the EU AI Act.
- OWASP: ["Top 10 for Agentic Applications 2026"](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) (Dec 2025)
- Blackbird.AI: ["Poisoned at the Source: AI Training Data Is Under Attack"](https://blackbird.ai/blog/poisoned-at-the-source-ai-training-data-is-under-attack/) — frames OWASP Agentic Top 10 risk pattern around poisoned data as the central threat vector

**EU AI Act Article 10 & Data Governance**  
EU AI Act Article 10 mandates data governance requirements for high-risk AI systems. RAG/knowledge-base contamination is now explicitly in scope: an organization that allows unvetted agent inferences to enter its authoritative knowledge layer without provenance controls is potentially non-compliant. The intersection of the technical problem with regulatory obligation is a new development in early 2026.
- Amin Rajaee: ["RAG Poisoning and EU AI Act Article 10: Data Governance Is Not Optional"](https://aminrj.com/posts/rag-poisoning-article-10-data-governance/) (Mar 26, 2026)

**"When RAG Lies": Link-Injection Attack Surface (SANER 2026)**  
A short paper at SANER 2026 (the IEEE Software Analysis, Evolution, and Reengineering conference) identifies a specific novel contamination vector: malicious hyperlinks injected into RAG knowledge bases for code generation systems. An agent that follows links while building context can retrieve adversarially crafted content that poisons subsequent code generation. This is relevant to non-adversarial contamination too — legitimate external links in project documentation can introduce stale or incorrect content into agent context without anyone intending harm.
- SANER 2026: ["When RAG Lies: Link-Injection Knowledge-Base Poisoning in Code Generation"](https://conf.researchr.org/details/saner-2026/saner-2026-short-papers-and-posters-track/19/When-RAG-Lies-Link-Injection-Knowledge-Base-Poisoning-in-Code-Generation) (Mar 19, 2026)

**CorruptRAG (Jan 2026): Single-Document Poisoning**  
Research published Jan 2026 introduces CorruptRAG, demonstrating that a single poisoned document injection is sufficient to corrupt agent behavior — the threshold for contamination is much lower than assumed. This is directly relevant to non-adversarial contamination: a single session where an agent records a wrong inference into the project's knowledge store may be sufficient to corrupt future sessions.
- arXiv:2602.04711 — ["Addressing Corpus Knowledge Poisoning Attacks on RAG Using Anomaly Detection"](https://arxiv.org/abs/2602.04711) (Feb 4, 2026)

**Relationship to Agentic Supply-Chain Attacks**  
A closely related but distinct problem has emerged: agents hallucinating package names that attackers have pre-registered (slopsquatting / hallucination squatting), and agent infrastructure dependency chains being poisoned directly (e.g., the LiteLLM PyPI incident, Mar 2026). These share the contamination vector name but differ in mechanism: unvetted knowledge contamination is *accidental* pollution of the knowledge layer by agent-generated provisional data; supply-chain attacks are *adversarial* exploitation of agent trust and automation. Both result in contaminated artifacts entering the build. See `agentic-supply-chain-attack.md` for the full treatment.

## Sources & Further Reading

- [arXiv:2604.00387 — RAGShield](https://arxiv.org/abs/2604.00387) (Apr 2026): Most technically rigorous treatment of provenance-verified knowledge bases; directly applicable to agent knowledge layer design.
- [arXiv:2603.22928 — Attack Surface of Agentic AI](https://arxiv.org/html/2603.22928v1) (Mar 2026): Comprehensive taxonomy of agentic AI attack vectors; validates knowledge contamination as a recognized first-class concern.
- [OWASP Agentic Top 10 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) (Dec 2025): First industry-standard security taxonomy for agentic AI; knowledge contamination appears across multiple entries.
- [Amin Rajaee: RAG Poisoning and EU AI Act Article 10](https://aminrj.com/posts/rag-poisoning-article-10-data-governance/) (Mar 26, 2026): Connects knowledge contamination to regulatory compliance obligations; the clearest framing of provenance as a legal requirement.
- [SANER 2026: "When RAG Lies"](https://conf.researchr.org/details/saner-2026/saner-2026-short-papers-and-posters-track/19/When-RAG-Lies-Link-Injection-Knowledge-Base-Poisoning-in-Code-Generation) (Mar 2026): Identifies link-injection as a contamination vector via external URLs in project documentation.
- [AgentPoison](https://billchan226.github.io/AgentPoison.html): First formal backdoor attack via agent memory poisoning; demonstrates the mechanism that unvetted knowledge contamination exploits (non-adversarially).
- [MintMCP: AI Agent Memory Poisoning](https://www.mintmcp.com/blog/ai-agent-memory-poisoning) (Jan 2026): Practical analysis of cross-agent contamination in shared knowledge environments.
- [Medium: RAG Poisoning](https://medium.com/@instatunnel/rag-poisoning-contaminating-the-ais-source-of-truth-082dcbdeea7c) (Feb 2026): Accessible introduction to the RAG poisoning class of problems, with attack anatomy and detection signals.
