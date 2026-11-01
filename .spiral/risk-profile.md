# Solid Apps risk-discovery profile

Status: **Adopted during intake** by the maintainer's approval of the three
initial investigation lenses. This is an ordinary Markdown discovery prompt,
not a warning profile, a list of findings, or authorization to fix every concern.

## 1. Existing behavior and dependency assumptions

Use [Brownfield general](../.spiral-core/profiles/risk-discovery/brownfield-general.md),
narrowed to behavior and dependency assumptions that could cause regressions.
Inspect effective behavior, including callers, defaults, composition and tests.
Separate intended behavior, undocumented rationale and observed defects.

## 2. Usability and failure recovery

Use [User-facing interaction](../.spiral-core/profiles/risk-discovery/user-facing-interaction.md),
focused on whether people can understand and complete the defined apps' tasks,
and recover when something fails. Use observed interaction and feedback rather
than treating screenshots or passing unit tests as proof of usability.

## 3. RDF preservation, privacy and authority between apps

This project-specific lens follows the maintainer's adopted constraints and
the proposed capability ecosystem. Investigate relevant boundaries around:

- Preserving native RDF identity, unknown information and multiple values.
- Exposing data or references through messages, providers, persistence or logs.
- Distinguishing provider declarations, origin identity, Pod access and the
  authority to invoke a specific operation.
- Scoped cooperation, cancellation and failure without silent authority growth.
- Composed behavior and bridge assumptions that individual component checks
  might not establish.

These prompts identify where evidence may be useful; they do not claim that
the current suite implements every mechanism described in the Weblets sources.

## Use and evidence

The bundled discovery sources were inspected in
`https://github.com/muze-labs/spiral-developer` at submodule commit
`3c93481336d0e771110a9437c6039df6d7ce078b`.

Compare the confirmed project frame with current evidence. For candidate
findings, state the expectation, observation, inference and remaining unknowns.
The maintainer prioritizes, rejects, accepts or defers findings before a normal
development cycle is chosen. A lens is not evidence that a risk exists.

Measurement focus is **UI/UX and developer experience**. Feedback begins with
the maintainer, then Muze colleagues, then the Solid community. Uptime is
explicitly irrelevant; do not import an established-service scorecard.
