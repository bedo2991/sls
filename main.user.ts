import { AsyncWmeSDK, Segment } from "wme-sdk-typings";

declare const GM_info: {
    script: {
        version: string;
    };
};


// the sdk initScript function will be called after the SDK is initialized
window.SDK_INITIALIZED.then(initScript);

async function initScript(): Promise<void> {

    const STORAGE_KEY_REVERSE_FIX = "wme-sls-reverse-sl-fix";
    let batchSize = 50;
    let maxEdits = 100;

    // initialize the sdk
    if (!window.getWmeSdk) {
        // This block is required for type checking, but it is guaranteed that the function exists.
        throw new Error("SDK not available");
    }

    const wmeSDK: AsyncWmeSDK = window.getWmeSdk(
        {
            scriptId: "wme-speedlimits-shortcuts",
            scriptName: "WME SL Shortcuts",
            // @ts-ignore: mode is not yet in wme-sdk-typings Window.getWmeSdk options
            mode: "async"
        }
    )

    console.debug(`SDK v. ${wmeSDK.getSDKVersion()} on ${wmeSDK.getWMEVersion()}`)

    function getReverseFixEnabled(): boolean {
        try {
            return localStorage.getItem(STORAGE_KEY_REVERSE_FIX) === "true";
        } catch (e) {
            console.error("Failed to read reverse speed limit fix setting from localStorage:", e);
            return false;
        }
    }

    function setReverseFixEnabled(enabled: boolean): void {
        try {
            localStorage.setItem(STORAGE_KEY_REVERSE_FIX, String(enabled));
        } catch (e) {
            console.error("Failed to save reverse speed limit fix setting to localStorage:", e);
        }
    }

    let isReverseFixEnabled = getReverseFixEnabled();

    /**
     * Sets a shortcut for setting the speed limit of the selected segment(s) to the given value X0. If 0, the speed limit gets removed.
     * @param value the value X of the first digit of the speed limit in the format X0
     */
    async function setShortcutX0(value: number): Promise<void> {
        if (value < 0 || value > 9) {
            throw new Error("Invalid argument value: " + value);
        }
        await wmeSDK.Shortcuts.createShortcut(
            {
                callback: (() => { setSpeedQuick(Number(`${value}0`)); return false; }), // Number("00") returns 0
                description: value == 0 ? "Remove the speed limit from the selected segment(s)" : `Sets the speed limit of the selected segment(s) to ${value}0`,
                shortcutId: `wme-sls-${value}0`,
                shortcutKeys: `A+${value}`
            });
    }

    /**
     * 
     * @param value the value X of the second digit of the speed limit in the format 1X0
     */
    async function setShortcut1X0(value: number): Promise<void> {
        if (value < 0 || value > 9) {
            throw new Error("Invalid argument value: " + value);
        }
        await wmeSDK.Shortcuts.createShortcut(
            {
                callback: (() => { setSpeedQuick(Number(`1${value}0`)); return false; }),
                description: `Sets the speed limit of the selected segment(s) to 1${value}0`,
                shortcutId: `wme-sls-1${value}0`,
                shortcutKeys: `AS+${value}`
            });
    }

    /**
     * 
     * @param speed the speed limit to set. If 0 or null, the speed limit will be removed.
     */
    async function setSpeedQuick(speed: number): Promise<void> {
        const selectedFeatures = await wmeSDK.Editing.getSelection();
        if (!selectedFeatures) return;
        if (selectedFeatures.objectType !== "segment") return;
        for (let i = 0; i < selectedFeatures.ids.length; i++) {
            await setSpeedByID(selectedFeatures.ids[i] as number, speed > 0 ? speed : null);
        }
    }


    /**
     * 
     * @param segId the id of the segment to update
     * @param speed the speed limit to set. If 0 or null, the speed limit will be removed.
     */
    async function setSpeedByID(segId: number, speed: number | null): Promise<boolean> {
        const segm = await wmeSDK.DataModel.Segments.getById({ segmentId: segId });
        if (!segm) {
            console.error(`Segment with id ${segId} not found.`);
            return false;
        }
        return await setSpeed(segm, speed);
    }

    async function setSpeed(segment: Segment, speed: number | null): Promise<boolean> {
        console.debug(`Setting speed limit of segment ${segment.id} to ${speed}`);
        const userSettings = await wmeSDK.Settings.getUserSettings();
        if (speed && speed > 0 && userSettings.isImperial) {
            alert("Sorry, 'WME Speed Limits Shortcuts' does not support imperial units.");
            return false;
        }
        const limitToSet = (speed != null && speed > 0) ? speed : null;
        const fwdLimitToSet = (segment.isAtoB || segment.isTwoWay) ? limitToSet : null;
        const revLimitToSet = (segment.isBtoA || segment.isTwoWay) ? limitToSet : null;
        if (segment.fwdSpeedLimit === fwdLimitToSet && segment.revSpeedLimit === revLimitToSet) {
            // console.debug(`Segment ${segment.id} already has the desired speed limit(s). No update needed.`);
            return false;
        }
        try {
            await wmeSDK.DataModel.Segments.updateSegment({
                fwdSpeedLimit: (segment.isAtoB || segment.isTwoWay) ? limitToSet : null, // 0 seems to also work to remove the SL, but the docs say null
                revSpeedLimit: (segment.isBtoA || segment.isTwoWay) ? limitToSet : null,
                segmentId: segment.id
            });
            return true;
        } catch (e) {
            console.error(`Failed to update segment ${segment.id}:`, e);
            //alert(`Failed to update segment ${segment.id}`);
            return false;
        }
    }

    async function setKeyboardShortcuts(): Promise<void> {
        for (let i = 0; i < 10; i++) {
            await setShortcutX0(i);
        }

        for (let i = 0; i < 6; i++) {
            await setShortcut1X0(i);
        }
    }

    async function initSidebarPanel(): Promise<void> {
        const { tabLabel, tabPane } = await wmeSDK.Sidebar.registerScriptTab();
        tabLabel.textContent = "SLS";
        tabLabel.title = "WME Speed Limits Shortcuts";

        if (!document.getElementById("wme-sls-styles")) {
            const style = document.createElement("style");
            style.id = "wme-sls-styles";
            style.textContent = `
                :root {
                    --wme-sls-icon-check: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'></polyline></svg>");
                }
                .wme-sls-panel {
                    padding: 12px;
                    font-size: 13px;
                    line-height: 1.45;
                    color: var(--content_default, #202124);
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .wme-sls-panel h2 {
                    margin: 0;
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--content_default, #202124);
                }
                .wme-sls-section {
                    background: var(--surface_default, rgba(128, 128, 128, 0.06));
                    border: 1px solid var(--hairline, rgba(128, 128, 128, 0.25));
                    border-radius: 6px;
                    padding: 10px 12px;
                }
                .wme-sls-section h3 {
                    margin: 0 0 8px 0;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--content_default, #202124);
                }
                .wme-sls-section p {
                    margin: 0 0 8px 0;
                    color: var(--content_p1, var(--content_default, #202124));
                }
                .wme-sls-shortcuts-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .wme-sls-shortcuts-list li {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 4px 0;
                    border-bottom: 1px dashed var(--hairline, rgba(128, 128, 128, 0.2));
                }
                .wme-sls-shortcuts-list li:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                }
                .wme-sls-panel kbd {
                    display: inline-block;
                    padding: 2px 6px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                    font-size: 11px;
                    font-weight: 600;
                    line-height: 1.3;
                    color: var(--content_default, #202124);
                    background-color: rgba(128, 128, 128, 0.16);
                    border: 1px solid rgba(128, 128, 128, 0.4);
                    border-bottom-width: 2px;
                    border-radius: 4px;
                    box-shadow: none;
                    white-space: nowrap;
                }
                .wme-sls-checkbox-label {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.65rem;
                    min-block-size: 44px;
                    cursor: pointer;
                    font-weight: 500;
                    margin-bottom: 4px;
                    color: var(--content_default, #202124);
                }
                .wme-sls-checkbox {
                    --checkbox-size: 1.25em;
                    --checkbox-icon-size: 0.85em;
                    appearance: none;
                    -webkit-appearance: none;
                    display: inline-grid;
                    place-content: center;
                    inline-size: var(--checkbox-size);
                    aspect-ratio: 1;
                    margin: 0;
                    flex-shrink: 0;
                    background-color: var(--background_default, #ffffff);
                    border: 2px solid var(--content_p2, #5f6368);
                    border-radius: 4px;
                    cursor: pointer;
                }
                .wme-sls-checkbox::before {
                    content: "";
                    inline-size: var(--checkbox-icon-size);
                    aspect-ratio: 1;
                    background-color: #ffffff;
                    -webkit-mask: var(--wme-sls-icon-check) no-repeat center / contain;
                    mask: var(--wme-sls-icon-check) no-repeat center / contain;
                    scale: 0;
                }
                @media (prefers-reduced-motion: no-preference) {
                    .wme-sls-checkbox::before {
                        transition: scale 150ms ease;
                    }
                }
                @media (forced-colors: active) {
                    .wme-sls-checkbox::before {
                        background-color: CanvasText;
                    }
                }
                .wme-sls-checkbox:checked {
                    background-color: #1a73e8;
                    border-color: #1a73e8;
                }
                .wme-sls-checkbox:checked::before {
                    scale: 1;
                }
                .wme-sls-checkbox:focus-visible {
                    outline: 2px solid #1a73e8;
                    outline-offset: 2px;
                }
                .wme-sls-checkbox:disabled {
                    cursor: not-allowed;
                    opacity: 0.5;
                }
                .wme-sls-disclaimer {
                    margin: 8px 0 0 0;
                    padding: 8px 10px;
                    border-radius: 4px;
                    background: rgba(245, 124, 0, 0.12);
                    border-left: 3px solid #f57c00;
                    font-size: 12px;
                    color: var(--content_default, #202124);
                }
            `;
            document.head.appendChild(style);
        }

        const container = document.createElement("div");
        container.className = "wme-sls-panel";
        container.innerHTML = `
            <h2>Speed Limits Shortcuts <small>(v. ${GM_info.script.version})</small></h2>
            

            <section class="wme-sls-section">
                <h3>Keyboard Shortcuts (km/h)</h3>
                <p>Select one or more road segments and press:</p>
                <ul class="wme-sls-shortcuts-list">
                    <li>
                        <span><kbd>Alt</kbd> + <kbd>1</kbd>…<kbd>9</kbd></span>
                        <strong>10 – 90 km/h</strong>
                    </li>
                    <li>
                        <span><kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>0</kbd>…<kbd>5</kbd></span>
                        <strong>100 – 150 km/h</strong>
                    </li>
                    <li>
                        <span><kbd>Alt</kbd> + <kbd>0</kbd></span>
                        <strong>Remove limit</strong>
                    </li>
                </ul>
            </section>

            <section class="wme-sls-section">
                <h3>Reverse Speed Limit Fix</h3>
                <label class="wme-sls-checkbox-label" for="wme-sls-reverse-fix-checkbox">
                    <input type="checkbox" id="wme-sls-reverse-fix-checkbox" class="wme-sls-checkbox">
                    <span>Auto-remove opposite-direction speed limits on one-way segments</span>
                </label>
                <p class="wme-sls-disclaimer">
                    <strong>Disclaimer:</strong> Ensure that this kind of automated mass edit is allowed by your local editing rules. You are responsible for the changes you make through this script. Review your edits before saving.
                </p>
            </section>
        `;

        tabPane.appendChild(container);

        const checkbox = container.querySelector<HTMLInputElement>("#wme-sls-reverse-fix-checkbox");
        if (checkbox) {
            checkbox.checked = isReverseFixEnabled;
            checkbox.addEventListener("change", () => {
                isReverseFixEnabled = checkbox.checked;
                setReverseFixEnabled(isReverseFixEnabled);
                if (isReverseFixEnabled) {
                    fixAllSegments();
                } else if (fixAllSegmentsController) {
                    fixAllSegmentsController.abort();
                }
            });
        }
    }

    // initialization
    async function init(): Promise<void> {
        await setKeyboardShortcuts();
        await initSidebarPanel();

        wmeSDK.Events.on({
            eventName: "wme-map-data-loaded",
            eventHandler: fixAllSegments
        });

        wmeSDK.Events.on({
            eventName: "wme-selection-changed",
            eventHandler: async () => {
                if (!isReverseFixEnabled) return;
                if (!(await wmeSDK.Editing.isEditingAllowed())) return;
                const selectedFeatures = await wmeSDK.Editing.getSelection();
                if (!selectedFeatures) return;
                if (selectedFeatures.objectType !== "segment") return;
                for (let i = 0; i < selectedFeatures.ids.length; i++) {
                    const segm = await wmeSDK.DataModel.Segments.getById({ segmentId: selectedFeatures.ids[i] as number });
                    if (!segm) continue;
                    if (!(await wmeSDK.DataModel.Segments.isRoadTypeDrivable({ roadType: segm.roadType }))) continue;
                    if (segm.isAtoB || segm.isBtoA) {
                        if (segm.isAtoB && segm.fwdSpeedLimit) {
                            await setSpeed(segm, segm.fwdSpeedLimit);
                        } else if (segm.revSpeedLimit) {
                            await setSpeed(segm, segm.revSpeedLimit);
                        }
                    }
                }
            }
        });
    }

    let fixAllSegmentsController: AbortController | null = null;

    async function fixAllSegments(): Promise<void> {
        if (!isReverseFixEnabled) return;

        // Abort any existing execution
        if (fixAllSegmentsController) {
            fixAllSegmentsController.abort();
        }

        // Create new controller for this execution
        fixAllSegmentsController = new AbortController();
        const signal = fixAllSegmentsController.signal;

        try {
            if (!(await wmeSDK.Editing.isEditingAllowed()) || (await wmeSDK.Editing.isSnapshotModeOn())) return;

            const allSegments = await wmeSDK.DataModel.Segments.getAll();
            if (signal.aborted || !isReverseFixEnabled) return;

            // Create progress indicator
            const progressContainer = document.createElement('div');
            progressContainer.style.cssText = `
                position: fixed;
                bottom: 25px;
                left: 10px;
                width: 60px;
                height: 60px;
                z-index: 10000;
                background: var(--background_default, #ffffff);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            progressCircle.setAttribute('width', '40');
            progressCircle.setAttribute('height', '40');
            progressCircle.style.transform = 'rotate(-90deg)';

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '20');
            circle.setAttribute('cy', '20');
            circle.setAttribute('r', '16');
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', '#4CAF50');
            circle.setAttribute('stroke-width', '3');
            circle.setAttribute('stroke-dasharray', '100');
            circle.setAttribute('stroke-dashoffset', '100');
            circle.style.transition = 'stroke-dashoffset 0.3s ease';

            progressCircle.appendChild(circle);
            progressContainer.appendChild(progressCircle);
            document.body.appendChild(progressContainer);

            signal.addEventListener("abort", () => {
                if (document.body.contains(progressContainer)) {
                    document.body.removeChild(progressContainer);
                }
            }, { once: true });

            const time = new Date().toISOString();
            //console.error("START " + time);

            for (let i = 0; i < allSegments.length; i += batchSize) {
                // Check if aborted
                if (signal.aborted || !isReverseFixEnabled) {
                    if (document.body.contains(progressContainer)) {
                        document.body.removeChild(progressContainer);
                    }
                    return;
                }

                const batch = allSegments.slice(i, i + batchSize);
                for (const segm of batch) {
                    if (signal.aborted || !isReverseFixEnabled) {
                        if (document.body.contains(progressContainer)) {
                            document.body.removeChild(progressContainer);
                        }
                        return;
                    }
                    if ((await wmeSDK.Editing.getUnsavedChangesCount()) >= maxEdits) {
                        console.debug(`Reached max edits limit of ${maxEdits}. Stopping.`);

                        // Replace progress indicator with red X
                        progressContainer.innerHTML = '';
                        progressContainer.style.background = 'rgba(244, 67, 54, 0.9)';

                        const xIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

                        // Add tooltip
                        progressContainer.title = 'Maximum edits reached';

                        // Add small label
                        const label = document.createElement('div');
                        label.textContent = 'max';
                        label.style.cssText = `
                            position: absolute;
                            bottom: -25px;
                            left: 50%;
                            transform: translateX(-50%);
                            font-size: 10px;
                            color: var(--content_default, #000000);
                            background: var(--background_default, #ffffff);
                            padding: 1px 4px;
                            border-radius: 2px;
                            border-color: var(--content_default, #000000);
                            white-space: nowrap;
                        `;
                        xIcon.setAttribute('width', '30');
                        xIcon.setAttribute('height', '30');
                        xIcon.setAttribute('viewBox', '0 0 24 24');
                        xIcon.setAttribute('fill', 'white');

                        const xPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        xPath.setAttribute('d', 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');

                        xIcon.appendChild(xPath);
                        progressContainer.appendChild(xIcon);
                        progressContainer.appendChild(label);

                        // Remove indicator after 3 seconds
                        setTimeout(() => {
                            if (document.body.contains(progressContainer)) {
                                document.body.removeChild(progressContainer);
                            }
                        }, 5000);
                        return;
                    };
                    if (!(await wmeSDK.DataModel.Segments.isRoadTypeDrivable({ roadType: segm.roadType }))) continue;
                    if (segm.isAtoB || segm.isBtoA) {
                        if (segm.isAtoB && (segm.fwdSpeedLimit || segm.revSpeedLimit)) {
                            await setSpeed(segm, segm.fwdSpeedLimit);
                        } else if (segm.revSpeedLimit || segm.fwdSpeedLimit) {
                            await setSpeed(segm, segm.revSpeedLimit);
                        }
                    }
                }

                // Update progress
                const progress = Math.min((i + batchSize) / allSegments.length, 1);
                const offset = 100 - (progress * 100);
                circle.setAttribute('stroke-dashoffset', offset.toString());

                // Yield control back to the browser after each batch
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            // Remove progress indicator
            if (document.body.contains(progressContainer)) {
                document.body.removeChild(progressContainer);
            }
            //console.error("END " + time);
        } catch (error) {
            // Clean up if error occurs
            if (document.body.contains(document.querySelector('div[style*="position: fixed"]'))) {
                const container = document.querySelector('div[style*="position: fixed"]') as HTMLElement;
                if (container) document.body.removeChild(container);
            }
            throw error;
        } finally {
            // Clear the controller when done
            if (fixAllSegmentsController && !fixAllSegmentsController.signal.aborted) {
                fixAllSegmentsController = null;
            }
        }
    }

    await init()
}
