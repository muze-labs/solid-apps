# Adopted engineering culture

Adoption authority: the maintainer-supplied [AGENTS.md](../AGENTS.md).
This record makes the existing adoption explicit; it does not introduce a new
organization culture or change the adopted profiles.

## Pinned profiles and scope

Source repository: `https://github.com/muze-labs/spiral-developer`.
Inspected submodule version: `3c93481336d0e771110a9437c6039df6d7ce078b`.
The submodule path is `.spiral-core`; these are cross-repository source versions,
not historical commits claimed to belong to the Solid Apps repository.

| Profile | Source | Scope |
| --- | --- | --- |
| CUL-MUZE-001: Muze Engineering Culture | [Pinned profile](../.spiral-core/cultures/muze-engineering.md) | Engineering choices across the suite. |
| CUL-MUZE-LIB-001: Muze Library Stewardship | [Pinned profile](../.spiral-core/cultures/muze-library-stewardship.md) | Muze-owned shared packages and developer tooling; not a requirement for other developers' app stacks. |

AGENTS.md also explicitly adopts the Muze architecture philosophy at
`../ARCHITECTURE-PHILOSOPHY.md` relative to the repository root, and the maturity
policy linked there. Their adoption predates intake. The remote maturity-policy
version has not been independently checked or pinned during intake.

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
