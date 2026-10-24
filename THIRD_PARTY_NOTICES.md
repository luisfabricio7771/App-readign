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

## pdf-lib (PDF editor)

MIT License

Copyright (c) 2019 Andrew Dillon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
