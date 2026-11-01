# Optional AI Capabilities for Solid Applications

**Status:** Deferred design note (not approved for implementation)  
**Scope:** Solid apps, workspace/launcher, capability broker  
**Related designs:** `solid-capability-broker-roadmap.md`, `solid-semantic-clipboard-design.md`, `solid-semantic-open-with-design.md`

## Intent

AI assistance should be an **optional capability provider**, not a privileged subsystem or a dependency of the workspace. A user may install, select, configure, replace, or remove an AI helper just like any other application. Essential Solid workflows must continue without AI.

The architecture uses the existing model: user-controlled data in Solid, URI-identified capabilities, a replaceable broker, and independently usable applications. No AI-specific broker protocol is needed.

## Principles

1. **Opt in.** No AI provider is installed, enabled, invoked, or given data by default.
2. **Replaceable.** The user chooses providers, possibly different ones for different capabilities. A local provider must be possible where technically feasible.
3. **No final say.** AI proposes interpretations, configurations, mappings, or changes; consequential actions require user approval and are performed by ordinary applications through their existing authorization paths.
4. **No extra authority.** Installing or selecting an AI provider does not authorize it to read the user's pod, clipboard, other app messages, or credentials. Requests carry the minimum task-scoped information; any further access requires explicit authorization.
5. **No dependence.** Removing every AI provider must leave core application functionality, data, and saved workspaces usable.
6. **Inspectable output.** Durable AI-assisted results should be understandable without the AI: ordinary workspace configuration, linked data, small adapters, tests, and provenance when relevant.
7. **No hidden AI path.** Applications should not silently fall back to AI when deterministic matching or normal operations fail.

## Possible capabilities (illustrative, not standardized)

Each capability is identified by a dereferenceable URI, for example under `https://vocab.muze.nl/capabilities/`:

| Capability | Input | Output | Responsible for applying result |
|---|---|---|---|
| `suggest-application` | User goal, available application descriptors | Ranked suggestions with reasons | User / launcher |
| `suggest-shape` | Selected RDF graph or bounded sample, known shapes | Candidate interpretations with uncertainty | User / file manager |
| `propose-mapping` | Two shape descriptions and examples | Proposed deterministic mapping, assumptions, test cases | Developer / reviewed bridge |
| `compose-workspace` | User goal, registered capabilities | Proposed workspace entries and connections | User / workspace |

These URI paths are **proposals**, not published vocabulary. Input/output contracts should use linked data and reuse shared vocabularies and shapes where suitable. AI suggestions must be distinguishable from verified matches and tested implementations.

## Minimal interaction

1. A user explicitly requests help in an application.
2. The application looks up the user's selected provider for the relevant capability using the existing registry.
3. The application presents the information to be shared and obtains appropriate consent; access is limited to the request.
4. The broker connects requester and provider using the ordinary capability protocol.
5. The provider returns a **proposal**, not an instruction that automatically executes.
6. The user reviews the proposal. Any accepted change is carried out by a normal application subject to its existing permissions.

No special broker rights, omniscient assistant context, central AI registry, or persistent agent authority are introduced.

## Risks to revisit

- **Disclosure:** RDF resources and clipboard references may expose sensitive details even without full document access.
- **Consent fatigue:** Requests must be comprehensible, not a stream of meaningless approval prompts.
- **Semantic mistakes:** Suggested shape matches and mappings may look plausible yet change meaning. Use tests and human review before treating them as verified.
- **Dependency creep:** Convenience features could make AI effectively mandatory; retain usable manual workflows.
- **Provider claims:** A provider's capability advertisement is not proof of its behavior, privacy practices, or competence.
- **Local models:** Any local AI option must satisfy Muze's AI-ethics boundaries; do not assume a locally executable model is ethically unproblematic.

## Future acceptance test

1. Assemble a useful Solid workspace with the AI helper **absent**. Confirm that launching, browsing, semantic opening, clipboard selection, and core cross-app capabilities work.
2. Install one AI helper as a normal capability provider. Explicitly invoke a limited capability, such as `suggest-application`; inspect the shared input and proposed output.
3. Approve a proposed workspace change and verify that it becomes ordinary, understandable Solid configuration.
4. Replace the AI provider with another implementation without changing consumer applications.
5. Remove all AI providers. Verify that the workspace, saved data, and deterministic workflows still work and that no background requests reach an AI provider.

## Deferred decisions

Exact capability URIs and shapes, consent UX, provider trust/verification, local-model packaging, and whether AI-generated adapters can be published to a shared catalogue remain open. Resolve these only when a concrete use case requires them.

**Implementation priority:** None for now. Preserve the boundaries above when evolving the broker, registry, workspace, and application APIs.
