#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const mainJsPath = path.join(__dirname, 'server', 'main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
const patched = `
var exports = {};
var module = { exports: exports };
var __webpack_exports__ = {};
${mainJsContent}
module.exports = __webpack_exports__;
`;
const patchedFile = path.join(__dirname, 'patched-main.cjs');
fs.writeFileSync(patchedFile, patched);
module.exports = require(patchedFile);
