# Initial reality assessment

Date: 2026-11-01.
Frame: [confirmed project context](project-context.md), intake Complete.
Code baseline: `292f753`, local `main`; no product code was changed for intake
or this assessment. The maintainer's staged `.gitmodules` change is preserved.

This is a bounded assessment of UI/UX, developer experience, and the adopted
risk lenses. The maintainer has now selected the launch-context candidate for
the next work and supplied live-provider authentication evidence below. No
product implementation cycle has been opened yet.

## Evidence and limits

- `npm run check` passed earlier during intake at this same product-code
  baseline: both test files passed and all four apps built.
- `npm run test:browser` passed after frame confirmation. It exercised all four
  apps, local persistence, shared profile editing, linked preferences, remote
  profile editing, synchronization, binary upload, metadata deletion and logout
  across tabs. The sandbox initially prevented localhost binding; the unchanged
  command passed when permitted to run its local servers outside the sandbox.
- Desktop and mobile Contacts captures from the browser suite were inspected.
  They show the implemented panel layout and responsive stacking; this is not
  evidence that real users find the flows understandable or productive.
- Unit cases in `test/data.test.mjs` explicitly cover unknown RDF, other
  subjects, multiple values, unsupported structured edits, conditional writes
  and metadata-based deletion. Passing cases provide bounded preservation
  evidence, not a proof about every RDF structure or server.
- A disposable browser probe reused the existing harness against its isolated
  mock Pod. Its observations are retained at
  `/tmp/solid-apps-intake-launch-observations.json`; probe source is
  `/tmp/solid-apps-intake-launch-probe.mjs`. Both are temporary local artifacts,
  not new product code or permanent regression tests.
- No live identity provider, personal Pod, independent developer or real-user
  task study was exercised. External browser/CSP support claims in the retained
  Weblets sources remain unverified.

## Governing roadmap position

**Phase 0 is not yet complete.** The applications and shared preferences offer
useful starting components, but the roadmap's exit requires settled pilot
contracts, known launch conventions and provider metadata decisions.

The current preferences keys in `packages/solid-preferences/src/index.mjs` are
appearance, language and app storage locations. Launcher stores application
shortcuts. Files browses and downloads resources; Contacts edits local profiles
and explicitly synchronizes them. Those are existing application behaviors,
not a demonstrated cross-origin capability invocation contract.

No broker/client/registry implementation was identified in the application,
shared package or build entry points inspected. No Phase 1 cross-origin proof
or Phase 2 cold-provider launch has been demonstrated. This is expected planned
work, not evidence of a regression. The roadmap remains the governing direction.

## Candidate: establish the actual launch context

Expectation: the broker roadmap's section 3 says the Solid apps already accept
WebID/resource context through URL fragments, and Phase 0 should document and
reuse that convention.

Evidence:

- `design/solid-capability-broker-roadmap.md:63` states that assumption.
- `packages/solid-app-ui/src/index.mjs` restores a WebID from localStorage or
  reads manual form input; its startup does not consume a launch fragment.
- `apps/profile/src/index.mjs:55` consumes a local `?contact=` parameter,
  which is a different mechanism from a public WebID/resource launch contract.
- Files initializes its location from preferences or the session's storage
  root, not a requested launch resource. Launcher built-in links are ordinary
  relative app links; shortcut targets can open separately.
- In a fresh Chrome profile, visiting Contacts, Files and Profile with a sample
  URL-encoded `#webid=...&resource=...` fragment left the session unconnected,
  the WebID form blank and the mock Pod request count at zero.

Candidate concern: the roadmap relies on an existing interface that is not
established for this checkout. Building cold launch on that premise risks
inventing inconsistent launch formats or conflating launch context with
authentication. Phase 0 should characterize the intended convention and resolve
the mismatch before implementation depends on it.

Unknown: whether the statement refers to another implementation or historical
prototype, and which exact fragment syntax was intended. The sample probe does
not exhaust all possible formats or establish that automatic authentication
would be correct. Launch context must remain distinct from authority.

Disposition: **Prioritized by maintainer.** The maintainer selected this
candidate after reporting successful live-provider connection/authentication.
Establish the existing convention and intended behavior before proposing
product changes; selecting this candidate does not settle the launch contract.

## Candidate: obtain live-provider connection evidence

Expectation: users productively operate on their own Solid data and can recover
from connection or authorization failures.

Evidence: `test/browser.mjs` uses an isolated in-memory HTTP Pod accepting test
requests; it does not exercise a real provider's complete login/consent flow.
The README explicitly says live-provider sign-in still needs a manual test.
Published authentication composition and session/logout tests provide useful
technical evidence but do not fill this end-to-end evidence gap.

Candidate concern: the core first-use flow could behave differently on a real
Pod/provider. This is an uncertainty, not an observed login defect.

Subsequent human evidence: the maintainer reports having verified connection
and authentication with **solidcommunity.net**, successfully. This is explicit
first-hand human-reported evidence, not a test performed by the agent. No
browser version, detailed procedure or broader provider coverage was supplied.

Disposition: **Connection/authentication evidence gap addressed for the reported
solidcommunity.net test.** Do not continue treating live sign-in as wholly
unverified, and do not generalize this result to all providers, browsers or
data operations.

## Candidate: collect UI/UX and developer-experience observations

Expectation: users can productively use the defined apps, and developers can
learn stack usage from source and build an interoperable app using their own
choice of underlying libraries.

Evidence: automated browser flows work; the README and package READMEs describe
responsibilities and provide component usage examples. Neither the tests nor
the screenshots establish real-user discoverability, recovery or productivity.
No independent-app capability integration was demonstrated; the relevant
contracts are still Phase 0 work. No actual developer learning session was
observed during intake.

Candidate concern: success on the selected UI/UX and developer-experience
outcomes is not yet evidenced by task observations. This is a measurement gap,
not a conclusion that the current UI or documentation is poor.

Unknown: which tasks or explanations will need improvement. Start with the
maintainer's own use, then follow the agreed Muze/ community feedback sequence.
For developer integration, evaluate a real independent consumer once the pilot
contract exists; do not require adoption of this suite's stack.

Disposition: **Awaiting maintainer prioritization.**

## Next decision

The maintainer prioritized launch context. UI/UX and developer observations
remain unprioritized. Re-read the governing broker roadmap and explicitly
reconcile a proposed launch-context cycle with its Phase 0 position. The
assessment does not silently replace the roadmap or settle implementation
choices.
