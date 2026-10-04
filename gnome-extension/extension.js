// SPDX-FileCopyrightText: 2026 RobbyBobby77
// SPDX-License-Identifier: GPL-3.0-only

import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as KeyboardUI from './keyboard.js';

// Same as KeyboardManager._syncEnabled() in js/ui/keyboard.js, but
// constructs the given keyboard class instead of the stock one.
function syncEnabled(KeyboardClass) {
    const enableKeyboard = this._a11yApplicationsSettings.get_boolean('screen-keyboard-enabled');
    const autoEnabled = this._seat.get_touch_mode() && this._lastDeviceIsTouchscreen();
    const enabled = enableKeyboard || autoEnabled;

    if (!enabled && !this._keyboard)
        return;

    if (enabled && !this._keyboard) {
        this._keyboard = new KeyboardClass();
        this._keyboard.connect('visibility-changed', () => {
            this.emit('visibility-changed');
            this._bottomDragGesture.enabled = !this._keyboard.visible;
        });
    } else if (!enabled && this._keyboard) {
        this._keyboard.setCursorLocation(null);
        this._keyboard.destroy();
        this._keyboard = null;
        this._bottomDragGesture.enabled = true;
    }
}

// Drops the current keyboard, if any, and lets _syncEnabled() create a
// new one of whichever class is active.
function recreateKeyboard() {
    const manager = Main.keyboard;
    if (manager._keyboard) {
        manager._keyboard.setCursorLocation(null);
        manager._keyboard.destroy();
        manager._keyboard = null;
        manager._bottomDragGesture.enabled = true;
    }
    manager._syncEnabled();
}

export default class WindowsTouchKeyboardExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        KeyboardUI.setContext({
            settings: this._settings,
            openPreferences: () => this.openPreferences(),
        });

        this._injectionManager = new InjectionManager();
        this._injectionManager.overrideMethod(Main.keyboard, '_syncEnabled', () => {
            return function () {
                syncEnabled.call(this, KeyboardUI.WindowsTouchKeyboard);
            };
        });
        recreateKeyboard();

        // KeyboardManager connects these signals to _syncEnabled.bind(this)
        // at startup, so they keep calling the original method and build a
        // stock keyboard. Handlers connected later run afterwards and swap it.
        const replaceStockKeyboard = () => {
            const keyboard = Main.keyboard._keyboard;
            if (keyboard && !(keyboard instanceof KeyboardUI.WindowsTouchKeyboard))
                recreateKeyboard();
        };
        Main.keyboard._a11yApplicationsSettings.connectObject(
            'changed', replaceStockKeyboard, this);
        Main.keyboard._seat.connectObject(
            'notify::touch-mode', replaceStockKeyboard, this);
    }

    disable() {
        Main.keyboard._a11yApplicationsSettings.disconnectObject(this);
        Main.keyboard._seat.disconnectObject(this);
        this._injectionManager.clear();
        this._injectionManager = null;
        recreateKeyboard();

        KeyboardUI.setContext(null);
        this._settings = null;
    }
}
