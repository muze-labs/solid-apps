# Architecture for readable, correctable software

Audience: developers and AI agents working across projects.
Prepared: 2026-09-19. Updated: 2026-09-27.

This guide synthesizes the Programming for Wizards architecture chapters,
Muze engineering principles, and the maintainer's refinements during the
SimplyStore refactor. It is self-contained and does not require Spiral
Developer, JavaScript, or any particular framework.

The maintainer also identifies experience with Ariadne, SimplyEdit/SimplyFlow,
Domain Driven Design, Functional Core/Imperative Shell, Hexagonal Architecture
and Clean Architecture as influences. Apply their useful ideas through the
decisions below. Their names do not prescribe a language, class hierarchy,
directory layout or number of layers.

Use it as an explicitly adopted engineering preference. Apply project
requirements and current maintainer instructions first. Explain material
trade-offs; do not turn these preferences into automatic rewrites or additional
approval ceremonies. The examples illustrate reasoning, not mandatory APIs.

## 1. Design so mistakes remain affordable

Architecture determines how easily software can change when an assumption
turns out to be wrong. A design succeeds when a consequential choice can be
replaced without dragging unrelated parts of the system into the change.

Ask what a component assumes about its surroundings. Look especially for
assumptions about data shape, frameworks, storage, ordering, ownership, clocks,
external effects and lifecycle. Decide which assumptions belong inside the
component and which should stop at its boundary.

Before adding machinery, consider whether a different representation or
boundary makes the problem smaller. An extra layer earns its place by reducing
what callers must know. Moving code into another file is insufficient evidence
of reduced coupling.

Simplicity concerns the number of concepts and relationships a reader must
understand. Fewer lines can conceal more complexity; more lines can make a
small set of responsibilities clearer. Neither line count nor class count is
a sufficient quality measure.

## 2. Let the problem supply the vocabulary

Every program develops a language through its names, data shapes and APIs.
Choose words that express the actual domain and remain understandable to the
next reader. Prefer names such as `loadCommandHistory` when that is the operation
the reader needs to reason about.

Domain vocabulary has a scope. Establish where a model's meanings and rules
apply before sharing it across components. Billing and support may legitimately
model a customer differently. A common identifier does not require identical
fields, lifecycles or validation rules. These boundaries can exist within one
application; they do not require separate services.

At an integration boundary, translate the concepts that differ and agree on
the meanings needed for cooperation. Reuse a model where its meaning is truly
shared. Do not force a universal model merely because two structures look alike,
or duplicate models merely to demonstrate bounded contexts.

A useful abstraction replaces several details with one meaningful idea. A
weak abstraction merely gives an existing call another name, or forces the
reader to learn a private dialect before understanding a simple operation.

Small domain languages can help. A query expressed with JAQT can expose the
selection and projection more clearly than a dense chain of loops and property
accesses. Use an existing language or library where it fits and is understood.
Keep ordinary operations ordinary. This guide does not require installing JAQT
or introducing a new parser to perform a refactor.

Prefer a small language embedded in the host language over one with its own
parser. An embedded language keeps the host's functions, modules, tests and
composition available; a separate syntax creates a border that values and
helpers must be carried across, with new error messages and a risk of
injection. A separate language earns that border when it does work the host
cannot, as SQL does when a query is sent to a server, optimized, logged and
permission-checked. Every private word also has a cost: it makes insiders more
fluent and gives every outside reader one more thing to learn.

## 3. Keep each function at a coherent abstraction level

A coordinating function should read as a short account of what happens.
Its statements should concern roughly the same level of the problem. Put
serialization, individual filesystem operations and protocol details behind
methods when they distract from that account.

For example, an inspection workflow can read:

```javascript
async inspect() {
    await this.validateConfiguredPaths()
    this.files = await inventory(this.config)
    await this.loadCommandHistory()
    await this.loadIntegrityManifest()
    await this.reconstructCommittedState()
    this.validateStoreArtifacts()
    await this.verifyStableSnapshot()
    return this.createReport()
}
```

