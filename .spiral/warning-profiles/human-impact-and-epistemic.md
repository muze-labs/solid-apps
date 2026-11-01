---
id: WPF-HUMAN-001
---

# Human Impact and Epistemic Warning Profile

## Purpose

A replaceable set of concise warning signals for consequential software decisions involving interpretation, authority, evidence, composition, human access, optionality, or models of people.

This profile is a lens, not a rulebook. A signal prompts proportionate inspection; it does not automatically forbid the change.

## Significance gate

Surface these warnings only when the issue could materially affect one or more of:

- user access, dignity, agency, or meaningful participation;
- authorization or responsibility;
- evidence quality or justified confidence;
- system-level behavior produced by interacting automated parts;
- reversibility, fallback, export, override, or future correction;
- a consequential product/domain model of people or social reality.

Do not generate warnings for trivial local constraints merely because a pattern can be described abstractly.

## WPF-HUMAN-001-W1 — Premature closure

**Pattern:** A consequential ambiguity in intent, design, acceptance, or problem framing is being resolved into the first plausible interpretation without enough evidence that alternatives are irrelevant.

**Question:** Are we implementing the requirement, or the first good interpretation of it?

**Default effect:** Surface the unresolved assumption or alternative framing. Do not require exhaustive option analysis.

## WPF-HUMAN-001-W2 — Authority drift

**Pattern:** Capability, confidence, prediction, or inferred user intent is being treated as permission to perform an action.

**Question:** Does knowing what probably should happen mean we are authorized to do it?

**Default effect:** Identify the actual authority/permission boundary before consequential action.

## WPF-HUMAN-001-W3 — Evidence overreach

**Pattern:** A summary, generated explanation, score, or inference is being treated as stronger evidence than its underlying provenance supports.

**Question:** Does the confidence of this conclusion exceed the evidence underneath it?

**Default effect:** Expose the evidence chain, gaps, and inference boundary. A fluent synthesis is not itself evidence.

## WPF-HUMAN-001-W4 — Composition risk

**Pattern:** Individual automated actions, approvals, agents, or components are locally acceptable, but their interaction may create persistent system-level behavior that has not itself been verified.

**Question:** We verified the individual actions; have we verified the behavior of the composed system?

**Default effect:** Inspect the feedback loop/system behavior when the composition is consequential. Human presence in individual steps is not by itself proof of global control.

## WPF-HUMAN-001-W5 — Optionality loss

**Pattern:** A fallback, override, export path, manual route, alternative workflow, replaceable boundary, or other escape route is being removed or made impractical.

**Question:** Are we intentionally closing this option, and what becomes difficult to recover if we are wrong?

**Default effect:** Make the trade-off visible. Preserving every option is not required; low use alone is not proof that an escape route has no value.

## WPF-HUMAN-001-W6 — Meaningful exclusion

**Pattern:** A new or changed capability may materially exclude or disadvantage a meaningful class of users, especially where no viable fallback exists.

**Question:** Who cannot use this path, and is the consequence significant enough that we need another route?

**Default effect:** Inspect meaningful impact rather than demanding universal accommodation for every negligible edge case. Accessibility failures and loss of essential access are strong examples.

## WPF-HUMAN-001-W7 — Model closure

**Pattern:** The implementation forces people or social reality into a narrower mandatory model than the actual requirement appears to require, leaving no way to represent legitimate uncertainty or variation.

**Question:** Does the requirement actually justify narrowing the model this far?

**Example:** Requiring every person to provide both a `first_name` and `family_name` assumes that all legitimate users fit that naming model.

**Default effect:** Prefer the least restrictive model that still lets the software do its job. Software must make operational choices; it should not silently add unnecessary claims about what people can be.

## Scope and replacement

Projects should adopt this profile explicitly and may replace or revise it. A future project may use a narrower accessibility profile, a regulated-domain profile, a different ethical lens, or none of these warnings while still following Spiral Developer core.

When the profile creates noise or misses important concerns, record that experience as a lesson and revise the profile prospectively rather than turning workarounds into hidden agent behavior.
