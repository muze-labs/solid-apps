# Adopted engineering culture

Adoption authority: the maintainer-supplied [AGENTS.md](../AGENTS.md).
This record makes the existing adoption explicit; it does not introduce a new
organization culture or change the adopted profiles.

## Pinned profiles and scope

For the engineering and library stewardship profiles:

Source repository: `https://github.com/muze-labs/spiral-developer`.
Inspected submodule version: `3c93481336d0e771110a9437c6039df6d7ce078b`.
The submodule path is `.spiral-core`; these are cross-repository source versions,
not historical commits claimed to belong to the Solid Apps repository.

| Profile | Source | Scope |
| --- | --- | --- |
| CUL-MUZE-001: Muze Engineering Culture | [Pinned profile](../.spiral-core/cultures/muze-engineering.md) | Engineering choices across the suite. |
| CUL-MUZE-LIB-001: Muze Library Stewardship | [Pinned profile](../.spiral-core/cultures/muze-library-stewardship.md) | Muze-owned shared packages and developer tooling; not a requirement for other developers' app stacks. |
| Muze architecture philosophy | [Repository copy](../ARCHITECTURE-PHILOSOPHY.md) | Readable, correctable architecture and coding preferences across the suite. |

AGENTS.md also explicitly adopts the maturity policy linked there. Its adoption
and the architecture philosophy's adoption predate intake. The remote maturity-policy
version has not been independently checked or pinned during intake.

### Architecture philosophy source

The maintainer requested an in-repository copy as another engineering culture
document on 2026-11-01. The complete guide was read and copied unchanged from
`/home/auke/git/muze-labs/ARCHITECTURE-PHILOSOPHY.md` to the repository root.
AGENTS.md now links to this local copy, so adoption no longer depends on a
parent-directory file being available.

- Title: **Architecture for readable, correctable software**.
- Source dates: prepared 2026-09-19; updated 2026-09-27.
- SHA-256: `fc010970867fe54aa3437a7fd2687c333e65d04c1f0ddd97757ad37d7b4b0ad1`.
- Local modifications to the guide: none. Its sources and status are retained.
- The source parent directory is not a Git repository; no upstream commit
  identity is claimed. Later updates should be explicit, reviewed changes.

Apply its guidance on affordable correction, domain vocabulary, coherent
abstraction levels, cohesive ownership, policy/mechanism boundaries, timing and
failure contracts, observable verification, shared-data preservation and
discoverable rationale. It explicitly rejects architectural rewrites or extra
approval ceremonies merely to demonstrate adherence. Project requirements and
current maintainer instructions remain authoritative.

## Application here

Use the adopted profiles to choose between acceptable designs: early meaningful
feedback, correctable boundaries, bounded assumptions, small useful components,
web-native mechanisms, inspectability, replaceability and user-controlled data.
Specific project requirements and current maintainer instructions take priority.
Explain material deviations rather than treating preferences as universal law.

The developer showcase demonstrates this stack, while its ecosystem capabilities
must remain available to independently implemented apps using other libraries.
Keep app-specific assumptions here until demonstrated reuse earns a lower layer.
Preserve the experimental package and publication boundaries in AGENTS.md.

The five retained [Weblets sources](project-context.md) provide project-specific
design context, not an agent-invented extension of Muze culture. Seek maintainer
guidance when undocumented reasoning materially affects a decision.

## Distinct profile layers

The [risk-discovery profile](risk-profile.md) guides what to investigate.
Warning profiles guide scrutiny of consequential decisions. The maintainer
separately adopted [WPF-HUMAN-001](warning-profiles/README.md) during intake.
Culture adoption does not activate warning profiles automatically.

## Mandatory native Turtle representation

The maintainer's [direct instruction](sources/SRC-20261101-QG24H-17.md) makes
Turtle the native persistence format and forbids JSON inside Turtle string
literals, including rdf:JSON, with only the explicit narrow experiment below. This is a hard project constraint,
not a discretionary culture preference. It covers Pod data, local Turtle caches,
fixtures and migrations. Use native RDF structures; if representation is unclear,
explain the concrete issue and resolve it with the maintainer before writing.
AGENTS.md records the operational rule. The current workspace JSON encoding is
noncompliant and requires correction; this note does not migrate existing data.

The maintainer additionally permits an app-owned opaque state string alongside
the native linked-data main state, with interpretation left to the app. This
field must not conceal the main state. The maintainer explicitly permits JSON
inside that one field experimentally to test interoperability, while considering
it ugly and likely to attract objections. This is not a preferred format or a
general exception for whole-workspace snapshots, caches or baselines.
