# Weblet Security Considerations

Weblets allow you to embed any content on the web as an iframe, or child weblet. As a weblet has the option to communicate with the parent weblets, and through that potentially any other weblet, there may be a possibility of an interaction with unwanted consequences.

One possible attack is to simply try to listen in on all messages and send a copy to a central server, which has all kinds of privacy consequences.

Another is to try to connect to a high-value weblet and make it do unwanted things. Imagine a banking weblet that can be induced to send money to someone.

There should be some way to prevent these things from happening, or at least happening without the users consent.

The approach taken by the [Web Tiles experiment](https://berjon.com/web-tiles/) is to never allow any communication over the network by a Web Tile (which is similar to our Weblet idea.) This can be enforced using the [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) of the browser.

But our goal is to make weblets work on their own. Each weblet has a URL, and if you enter that in the browsers address bar, it should show you the working weblet. It needs to be able to load CSS and javascript files at the minimum.

One solution is to only let the root weblet, the one who's address is in the browsers address bar, to access the network. Any other weblet must ask the root weblet to fetch content, through the common bus. Now the root weblet can ask the user whether or not to allow the weblet access to the network, or even specific domains on the network. Similar to how Android will ask user permission for specific capabilities requested by an application.

The problem with Content-Security-Policy is that it is usually a server-sent header, or optionally a meta tag inside the HTML content of the iframe. There is an option to add a [`csp` attribute](https://w3c.github.io/webappsec-cspee/) to an iframe element, but it is not supported by Firefox, only Chrome and Safari (and other webkit derived browsers.)

This could be mitigated either by not supporting Firefox, or by creating the weblet HTML when installing a new weblet. What I mean is that we define a non-instantiated weblet only as a javascript resource. When you create a new instance, you create an index.html file with a script loading that javascript resource. This index.html can then use the widely supported `<meta http-equiv>` tag to add CSP information. 

The problem with that approach is that it rather limits the expressiveness of weblets. Everything must be added to the DOM using javascript. Which seems a shame.

For the experimental version of weblets we could ignore Firefox and hope they implement the `<iframe csp>` attribute by the time that weblets are out of the experiment phase.

As for connecting to other weblets, with potential nefarious intentions. We could add a user confirmation step whenever a weblet wants to connect to another weblet. Or this could be limited to weblets that define themselves as security critical, so as not to overload the user with confirmation requests.
