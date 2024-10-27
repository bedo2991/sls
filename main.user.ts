import { WmeSDK } from "wme-sdk-typings";


// the sdk initScript function will be called after the SDK is initialized
window.SDK_INITIALIZED.then(initScript);

function initScript(): void {

    // initialize the sdk
    if (!window.getWmeSdk) {
        // This block is required for type checking, but it is guaranteed that the function exists.
        throw new Error("SDK not available");
    }

    const wmeSDK: WmeSDK = window.getWmeSdk(
        {
            scriptId: "wme-speedlimits-shortcuts", // TODO: replace with your script id and script name
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
            setSpeed(selectedFeatures.ids[i] as number, speed > 0 ? speed : null);
        }
    }


    /**
     * 
     * @param segId the id of the segment to update
     * @param speed the speed limit to set. If 0 or null, the speed limit will be removed.
     */
    function setSpeed(segId: number, speed: number | null): void {
        const limitToSet = (speed != null && speed > 0) ? speed : null;
        wmeSDK.DataModel.Segments.updateSegment({
            fwdSpeedLimit: limitToSet, // 0 seems to also work to remove the SL, but the docs say null
            revSpeedLimit: limitToSet,
            segmentId: segId
        }
        );
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
    }

    init()
}