Reading and interpreting log records belongs inside `loadCommandHistory()`.
The coordinating method should not also contain newline splitting, parser
exception handling and duplicate-ID bookkeeping.

This is a judgment about cognitive load, not a maximum function length or a
requirement that every statement be a method call. A short local calculation,
assignment or branch can make the story clearer than another extraction.

Before adding a function or method, ask:

- Does its name express a useful operation or hide meaningful detail?
- Does it reduce what the caller's reader must hold in mind?
- Is the cost of learning and locating this name justified?
- Does it belong with existing related behavior and state?

Long names can reveal too many responsibilities, but a precise long name can
be correct. Do not shorten a name until it becomes vague. Likewise, do not split
a coherent function merely to satisfy a numerical length target.

## 4. Give related state and behavior a cohesive owner

When several operations maintain the same state and invariants, a class or
equivalent module can make that relationship explicit. Use the same concept
consistently throughout the codebase instead of scattering related operations
across numerous helpers with repeated context parameters.

An opened store is a reasonable owner of loaded data, command admission,
execution sequencing and shutdown. A recovery operation may own its candidate,
audit information and completion state. Internal workflow objects can keep
simple public functions and plain result objects at the external boundary.

Classes earn their place through cohesion. Stateless transformations can remain
functions. Do not collect unrelated responsibilities into one object merely
because they occur in the same application. A large mutable context object that
every helper can change provides little protection for its invariants.

A cohesive owner need not mutate data in every method. It can group calculations
over immutable values, or own a lifecycle while delegating decisions to pure
functions. Choose the form that makes the related rules easiest to find and
understand. Neither objects nor functions are the default answer to every
decomposition problem.

Make the intended public surface clear. Callers should not need to reach into
internal state, know an undocumented method order, or repair an object's rules.
Use explicit inputs and return values where they clarify dependencies; shared
state should represent a coherent lifecycle rather than incidental scratch work.

## 5. Separate policy, mechanisms and their wiring

Look for things that change for different reasons. HTTP response handling,
command ordering and worker-thread event handling have different reasons to
change. Give each a boundary that allows those changes to remain local.

Keep domain decisions independent of transport and process policy where
practical. An HTTP adapter translates requests and results. A runtime decides
which transitions are permitted. Storage and worker adapters implement their
mechanisms. The application shell chooses implementations and connects them.

Dependency injection can be as small as passing an ordinary object or function
to a constructor. Dependencies should be named and discoverable. A container,
registry, interface hierarchy or plugin system needs its own demonstrated
reason; it is not a prerequisite for replaceability.

Injection makes a dependency's origin explicit; it does not by itself remove
coupling to that dependency's concepts. Express a dependency's contract in the
language of the responsibility that needs it. Let an adapter translate that
contract into database, network or framework operations. Passing an injected
database connection throughout the domain still exposes database concerns.

Keep implementation-specific types and behavior from leaking through the
contract. Use plain values or domain types where they express the required
meaning. A function or small object can serve as a port; no interface framework
is required. Add translation where it protects a real difference, not as an
automatic copy of every input and output.

The component that uses a dependency need not choose its implementation.
Prefer binding choices where they are cheap to change. Keep specific or
uncertain ideas in local application layers until repeated use justifies
moving them into shared foundations.

Choose boundaries for demonstrated directions of reuse. Being able to use a
store without HTTP is concrete. Supporting every imaginable storage backend
usually is not. Do not generalize a component beyond the evidence for its use.

When two components need to cooperate, prefer a bridge over teaching each one
about the other. The bridge is the only part that knows how they connect: an
adapter, a factory or a small integration package. Look for code that knows
something only because two other parts need to meet; that knowledge usually
belongs in a bridge. A missing bridge shows up as callers repeatedly adapting
one component's output to another's input.

### Place each idea at the layer that can absorb its change

Software stacks tend to have a stability gradient. Infrastructure, such as
protocols, formats and low-level libraries, is depended upon by many
independent components and is expensive to change. Platforms built on it can
grow more easily but must not move beneath their users. Applications carry
purpose and change most freely. Each step down makes an idea harder to remove;
an application feature can disappear with the application, while an
infrastructure meaning may have to be honored by independent implementations
for decades.

