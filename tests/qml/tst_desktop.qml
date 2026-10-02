// SPDX-FileCopyrightText: 2026 RobbyBobby77
// SPDX-License-Identifier: GPL-3.0-only
import QtQuick
import QtTest
import QtQuick.VirtualKeyboard
import QtQuick.VirtualKeyboard.Settings

Item {
    width: 940; height: 450
    TextInput {
        id: editor
        x: 20; y: 20; width: 880; height: 40
        inputMethodHints: Qt.ImhNoAutoUppercase | Qt.ImhNoPredictiveText
        focus: true
    }
    InputPanel {
        id: panel
        x: 20; y: 100; width: 900
    }
    SignalSpy {
        id: launcherSpy
        target: panel.keyboard.keyboardLayoutLoader.item
        signalName: "launcherRequested"
    }
    TestCase {
        name: "WindowsTouchLayout"
        when: windowShown
        function initTestCase() {
            // Use this build's style rather than Qt's preferred system installation.
            VirtualKeyboardSettings.styleName = "WindowsTouchTest";
            VirtualKeyboardSettings.activeLocales = ["en_US", "en_GB"];
            VirtualKeyboardSettings.locale = "en_US";
            editor.forceActiveFocus();
            tryVerify(() => panel.keyboard.keyboardLayoutLoader.item !== null);
        }
        function init() {
            VirtualKeyboardSettings.locale = "en_US";
            editor.text = "";
            editor.forceActiveFocus();
            InputContext.priv.shiftHandler.shiftActive = false;
            InputContext.priv.shiftHandler.capsLockActive = false;
            tryVerify(() => panel.keyboard.keyboardLayoutLoader.item !== null);
            const layout = panel.keyboard.keyboardLayoutLoader.item;
            layout.clearModifiers();
            layout.functionActive = false;
        }
        function keys(item, result) {
            result = result || [];
            for (const child of item.children) {
                if (child.keyType !== undefined) result.push(child);
                else keys(child, result);
            }
            return result;
        }
        function findKey(label) {
            const found = keys(panel.keyboard.keyboardLayoutLoader.item).find(k => k.displayText === label);
            verify(found !== undefined, "Missing key: " + label);
            return found;
        }
        function tap(label) {
            const key = findKey(label);
            mouseClick(key, key.width / 2, key.height / 2);
            wait(20);
        }
        function test_rowsHaveHeightAndFit() {
            const layout = panel.keyboard.keyboardLayoutLoader.item;
            const all = keys(layout);
            verify(all.length >= 65);
            for (const key of all) {
                verify(key.width > 15, "Key width collapsed: " + key.displayText);
                verify(key.height > 15, "Key height collapsed: " + key.displayText);
                const position = layout.mapFromItem(key, 0, 0);
                verify(position.y + key.height <= layout.height + 1, "Key exceeds layout: " + key.displayText);
            }
        }
        function test_typingAndBackspace() {
            tap("h"); tap("i");
            compare(editor.text, "hi");
            tap("⌫"); compare(editor.text, "h");
            tap("1"); compare(editor.text, "h1");
        }
        function test_shiftSymbolsAndCaps() {
            tap("Shift"); tap("!"); compare(editor.text, "!");
            InputContext.priv.shiftHandler.shiftActive = false;
            tap("Caps"); tap("a"); compare(editor.text, "!A");
            tap("Caps"); tap("b"); compare(editor.text, "!Ab");
        }
        function test_ctrlSelectsAllAndUnlatches() {
            editor.text = "hello"; editor.cursorPosition = 5;
            tap("Ctrl");
            verify(findKey("Ctrl").highlighted);
            tap("a");
            compare(editor.selectedText, "hello");
            compare(panel.keyboard.keyboardLayoutLoader.item.controlActive, false);
            tap("x"); compare(editor.text, "x");
        }
        function test_fnAndArrowKeys() {
            tap("Fn");
            compare(findKey("F1").key, Qt.Key_F1);
            compare(findKey("F12").key, Qt.Key_F12);
            tap("Fn");
            editor.text = "ab"; editor.cursorPosition = 2;
            tap("‹"); compare(editor.cursorPosition, 1);
            tap("›"); compare(editor.cursorPosition, 2);
        }
        function test_ukShiftSymbols() {
            VirtualKeyboardSettings.locale = "en_GB";
            tryVerify(() => panel.keyboard.keyboardLayoutLoader.item.ukLayout);
            tap("Shift"); tap('"'); compare(editor.text, '"');
        }
        function test_plasmaLauncherWithModifiers() {
            const layout = panel.keyboard.keyboardLayoutLoader.item;
            const launcher = findChild(layout, "plasmaLauncherKey");
            verify(launcher !== null);
            compare(launcher.key, Qt.Key_Meta);
            verify(launcher.noKeyEvent);
            const icon = findChild(launcher, "plasmaLauncherIcon");
            verify(icon !== null);
            verify(icon.visible);
            tryCompare(icon, "status", Image.Ready);
            layout.controlActive = true;
            layout.altActive = true;
            InputContext.priv.shiftHandler.shiftActive = true;
            launcherSpy.clear();
            mouseClick(launcher, launcher.width / 2, launcher.height / 2);
            compare(launcherSpy.count, 1);
            compare(layout.controlActive, false);
            compare(layout.altActive, false);
            compare(editor.text, "");
        }
    }
}
