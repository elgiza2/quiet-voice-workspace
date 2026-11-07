# Open Intelligent UI integration

Component and function sources: https://github.com/thesysdev/open-intelligent-ui (main, retrieved 2026-10-16). Runtime: MIT-licensed @openuidev/react-lang. The upstream demo is an app; its component catalogue is vendored without Next.js, chat shell, analytics or demo data.

Local adaptations: SearchImage uses Ceyo's existing real-photo search; street geometry uses OSRM instead of the demo's Next.js endpoint; styles are scoped and follow Ceyo's theme; non-null assertions are replaced with guards. Native openui fences and historical ui JSON share the original renderer. Historical HTML widgets stay sandboxed.

The upstream demo has no root LICENSE file. Retain attribution and review source licensing with the publisher before redistribution outside this project.