Keep an idea as high in the stack as it can live. Move it down only when
several independent users need it and its meaning has proven stable. Keep the
vocabulary of a lower layer smaller than the vocabularies built on it. For
example, synchronization policy belongs in the component that owns replicas,
not in the HTTP or parsing middleware beneath it. A contract change in a lower
layer deserves more care than the same change higher up, because more code
relies on it without knowing it does.

### Separate decisions from effects where it pays off

For complicated reasoning, prefer a flow in which the shell obtains external
facts, side-effect-free code derives a result or decision, and the shell performs
the required effects. Pass relevant time, randomness and configuration as
explicit values when the calculation depends on them. Hidden reads of mutable
global state still make reasoning depend on the environment.

For example, recovery assessment can take a store snapshot and administrator
choices and return a report or plan. Execution then owns filesystem changes and
command execution. The assessment can be understood and tested without doing
those operations. Do not create a generic plan interpreter when an ordinary
return value and a small coordinator suffice.

We usually work in general-purpose languages. Use side-effect-free functions
and immutable data when the problem's complexity makes the reduction in
reasoning cost worth the implementation cost. Relevant signs include many
branches, multiple readers, retained snapshots and difficult interleavings.
Simple, locally owned mutation is reasonable when its consequences remain clear.
Do not introduce an immutable-data library or rewrite an entire workflow solely
to follow this preference.

At a value boundary, make it clear whether a value is a snapshot or a live
reference and who may mutate it. An unchanged reference binding does not make
the referenced data immutable. Use ownership, copying or enforcement appropriate
to the actual contract and cost.

Pure decisions do not make effects atomic. If the world can change between
assessment and execution, the operation's owner must preserve or revalidate
the relevant conditions before acting.

## 6. Treat time and failure as part of the interface

An interface includes when an operation finishes, what becomes visible, what
can run concurrently, what failure means, and which resources remain owned.
Those rules must survive moving code across functions and classes.

For a consequential state transition, identify:

- The owner that can enforce the rule and the state it may change.
- The conditions that must remain true and the changes that must succeed together.
- The authoritative order and when readers may observe the result.
- What successful completion promises to callers.
- Which effects may already have happened on failure, and whether retry is safe.

When the outcome depends on several conditions, write the combinations down
as a table before choosing behavior. For a synchronization rule that might be
local change × remote change × deletion × operation in progress; for a parser
middleware, success status × parse result × empty body. A table makes missing
and contradictory cases visible, and a pattern in it may show that the rule is
simpler than its prose description. Many consistency bugs are cells nobody
wrote down.

Enforce these rules at a boundary that can uphold them. A class name, pure
calculation or injected adapter alone provides no consistency guarantee.
In particular, rebuilding data and repeating external effects are different
operations. Do not infer that a command is safe to rerun merely because its
inputs are available or its output is missing.

The SimplyStore review found three useful examples:

| Boundary | Required meaning | Refactor failure |
| --- | --- | --- |
| Awaiting `close()` | Every caller waits for cleanup or observes its failure. | A second call returned early, allowing a second signal handler to exit during an active command. |
| Acknowledging acceptance | Check storage health after awaited persistence and before queue insertion and success. | The final check was lost, permitting acknowledgment after concurrent storage failure. |
| Recognizing a duplicate ID | Return the known outcome before applying validation for a new command. | Moving name validation earlier changed retry compatibility. |

Fix the contract at its owner. For closure, one shared completion promise lets
all callers await the same outcome. Adding a guard only to one caller would
leave the runtime contract unreliable for other callers.

When reviewing an asynchronous refactor, inspect each `await`: state may change
while execution is suspended. Check where decisions are made, when they become
irrevocable, and whether the required conditions still hold before publication.
Also check repeated calls, partial initialization, cleanup failure and retained
resources. Apply these questions where the operation actually has those risks.

## 7. Preserve behavior deliberately and verify the boundary

