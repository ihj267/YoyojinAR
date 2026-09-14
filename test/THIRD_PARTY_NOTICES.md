# Third-party components

This local prototype vendors pinned distributions to avoid runtime CDN dependencies.

- MindAR 1.2.5 — MIT — https://github.com/hiukim/mind-ar-js
- Three.js 0.160.1 — MIT — https://github.com/mrdoob/three.js
- qrcode-generator 1.4.4 — MIT — https://github.com/kazuhikoarase/qrcode-generator
- Transitive runtime notices are retained in the distributed JavaScript files (including TensorFlow.js Apache-2.0 notices).

The original mural, children's participation sheets, and guide GLB are user-supplied assets, not covered by these software licenses. Original source files remain unchanged.

## Local MindAR runtime modification

In `vendor/dist/controller-mGt1s8dJ.js`, the tracker keyframe selection constant `Y5` is changed from `1` to `0`. This uses the compiled 256px tracking level instead of the 128px level. The dense mural yielded too few usable points at 128px and failed continuous tracking; the 256px level passed synthetic continuous-tracking checks. The matching algorithm and compiled target order are unchanged. The compiler bundle remains original. This tradeoff needs mobile performance testing. Reapply or re-evaluate this change when updating MindAR; do not silently replace the patched runtime with a CDN copy.
