"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var platform_browser_1 = require("@angular/platform-browser");
var core_1 = require("@angular/core");
var app_component_1 = require("./app/app.component");
var platform_server_1 = require("@angular/platform-server");
var app_config_server_1 = require("./app/app.config.server");
function bootstrap() {
    return (0, platform_browser_1.bootstrapApplication)(app_component_1.AppComponent, {
        providers: __spreadArray([
            (0, platform_server_1.provideServerRendering)(),
            { provide: core_1.APP_ID, useValue: 'groupe-abc-app' }
        ], (app_config_server_1.config.providers || []), true),
    });
}
exports.default = bootstrap;
