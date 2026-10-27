import { Segment, WmeSDK } from "wme-sdk-typings";


// the sdk initScript function will be called after the SDK is initialized
window.SDK_INITIALIZED.then(initScript);

function initScript(): void {

    let batchSize = 50;
    let maxEdits = 100;

    // initialize the sdk
    if (!window.getWmeSdk) {
        // This block is required for type checking, but it is guaranteed that the function exists.
        throw new Error("SDK not available");
    }

    const wmeSDK: WmeSDK = window.getWmeSdk(
        {
            scriptId: "wme-speedlimits-shortcuts",
            scriptName: "WME SL Shortcuts"
        }
    )

    console.debug(`SDK v. ${wmeSDK.getSDKVersion()} on ${wmeSDK.getWMEVersion()}`)

    /**
     * Sets a shortcut for setting the speed limit of the selected segment(s) to the given value X0. If 0, the speed limit gets removed.
     * @param value the value X of the first digit of the speed limit in the format X0
     */
    function setShortcutX0(value: number): void {
        if (value < 0 || value > 9) {
            throw new Error("Invalid argument value: " + value);
        }
        wmeSDK.Shortcuts.createShortcut(
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
    function setShortcut1X0(value: number): void {
        if (value < 0 || value > 9) {
            throw new Error("Invalid argument value: " + value);
        }
        wmeSDK.Shortcuts.createShortcut(
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
    function setSpeedQuick(speed: number): void {
        const selectedFeatures = wmeSDK.Editing.getSelection();
        if (!selectedFeatures) return;
        if (selectedFeatures.objectType !== "segment") return;
        for (let i = 0; i < selectedFeatures.ids.length; i++) {
            setSpeedByID(selectedFeatures.ids[i] as number, speed > 0 ? speed : null);
        }
    }


    /**
     * 
     * @param segId the id of the segment to update
     * @param speed the speed limit to set. If 0 or null, the speed limit will be removed.
     */
    function setSpeedByID(segId: number, speed: number | null): boolean {
        const segm = wmeSDK.DataModel.Segments.getById({ segmentId: segId });
        if (!segm) {
            console.error(`Segment with id ${segId} not found.`);
            return false;
        }
        return setSpeed(segm, speed);
    }

    function setSpeed(segment: Segment, speed: number | null): boolean {
        console.debug(`Setting speed limit of segment ${segment.id} to ${speed}`);
        if (speed && speed > 0 && wmeSDK.Settings.getUserSettings().isImperial) {
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
            wmeSDK.DataModel.Segments.updateSegment({
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

    function setKeyboardShortcuts(): void {
        for (let i = 0; i < 10; i++) {
            setShortcutX0(i);
        }

        for (let i = 0; i < 6; i++) {
            setShortcut1X0(i);
        }
    }

    // initialization
    function init(): void {
        setKeyboardShortcuts()

        wmeSDK.Events.on({
            eventName: "wme-map-data-loaded",
            eventHandler: fixAllSegments
        });

        wmeSDK.Events.on({
            eventName: "wme-selection-changed",
            eventHandler: () => {
                if (!wmeSDK.Editing.isEditingAllowed()) return;
                const selectedFeatures = wmeSDK.Editing.getSelection();
                if (!selectedFeatures) return;
                if (selectedFeatures.objectType !== "segment") return;
                for (let i = 0; i < selectedFeatures.ids.length; i++) {
                    const segm = wmeSDK.DataModel.Segments.getById({ segmentId: selectedFeatures.ids[i] as number });
                    if (!segm) continue;
                    if (!wmeSDK.DataModel.Segments.isRoadTypeDrivable({ roadType: segm.roadType })) continue;
                    if (segm.isAtoB || segm.isBtoA) {
                        if (segm.isAtoB && segm.fwdSpeedLimit) {
                            setSpeed(segm, segm.fwdSpeedLimit);
                        } else if (segm.revSpeedLimit) {
                            setSpeed(segm, segm.revSpeedLimit);
                        }
                    }
                }
            }
        });
    }

    let fixAllSegmentsController: AbortController | null = null;

    async function fixAllSegments(): Promise<void> {
        // Abort any existing execution
        if (fixAllSegmentsController) {
            fixAllSegmentsController.abort();
        }

        // Create new controller for this execution
        fixAllSegmentsController = new AbortController();
        const signal = fixAllSegmentsController.signal;

        try {
            if (!wmeSDK.Editing.isEditingAllowed() || wmeSDK.Editing.isSnapshotModeOn()) return;

            const allSegments = wmeSDK.DataModel.Segments.getAll();

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

            const time = new Date().toISOString()
            //console.error("START " + time);

            for (let i = 0; i < allSegments.length; i += batchSize) {
                // Check if aborted
                if (signal.aborted) {
                    document.body.removeChild(progressContainer);
                    return;
                }

                const batch = allSegments.slice(i, i + batchSize);
                for (const segm of batch) {
                    if (wmeSDK.Editing.getUnsavedChangesCount() >= maxEdits) {
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
                    if (!wmeSDK.DataModel.Segments.isRoadTypeDrivable({ roadType: segm.roadType })) continue;
                    if (segm.isAtoB || segm.isBtoA) {
                        if (segm.isAtoB && (segm.fwdSpeedLimit || segm.revSpeedLimit)) {
                            setSpeed(segm, segm.fwdSpeedLimit);
                        } else if (segm.revSpeedLimit || segm.fwdSpeedLimit) {
                            setSpeed(segm, segm.revSpeedLimit);
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
            document.body.removeChild(progressContainer);
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

    init()
}
