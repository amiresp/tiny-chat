# Legacy runtime enhancements

The original client loaded many independent DOM-patching modules after React. They used `MutationObserver`, global click listeners, repeated polling, multiple Socket.IO connections, and `window.fetch` monkey patches.

They are intentionally **not loaded** by `index.html` after the refactor. The relevant behavior has been moved into React components and the single chat controller where practical.

`main.original.jsx` is retained temporarily as a migration reference and should be removed after production verification.
