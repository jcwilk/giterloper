Agents introduce novel supply-chain attack vectors through hallucinated package names and unaudited dependency chains, enabling targeted exploitation without traditional phishing or vulnerability exploitation.

## Description

Agentic development systems face a distinct category of supply-chain risk that did not exist in purely human-authored software development. Two related but separate attack surfaces have emerged:

1. **Slopsquatting / Hallucination Squatting**: LLMs hallucinate package names (a structural property of probabilistic language generation). Attackers register these hallucinated names as real packages before anyone else. When an agent recommends or autonomously installs the hallucinated name, it installs the attacker's payload instead of a legitimate library.

2. **Unaudited Agent Dependency Chains**: AI agent infrastructure frameworks (LangChain, LiteLLM, CrewAI, AutoGen) carry large transitive dependency trees that are rarely reviewed. Attackers inject malicious code into legitimate packages that are deeply embedded in these chains, exploiting the fact that agents run continuously with elevated permissions and hold credentials for every service they integrate with.

These are distinct from traditional supply-chain attacks because:
- **No human typo required**: Slopsquatting exploits AI consistency, not human error. LLMs hallucinate the same package name repeatedly and confidently.
- **Confidence masking**: LLMs do not express uncertainty when recommending hallucinated packages, removing the cues that might prompt a developer to verify.
- **Autonomous execution**: In agentic coding workflows, the installation may happen without human confirmation, eliminating the verification step that would normally catch a suspicious name.
- **Rich credential harvest**: Agent processes hold API keys, cloud tokens, database credentials, SSH keys, and CI/CD secrets — making them a far richer target than a typical developer workstation.

## Slopsquatting Mechanics

Researchers at USENIX Security 2025 tested 16 models across 576,000 code samples and found that package hallucinations follow three predictable patterns:
- **Conflation (38%)**: Model mashes two real related packages together — e.g., `express-mongoose` (real: `express` + `mongoose` separately), `react-codeshift` (real: `jscodeshift` + `react-codemod`).
- **Pure fabrication (51%)**: Package name that doesn't correspond to any real package in any ecosystem.
- **Cross-ecosystem transplant (13%)**: Real package from the wrong ecosystem (e.g., an npm package name suggested for PyPI, or vice versa). Note: 8.7% of AI-hallucinated Python package names are valid JavaScript packages.

The hallucination patterns are *consistent and repeatable* — the same model suggests the same fake name across different users and sessions. This is what makes slopsquatting economically viable: an attacker can systematically test what names a model hallucinates for a given task domain, then register the top results before anyone else.

**Proven exploitation path (2024 proof-of-concept)**: Bar Lanyado (Lasso Security) observed AI models repeatedly hallucinating `huggingface-cli` as an install command (real install: `pip install -U "huggingface_hub[cli]"`). He registered the package on PyPI as an empty placeholder. It received 30,000+ authentic downloads in three months, including from Alibaba's public repositories where the hallucinated command had been copy-pasted into a README. The name spread organically without any promotional effort.

**Organic spreading through agent infrastructure (Jan 2026)**: Charlie Eriksen (Aikido Security) found the npm package name `react-codeshift` (a hallucination conflating `jscodeshift` and `react-codemod`) embedded in 47 LLM-generated Agent Skills in a single GitHub commit — no human had apparently tested the generated instructions. By the time it was discovered, the name had propagated to 237 repositories through forks and been translated into Japanese. Real AI agents were making daily `npx` install attempts against the unclaimed name. Had an attacker registered it first, a self-spreading slopsquatting attack would have been running silently in production agent environments.

## Agent Infrastructure as an Attack Target

The March 2026 LiteLLM incident demonstrated the second attack surface in production:

LiteLLM versions 1.82.7 and 1.82.8 contained a malicious `.pth` file injected into the PyPI package. Python's `.pth` mechanism executes arbitrary Python code on interpreter startup — before application code, before any import, before any sandbox check. The payload targeted:
- `~/.config` and `~/.aws` credential files
- Environment variables containing `KEY`, `SECRET`, `TOKEN`, `PASSWORD`
- Active Kubernetes context files
- SSH agent-forwarded keys
- Crypto wallet seed files

LiteLLM is used as a unified LLM API layer in LangChain, CrewAI, AutoGen, and dozens of other agent frameworks. One injected package poisoned entire agent stacks. The HN discussion hit #5 with 202 points within hours of discovery.

Why agent infrastructure is specifically targeted:
1. **Continuous execution**: Agents run as persistent services, not one-time scripts — compromise yields ongoing exfiltration, not a snapshot.
2. **Credential aggregation**: A single agent stack may hold API keys for OpenAI, Anthropic, Google Cloud, AWS, email, GitHub, Slack, and more — far richer than a single developer's `.env`.
3. **Large unaudited dependency chains**: `pip install langchain` pulls in hundreds of transitive dependencies. Most agent builders never audit them.
4. **Elevated OS permissions**: Agents that execute shell commands, browse the web, or send emails typically run with access to the user's home directory and environment — the exact credential locations attackers target.

