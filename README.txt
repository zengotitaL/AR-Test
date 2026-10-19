FROG AR - FIRST IPAD TEST

1. Create a new public GitHub repository named frog-ar.
2. Upload index.html, app.js, tracker.js, frog.json, frog.bin and Frog-AprilTag-0.pdf to the repository root. Upload the extracted files, not this ZIP.
3. Open repository Settings > Pages. Under Build and deployment choose Deploy from a branch, main, /(root), then Save.
4. Wait for the Pages link to appear, then open it in Safari on the iPad.
5. Tap Start camera and allow camera access. Put your printed AprilTag 0 flat on a table. Keep the full black square and white margin visible.

Print at Actual size: black square 100 mm wide. Good lighting, matte paper, and slow movement help. This is a first prototype and requires an actual iPad test. No iPad camera test has been performed here.

SOURCE MODEL
The geometry and colors come from frog big color.3mf. Bambu paint states are decoded; mixed-color subdivided faces use a dominant-color approximation in this first version, so tiny color boundaries can differ. The original 3MF is not modified. convert.py is a developer conversion script for this particular source file; it is not needed on GitHub Pages. The website loads converted geometry, not arbitrary 3MF files directly.

TRACKING
This prototype uses a custom single-tag matcher for the real tag36h11 ID 0 pattern, not the full AprilTag detector. It supports only this frog tag. It can lose tracking at steep angles, in shadows or under motion blur. It hides the frog when the tag is lost. Camera focal length is estimated, so perspective alignment is approximate. Before expansion to 25 tags, replace the prototype matcher with the full AprilTag detector and test on the intended school iPads.

NETWORK
The viewer loads Three.js 0.180.0 from cdn.jsdelivr.net. School filtering must allow that domain and GitHub Pages. Camera frames are processed locally in the browser; this app has no image upload or recording feature.

Preview without camera: append ?preview=1 to the website link.
