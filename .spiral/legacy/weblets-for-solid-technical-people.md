# weblets for solid technical people

Weblets are small, standalone web applications that can be embedded and composed at runtime. Each weblet has its own URL, its own origin, its own UI, and one or more declared capability APIs. A weblet can run by itself, but it can also run inside a parent weblet, usually an iframe, and cooperate with sibling or parent weblets through explicit message channels.

For Solid, the point is to move beyond data interoperability into operational interoperability.

Solid application interoperability helps applications safely read and write shared data in Pods using common protocols, identities, access grants, shapes, and Linked Data vocabularies. Weblets build on that foundation by letting Solid-compatible applications cooperate while they are running.

The mechanism is roughly:

1. A weblet declares the APIs, vocabularies, shapes, and data access patterns it supports. These declarations are identified by URLs and should be dereferenceable, similar to Linked Data vocabularies or shape definitions.

2. A layout/root weblet embeds child weblets using iframe isolation. Each embedding relationship creates a private parent-child message channel using `postMessage` or `MessageChannel`; there is no ambient global bus where every child can observe every message.

3. During connection setup, the child and parent perform a handshake over a base Weblet Connect API. The child advertises what it provides and what it may request. The parent advertises available services: storage, identity, styling, file selection, bridge discovery, other weblets, and user-mediated permission flows.

4. If one weblet wants to use another weblet’s capability, it does not directly reach across the page. It requests a capability from the parent/root: for example, “I need a contact picker that can return a `schema:Person` compatible resource,” or “I need a task list supporting this shape tree.” The parent can satisfy that request with an already embedded weblet, instantiate a new one, or insert a bridge.

5. Access is granted to relationships, not globally to origins. The root gives the requesting weblet a scoped channel or token for a specific API, optionally constrained by resource, shape, purpose, duration, or user action. High-risk capabilities require mediation by the root, the providing weblet, or both.

6. The payloads crossing these APIs use Linked Data-compatible shapes where possible. The API URI defines the message contract; Solid shapes, shape trees, SHACL, ShEx, or lightweight JSON-LD contexts can describe accepted and returned data. This makes semantic assumptions inspectable and bridgeable.

7. When two weblets do not speak the same API or vocabulary, a bridge weblet can be inserted. A bridge is itself a weblet or worker-like component that declares: “I translate API P to API Q under these constraints, with this known lossiness.” Bridges become reusable interoperability artifacts rather than hidden one-off integration code.

8. Data remains in Solid Pods by default. A weblet may fetch and store data itself, using normal Solid authentication and authorization, or it may receive data from its parent through a scoped capability. In the second mode, the weblet acts as a UI/tool over data authority held elsewhere.

9. The runtime composition is introspectable. A user or developer should be able to inspect the active graph: embedded weblets, origins, declared APIs, granted capabilities, data sources, vocabulary mappings, bridge transformations, and message flows.

The result is that Solid interoperability becomes operational. Instead of only saying “multiple apps can understand the same Pod data,” Weblets allow apps to ask each other to perform bounded work: select a resource, render a view, edit a value, annotate an object, validate a graph, transform a shape, request authorization, or explain provenance.

In short: Solid gives us user-owned data and semantic interoperability. Weblets add isolated, capability-scoped, live cooperation between the applications that operate on that data.


**Weblets should use Solid’s interoperability work as their semantic and authorization substrate, but add a runtime capability graph above it.**