## Relationship to Other Problems

- **Unvetted knowledge contamination** (`unvetted-knowledge-contamination.md`): That problem covers agent-generated provisional knowledge entering the knowledge base as if it were verified. This problem is distinct: it covers the supply chain itself being compromised through hallucinated package names or injected malicious code in real packages. The mechanism is different (attack by adversary vs. erosion by accident), though both result in contaminated artifacts entering the build.
- **Sparse directive problem** (`sparse-directive-problem.md`): Vibe coding (rapid prototyping following AI suggestions without deep review) is explicitly identified in the USENIX analysis as a risk multiplier for slopsquatting. When developers don't understand what they're building, they're less likely to notice a suspicious package name.
- **Review asymmetry** (`review-asymmetry.md`): In fully agentic workflows, the human review step for package installations may be eliminated entirely. This is the threat model slopsquatting is specifically built around.

## Known Mitigations

**For slopsquatting:**
- Verify package publisher, not just package name. A package claiming to be an eslint plugin with no maintainer history and a registration date of last Tuesday is a red flag regardless of download count.
- Treat autonomous package installation as a privileged operation. Agentic workflows with bypass-mode permissions (e.g., Claude Code with `--permission-mode bypassPermissions`) eliminate the confirmation step that would catch suspicious names.
- Use SCA (software composition analysis) scanners on the full dependency tree, not just `package.json` / `requirements.txt` — hallucinated names can appear as transitive dependencies.
- Aikido SafeChain (open source) wraps `npm`, `npx`, `yarn`, and `pnpm` to intercept install commands and check against Aikido Intel before installation.

**For unaudited dependency chains:**
- Pin all package versions in agent production environments (`requirements.txt` with hash verification: `pip install --require-hashes`).
- Run `pip-audit` / `npm audit` on a scheduled basis; treat critical findings as incidents.
- Run each agent as an isolated OS user with no home directory access, no access to `~/.aws`, `~/.config`, `~/.ssh`.
- Scope credentials per agent — one agent, one set of scoped API keys. One compromised agent should not yield credentials for the entire stack.
- Separate Python venvs (or containers) per agent; a single compromised package should not poison all agents on the same interpreter.

## Related Concepts

**Typosquatting (supply chain precursor)**: Slopsquatting is typosquatting's AI-era successor. Classical typosquatting bets on human typing errors (`crossenv` for `cross-env`). Slopsquatting bets on LLM hallucination patterns. npm now has protections against names "too similar" to existing packages — these protections don't apply to hallucinated names because there is no existing package they resemble.

**Dependency confusion attacks (Alex Birsan, 2021)**: Birsan demonstrated that internal package names could be superseded by malicious public packages with the same name. Slopsquatting extends this concept to names that don't yet exist anywhere — attackers pre-register future hallucinations.

**Software composition analysis (SCA)**: The standard enterprise practice for auditing dependency trees against known-vulnerable versions; increasingly necessary for agent infrastructure given the size and opacity of framework dependency chains.

**Least-privilege principle**: Classical security engineering principle directly applicable to agent credential management. Agents that hold only the credentials they need for their specific task have a contained blast radius on compromise.

**Prompt injection as a related attack vector**: Attackers who can inject into an agent's context (through web content, repository files, email) can instruct the agent to install specific packages. This combines prompt injection with slopsquatting — the agent is directed to a malicious package by adversarial content it encounters during task execution. See: `unvetted-knowledge-contamination.md`.