Before a consequential refactor, inspect effective behavior: callers, defaults,
shared helpers, failure paths and tests. Separate intended compatibility from
demonstrated bugs. Do not silently change behavior while describing a change as
purely structural; make the correction and its rationale explicit.

Keep a coherent scope. Preserve established file formats, public APIs, audit
records and recovery rules unless their change is part of the agreed work.
Unrelated cleanup can obscure the evidence for a small structural improvement.

Adoption turns rough edges into compatibility. Once people build on a
behavior, even a defect, changing it breaks what they built. Treat a
deliberate behavior change in a used component as a release concern: version
it, record it where users will look, and say what callers must now handle.
Every design choice brings consequences that persist; name the ones you are
choosing to live with, not only the behavior you are preserving.

Tests should observe contracts rather than reproduce method names or assert
internal organization. Use controlled interleavings when timing matters. A
held promise can establish whether two callers wait; a real subprocess can
establish whether signal handling and runtime cleanup compose correctly.

The existing SimplyStore suite passed before the review found regressions.
Additional tests first reproduced those failures, then passed after correction.
Passing tests are bounded evidence. They cannot by themselves establish that
an abstraction is readable or that an untested boundary is sound.

Review the resulting code as well: can a reader understand the coordinator
without opening every helper? Can they find the implementation of a rule?
Does changing one mechanism still require editing unrelated policy?

## 8. Prefer useful feedback, reuse and open boundaries

Use the smallest meaningful probe to resolve the important uncertainty. For an
interactive product, early user interaction may be the best evidence. For a
storage lifecycle, a controlled failure or restart test may be more informative.
Build coherent working slices that can be evaluated.

Reuse mature components when their assumptions fit. Framework familiarity,
maintenance and solved infrastructure have value; dependency cost and imposed
structure also matter. Neither framework adoption nor custom implementation
is automatically the simpler choice.

Where appropriate, use established formats and protocols, let simpler layers
remain useful independently, and preserve users' ability to move their data or
replace a component. Useful implementations may come from outside the original
team. Avoid making interoperability depend on adopting the whole application.

### Let data outlive the application

Code can be replaced; data tends to survive it. A field meant to be temporary
becomes a record once people enter real data into it. Treat stored data and
its meaning as more durable than the program that currently reads it.

Preserve what you do not understand. A component that loads, edits and saves
shared data should write back the parts it did not interpret unchanged, rather
than a projection of the parts it did. Converting unknown structure into
something simpler, such as turning a nested node into a string, silently
changes its meaning for every other reader. Keep the original representation
authoritative and derive views from it.

Portability is not interoperability. Portability means data can leave an
application; interoperability means another application can understand and use
it without a translator written for those two systems. Private names work
inside one application. Where independently written tools must meet, prefer
public, shared vocabularies and formats over pairwise translation. Agreeing on
meaning is social work; choose existing vocabularies where they fit rather than
inventing private ones.

A useful test for data a component writes on someone's behalf: would it remain
useful after the user replaces this component? Keep component-private state
separate from the user's data, so that the application can be one of the
replaceable parts.

These are contextual preferences. Library distribution and audience policies
belong to library stewardship and do not automatically apply to every client
project. Timing, product constraints and current implementation costs can
change a reasonable trade-off. Revisit the rationale rather than applying an
old heuristic mechanically.

## 9. Leave the reasons available to the next reader

For a material boundary or behavior change, retain enough information to answer
what prompted it, which assumption it protects, what behavior must survive, and
what evidence supports it. Use the project's existing documentation and history
conventions; no particular provenance framework is required by this guide.

Distinguish the reason a design is valid now from the historical reason a
particular revision happened. A readability correction may preserve older
durability requirements. A regression test can explain a repair without being
the original source of the intended behavior.

When a function implements an important rule, make that rule discoverable from
the code or its nearby documentation. File-level records can help, but may still
require a reader to reconstruct the function's relationship to older designs.
Do not invent missing historical intent or treat commit ancestry as proof that
every older assumption still applies.

## Practical use by an AI agent

For an adopted project, use this working sequence:

