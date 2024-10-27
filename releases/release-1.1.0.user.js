// ==UserScript==
// @name        WME Speed Limits Shortcuts Beta
// @namespace   wme-sdk-scripts
// @version     1.1.0
// @description  Sets shortcuts for quickly updating the speed limits. Use the numbers + the ALT key for limits between 0 and 90 and ALT+SHIFT for limits between 100 and 150.
// @updateURL	https://code.waze.tools/repository/70101218-806f-4c8a-9323-49df8cd97534.user.js
// @downloadURL https://code.waze.tools/repository/70101218-806f-4c8a-9323-49df8cd97534.user.js
// @author      bedo2991 @ Waze
// @match       https://www.waze.com/editor*
// @match       https://beta.waze.com/editor*
// @match       https://www.waze.com/*/editor*
// @match       https://beta.waze.com/*/editor*
// @exclude     https://www.waze.com/user/editor*
// @exclude     https://beta.waze.com/user/editor*
// @grant       none
// ==/UserScript==

(function () {
    'use strict';

    window.SDK_INITIALIZED.then(initScript);
    function initScript() {
        if (!window.getWmeSdk) {
            throw new Error("SDK not available");
        }
        const wmeSDK = window.getWmeSdk({
            scriptId: "wme-speedlimits-shortcuts",
            scriptName: "WME SL Shortcuts"
        });
        console.debug(`SDK v. ${wmeSDK.getSDKVersion()} on ${wmeSDK.getWMEVersion()}`);
        function setShortcutX0(value) {
            if (value < 0 || value > 9) {
                throw new Error("Invalid argument value: " + value);
            }
            wmeSDK.Shortcuts.createShortcut({
                callback: (() => { setSpeedQuick(Number(`${value}0`)); return false; }),
                description: value == 0 ? "Remove the speed limit from the selected segment(s)" : `Sets the speed limit of the selected segment(s) to ${value}0`,
                shortcutId: `wme-sls-${value}0`,
                shortcutKeys: `A+${value}`
            });
        }
        function setShortcut1X0(value) {
            if (value < 0 || value > 9) {
                throw new Error("Invalid argument value: " + value);
            }
            wmeSDK.Shortcuts.createShortcut({
                callback: (() => { setSpeedQuick(Number(`1${value}0`)); return false; }),
                description: `Sets the speed limit of the selected segment(s) to 1${value}0`,
                shortcutId: `wme-sls-1${value}0`,
                shortcutKeys: `AS+${value}`
            });
        }
        function setSpeedQuick(speed) {
            const selectedFeatures = wmeSDK.Editing.getSelection();
            if (!selectedFeatures)
                return;
            if (selectedFeatures.objectType !== "segment")
                return;
            for (let i = 0; i < selectedFeatures.ids.length; i++) {
                setSpeed(selectedFeatures.ids[i], speed > 0 ? speed : null);
            }
        }
        function setSpeed(segId, speed) {
            const limitToSet = (speed != null && speed > 0) ? speed : null;
            wmeSDK.DataModel.Segments.updateSegment({
                fwdSpeedLimit: limitToSet,
                revSpeedLimit: limitToSet,
                segmentId: segId
            });
        }
        function setKeyboardShortcuts() {
            for (let i = 0; i < 10; i++) {
                setShortcutX0(i);
            }
            for (let i = 0; i < 6; i++) {
                setShortcut1X0(i);
            }
        }
        function init() {
            setKeyboardShortcuts();
        }
        init();
    }

})();
