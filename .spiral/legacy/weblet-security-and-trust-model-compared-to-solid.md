# weblet security and trust model compared to solid

Weblets change the trust model of Solid applications by making composition explicit at runtime.

A traditional web application usually has one primary trust boundary: the user visits an origin, and that origin runs the application. The browser isolates it from other origins, and Solid permissions determine which Pod resources the application may access. This model is relatively simple: the user grants an application access to data, and the application is responsible for how it uses that access.

Weblets introduce a different shape. A user may assemble several independently authored applications into one working environment. These weblets may come from different origins, may not know each other in advance, and may cooperate while running. That creates new risks, but it also creates new opportunities for finer-grained control.

The main new risk is not merely that weblets can communicate. It is that communication can transfer authority. A malicious or compromised weblet might try to read messages intended for another weblet, induce another weblet to perform a sensitive action, exfiltrate Pod data, confuse semantic mappings, or exploit a bridge that translates between APIs. In a composed environment, the attack surface is not just each application; it is the relationships between applications.

Therefore Weblet security should not be based on a global message bus or broad application trust. It should be based on scoped capabilities between specific parties.

In this model, access is granted to a relationship, not simply to an origin. A root or layout weblet embeds child weblets in isolated contexts, establishes private message channels, and mediates requests for cooperation. If weblet A wants to use a capability of weblet B, A asks the root for that capability. The root can deny the request, ask the user, instantiate a trusted provider, or insert a bridge. If granted, A receives only the narrow channel or token needed for that API, under declared constraints.

This differs from traditional Solid application authorization. Solid can say: “Application X may read or write this Pod resource.” Weblets need to additionally say: “Within this running composition, weblet A may ask weblet B to perform this operation on this kind of data, for this purpose, under these limits.” Solid governs access to stored data; Weblets govern operational authority between live tools.

The security model should therefore have several layers:

1. Browser isolation: iframe origins, sandbox attributes, Permissions Policy, CSP where available, and careful `postMessage` origin/source validation.

2. Private channels: no ambient broadcast bus; parent-child or explicitly brokered `MessageChannel` links only.

3. Capability grants: API access is scoped by provider, requester, operation, resource class, data shape, duration, and revocability.

4. Semantic validation: messages are validated against declared API contracts and Linked Data shapes; bridges must declare mappings and known lossiness.

5. User mediation: high-impact actions are confirmed in terms of human consequences, not technical protocol details.

6. Auditing and introspection: users and developers can inspect which weblets are present, what data they can access, which capabilities have been granted, and how data moves through bridges.

This model increases complexity compared to a single Solid app, but it can reduce overbroad trust. Instead of granting one monolithic app broad access to Pod data and all related behavior, the user can grant smaller capabilities to smaller tools. A calendar view might read events but not edit them. A contact picker might return one selected contact without receiving the whole address book. A bridge might transform task data without being allowed to write it back. A visualization weblet might render aggregate results without seeing the raw source graph.

AI makes this both more important and more dangerous. AI can help users compose weblets, generate bridges, explain permissions, and diagnose mismatches. But AI must not become an ambient superuser. It should operate through the same capability system: proposing compositions, requesting explicit grants, producing inspectable artifacts, and running generated code in constrained contexts before it is trusted.

The security aim is not to make arbitrary composition risk-free. It is to make trust smaller, more visible, and more revocable than in today’s application model.

In short: traditional web security isolates origins; Solid adds user-controlled data authorization; Weblets add capability-scoped cooperation between live applications. The new risk is authority flowing through composition. The new opportunity is to make that authority explicit, narrow, inspectable, and user-governed.

**Weblets make the relationship the security object.**

That is the useful conceptual shift. Traditional web apps ask, “Do I trust this app?” Solid asks, “May this app access this data?” Weblets ask, “May this app use that app’s capability in this running composition, with this data, for this purpose?”