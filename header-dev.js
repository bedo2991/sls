// ==UserScript==
// @name        WME Speed Limits Shortcuts
// @namespace   wme-sdk-scripts
// @version     1.0.0
// @description  Sets shortcuts for quickly updating the speed limits. Use the numbers + the ALT key for limits between 0 and 90 and ALT+SHIFT for limits between 100 and 150. This script only supports km/h!
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

// @require     file:///D:/Dev/Tampermonkey/wme-speedlimit-shortcuts-sdk/.out/main.user.js
// ==/UserScript==

// make sure that inside Tampermonkey's extension settings (on the browser, not from TM) and allow "Local file access", as shown here: https://www.tampermonkey.net/faq.php?locale=en#Q204
// make sure that the snippts inside header.js and header-dev.js are the same, except for the one @require field
// adjust the require field to the location of the .out/main.user.js file inside this directory
// copy the above snippet (up to ==/Userscript==) inside Tampermonkey's editor and save it