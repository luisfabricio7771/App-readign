# Third-party notices

The optional desktop distribution bundles Electron (MIT) and Chromium and includes their upstream `LICENSE` / `LICENSES.chromium.html` notices. Build tooling includes electron-builder (MIT). These development dependencies do not add remote services or upload documents. The complete JavaScript dependency versions and integrity hashes are recorded in `package-lock.json`.

Final Reader uses the open-source dependencies declared in `package.json` and locked in `package-lock.json`. Their license notices are distributed with their npm packages.

`src/pdf-text.css` contains adapted text-layer layout rules from PDF.js:

Copyright Mozilla Foundation.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at:

https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

PDF.js font, character-map, and WASM assets are copied from `pdfjs-dist` into generated `public/pdf/` during installation, retaining their bundled license files.

The sample story, sample PDF layout, app icons, and ten boss illustrations were created for this project. Astralis is an original SVG; the other nine are original generated PNG illustrations following its geometric, celestial art direction. No Final Fantasy character images are included.
