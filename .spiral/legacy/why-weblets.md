# Why Weblets?

Issues with software anno 2025 that we might be able to fix with weblets

- Software is complex, you need expert developers to create and maintain software. It would be much better if anyone could compose software for their own usecases.
- Applications are the gatekeepers of data, information. You need app X to get access to data generated with that app.
- Data is kept in Silo'd, companies developing applications either don't allow access by third parties, or are uninterested in providing proper API's
- If API's are provided, they require custom software development by experts again.
- There are companies providing software to connect API's (If-This-Then-Thatm Zapier). But these are very limited, and not publicly available (commercial)
- Even if you are an expert software developer, you can't easily re-use existing software. Each component or library has its own design and abstractions, which usually do not easily match other software. You end up writing glue code, sometimes so much that it is better to create your own library or component from scratch.
- The internet started out as a free and democratic, decentralized space. It has now turned into a space with the largest part of discourse being caught in centralized silo's.

## How do weblets fix these issues?

Because weblets are designed from the outset to collaborate with other weblets, the software re-use issue is mostly solved. If weblets are kept minimal, you should be able to build applications by composing weblets. The crucial change is that weblets are not Objects or Classes, but complete applications. They know how to fetch and render data, they have user interactions built-in. And they know how to communicate with other weblets, using a well-defined and common API.

Weblets also solve the gatekeeping issue. They are open for extension by default. So you can create your own weblets that can interact in new ways with your data, through the common bus. Even if the weblet stores your data in a silo. However the default storage would be a Solid Storage Pod, which completely avoids the Silo problem.

Each weblet can implement any number of API's, provided they communicate over the common bus. This means that the mechanism of communication is fixed, all you need is to know what messages to send and receive, for a specific weblet. Weblets communicate what API's they support over a fixed API, which identifies each API with a unique URL, just like Ontologies in Linked Data.

Developers will still need to implement receiving/sending the correct messages. But this can be shared. Given weblet X with API Q and weblet Y with API P, someone can create a bridge that converts messages from P to Q and viceversa. If this brisge is made available on a code sharing platform, anyone else can then use it as well.

Finally, weblets will allow for reflection or introspection, so that a running collection of weblets can be deeply inspected and altered by end users. Similar to how SmallTalk allows end users to alter running code.