1. Establish the requested outcome and inspect the current effective behavior.
2. Identify the assumptions or abstraction mismatch making change difficult.
   Establish the vocabulary's scope, state owner and relevant consistency rules.
3. Describe a concrete boundary improvement and the behavior it must preserve.
   For complex decisions, consider explicit inputs and side-effect-free
   calculations. For external dependencies, check whose concepts define the
   contract. Apply either change only where it reduces the current problem.
4. Implement within the agreed scope, using the existing vocabulary and owners.
5. Verify consequential contracts, including relevant interleavings and failures.
6. Read the result for cognitive load: does the abstraction save more reasoning
   than its vocabulary and navigation cost? Then report changes, evidence and
   limits.

Avoid expanding a small task into an architectural overhaul. Do not add wrappers,
classes, configuration or tests solely to demonstrate adherence to this guide.
Use existing authorization and review conventions; this document neither grants
permission to merge or publish nor adds a separate workflow for doing so.

## Coding preferences from the maintainer

These concrete conventions accompanied the broader philosophy. Adopt them
explicitly when sharing this guide with a project that has different defaults.

- Use braces for all control-flow bodies, including single statements.
- Start block contents on the next line and put the closing brace on its own
  line. Put `else`, `catch` and `finally` on the following line as well.
- Prefer `if`/`else` over `?:` unless the expression clearly reads better.
- Aim for lines around 80 characters; allow exceptions when wrapping hurts.
- Name intermediate results rather than packing many operations into a statement.
- Prefix thrown error messages with the name of the module that actually throws
  them, such as `jsonmw:` rather than `json:`, so a reader can find the source.
- Use JAQT selectively where it clarifies selection or projection in a project
  that uses it. Do not replace a simple operation for stylistic uniformity.

## Sources and status

This is a portable synthesis, not a verbatim chapter or an independently
ratified organization-wide standard. Its broad principles, the maintainer's
specific preferences, and lessons from the implementation review are identified
separately above. The original repositories preserve the fuller context.

- **Programming for Wizards**, especially chapters 8–13 on language, JAQT,
  assumptions, boundaries, binding and change. Consulted repository:
  `poef/programming-for-wizards`, commit
  `6ff682bf129ad178eaae44e85e9e1cf93dc4da35`, `content/chapters/`. The
  2026-09-27 update adds material from chapters 3 (tables), 6 (consequences),
  10 (embedded languages), 12 (bridges), 13 (adoption and timing),
  14 (stability across layers) and 15–16 (data, shared meaning and
  replaceable applications), consulted at commit `12f2489`.
- **Muze engineering and library stewardship profiles**, `CUL-MUZE-001` and
  `CUL-MUZE-LIB-001`, in `muze-labs/spiral-developer`. The refactor's designs
  reference commit `9958f0e296e84169c21c02aa478ac4aae5a06a41`, under `cultures/`.
- **Maintainer clarification and implementation evidence**, in
  `simplyedit/simplystore`: `SRC-20260919-TTZ7C-28` records function scope and
  naming preferences; `DES-20260919-TTZ7C-32` records the runtime/refactor design;
  `SRC-20260919-TTZ7C-37`, `DES-20260919-TTZ7C-40` and
  `EVD-20260919-TTZ7C-41` record the review, corrections and verification.
- **Further maintainer clarification**, 2026-09-19: the architectural influences
  named in the introduction, and selective use of side-effect-free functions
  and immutable data when problem complexity justifies their cost. The added
  guidance applies that clarification to coding decisions; it does not claim
  that each recommendation was historically used in Ariadne or SimplyEdit.
- **Maintainer clarification**, 2026-09-27: error messages name the module
  that throws them.
- **Background references** for the named architectural ideas:
  [Eric Evans's DDD reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf),
  [Gary Bernhardt's Boundaries](https://www.destroyallsoftware.com/talks/boundaries),
  and [Robert C. Martin's Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html).
  The operating guidance above is self-contained; these references provide
  context rather than additional mandatory instructions.

The guide remains useful without access to these repositories. Reassess its
application when project evidence or requirements change.