**Machine identity bankruptcy and permission creep**: The larger structural context for why agent supply-chain compromises are catastrophic is the explosion of *non-human identities* (NHIs) in modern infrastructure. Entro Security's NHI & Secrets Risk Report (2025) found that NHIs now outnumber human identities at an enterprise 144:1 ratio (56% jump from 92:1 in H1 2024); 97% of NHIs carry excessive privileges; and just 0.01% of machine identities control 80% of cloud resources. When a single agentic framework package (like LiteLLM) is compromised, it gains access to the credentials of every integrated service that any agent held — API keys, cloud tokens, SSH keys — because agents are routinely over-permissioned (under deadline pressure, teams grant admin-level service accounts to avoid "permission denied" CI failures). OWASP's Top 10 Non-Human Identity Risks (2025) ranks improper offboarding as risk #1. The MCP-38 threat taxonomy (arXiv:2603.18063, Mar 2026) enumerates 38 threat categories specific to the Model Context Protocol, with permission creep explicitly catalogued as a named threat pattern.
- arXiv:2603.18063: ["MCP-38: A Comprehensive Threat Taxonomy for Model Context Protocol Systems"](https://arxiv.org/abs/2603.18063) (Mar 18, 2026): 38-category threat taxonomy for MCP; permission creep is a named category.
- InstaTunnel: ["Machine Identity Bankruptcy: The Identity Crisis No One Is Talking About"](https://medium.com/@instatunnel/machine-identity-bankruptcy-the-identity-crisis-no-one-is-talking-about-13d7512872ff) (Feb 21, 2026): 144:1 NHI-to-human ratio; 97% of NHIs over-permissioned; anatomy of lateral movement kill chain through machine identities; why agentic AI amplifies this risk.
- Entro Security: NHI & Secrets Risk Report (H1 2025): 44% of all tokens actively exposed; secrets surface in Jira tickets, Confluence, Slack messages, and CI/CD logs — not just code.
- OWASP Top 10 Non-Human Identity Risks 2025: Improper offboarding ranked #1.

## Sources & Further Reading

- [Aikido Security: "Slopsquatting: The AI Package Hallucination Attack"](https://www.aikido.dev/blog/slopsquatting-ai-package-hallucination-attacks) (Feb 20, 2026): Most comprehensive named treatment; concrete examples including `unused-imports` (confirmed malicious) and `react-codeshift` (self-spreading agent hallucination); mitigation strategies.
- [Charlie Eriksen / Aikido: "Agent Skills Spreading Hallucinated npx Commands"](https://www.aikido.dev/blog/agent-skills-spreading-hallucinated-npx-commands) (Jan 2026): Documents `react-codeshift` spreading to 237 repositories organically through fork chains; proves real agents are executing hallucinated install commands in production.
- [Bar Lanyado / Lasso Security: "AI Package Hallucinations"](https://www.lasso.security/blog/ai-package-hallucinations) (2024): Proof-of-concept that registered `huggingface-cli` on PyPI and received 30,000+ authentic downloads; first empirical demonstration that slopsquatting is viable.
- [USENIX Security 2025: "We Have a Package for You — Comprehensive Analysis of Package Hallucinations in Code"](https://www.usenix.org/publications/loginonline/we-have-package-you-comprehensive-analysis-package-hallucinations-code): 16 models × 576,000 code samples; 38% conflation / 51% fabrication / 13% cross-ecosystem; hallucination patterns are consistent and repeatable; RAG whitelisting is insufficient because attackers can pre-register.
- [Snyk: "Package Hallucination: Impacts and Mitigation"](https://snyk.io/articles/package-hallucinations/): Developer-focused analysis of the hallucination failure mode with mitigation guidance; good secondary source.
- [Roberto Capodieci: "LiteLLM Got Owned: What the PyPI Supply Chain Attack Means for Your AI Agent Stack"](https://capodieci.medium.com/ai-agents-021-litellm-got-owned-what-the-pypi-supply-chain-attack-means-for-your-ai-agent-stack-e3b73fe86ad3) (Mar 25, 2026): Real incident analysis; LiteLLM 1.82.7/1.82.8 `.pth` credential stealer; why agent stacks are specifically attractive targets; concrete audit and hardening steps.
- [Reddit r/AI_Agents: "AI Agents Keep Recommending Packages That Don't Exist"](https://www.reddit.com/r/AI_Agents/comments/1rus0xm/ai_agents_keep_recommending_packages_that_dont/) (Mar 15, 2026): Practitioner thread on the frequency of package hallucinations in agentic workflows; community-developed mitigations.
- [Cursor Forum: "Is Anyone Else Worried About AI Package Hallucination?"](https://forum.cursor.com/t/is-anyone-else-worried-about-ai-package-hallucination-in-their-builds/154658): Practitioner discussion from IDE-level agentic coding users; frequency reports and workarounds.
- [Aikido SafeChain (GitHub)](https://github.com/AikidoSec/safe-chain): Open source wrapper for npm/npx/yarn/pnpm; intercepts installs and validates against Aikido Intel.
- [Aikido Intel](https://intel.aikido.dev/): Real-time package reputation database; searchable for known malicious packages.
- [arXiv:2603.18063 — MCP-38](https://arxiv.org/abs/2603.18063) (Mar 18, 2026): 38-category threat taxonomy for Model Context Protocol systems; permission creep catalogued as a named threat; the first protocol-specific security taxonomy for agentic tool-use infrastructure.
- [InstaTunnel: "Machine Identity Bankruptcy"](https://medium.com/@instatunnel/machine-identity-bankruptcy-the-identity-crisis-no-one-is-talking-about-13d7512872ff) (Feb 21, 2026): 144:1 non-human-to-human identity ratio in enterprise environments; 97% of machine identities over-permissioned; anatomy of lateral movement kill chain; context for why agent supply-chain compromises yield catastrophic credential harvests.
- [Entro Security: NHI & Secrets Risk Report H1 2025](https://www.entro.security): 44% of tokens actively exposed; 0.01% of machine identities control 80% of cloud resources; secrets appearing in collaboration tools, not just code.
- [OWASP Top 10 Non-Human Identity Risks 2025](https://owasp.org/www-project-non-human-identities-top-10/): Improper offboarding ranked #1; industry standard reference for machine identity governance.
