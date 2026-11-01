# Adopted warning profiles

## Human Impact and Epistemic

**Adopted:** the maintainer explicitly approved adding this profile during
project intake, after its purpose and significance gate were presented.

- Identity: `WPF-HUMAN-001` (preserved from the upstream profile).
- Local text: [human-impact-and-epistemic.md](human-impact-and-epistemic.md).
- Source repository: `https://github.com/muze-labs/spiral-developer`.
- Source path: `warning-profiles/human-impact-and-epistemic.md`.
- Source commit: `3c93481336d0e771110a9437c6039df6d7ce078b`.
- Local modifications: none; the profile text was copied unchanged.

Use this profile for consequential interpretation, design, implementation and
evaluation decisions involving authority, evidence, composition, user access
or the ability to replace or correct the system. Surface signals only when
their significance gate is met. A warning prompts inspection and disposition;
it does not automatically veto a change or require another approval step.

The seven signals are premature closure, authority drift, evidence overreach,
composition risk, optionality loss, meaningful exclusion and model closure.
If a warning reveals a durable concern, record it through the ordinary risk
mechanism with the relevant signal and evidence. Profile updates are explicit
prospective decisions; do not silently follow a moving upstream version.

## Git-linked provenance

Intake changes remain uncommitted under AGENTS.md. The existing profile's Turtle
descriptor stays in the pinned submodule; do not duplicate its governed
definition in another Turtle file. The local Markdown copy retains the exact
approved text for review.

When causal commits are authorized, establish the local governed profile
version before creating a downstream `sd:adoptsWarningProfile` artifact
reference. If vendoring it as an independently governed local artifact, use an
allocated local identity and retain the external source identity and version.
Likewise establish exact local culture versions before creating
`sd:adoptsCulture` references. Do not fabricate hashes or use a foreign commit
as though it were an ancestor of this repository.
