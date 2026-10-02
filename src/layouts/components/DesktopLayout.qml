// SPDX-FileCopyrightText: 2026 RobbyBobby77
// SPDX-License-Identifier: GPL-3.0-only

import QtQuick
import QtQuick.Layouts
import QtQuick.VirtualKeyboard
import QtQuick.VirtualKeyboard.Components

KeyboardLayout {
    id: desktop
    inputMode: InputEngine.InputMode.Latin
    keyWeight: 100
    property bool ukLayout: false
    property bool controlActive: false
    property bool altActive: false
    property bool functionActive: false
    signal launcherRequested()
    readonly property int shortcutModifiers: (controlActive ? Qt.ControlModifier : 0)
                                              | (altActive ? Qt.AltModifier : 0)
                                              | (InputContext.shiftActive ? Qt.ShiftModifier : 0)

    function clearModifiers() {
        controlActive = false;
        altActive = false;
    }

    onVisibleChanged: if (!visible) { clearModifiers(); functionActive = false; }
    Connections {
        target: InputContext
        function onInputItemChanged() { desktop.clearModifiers(); }
    }

    component DesktopKey: Key {
        // Qt's built-in Key only forwards Shift. Route latched shortcuts explicitly.
        noKeyEvent: desktop.controlActive || desktop.altActive
        showPreview: false
        onClicked: {
            if (noKeyEvent) {
                InputContext.sendKeyClick(key, "", desktop.shortcutModifiers);
                desktop.clearModifiers();
            }
        }
    }

    component SymbolKey: DesktopKey {
        property string baseText
        property string shiftedText
        noModifier: true
        text: InputContext.shiftActive ? shiftedText : baseText
        smallText: InputContext.shiftActive ? baseText : shiftedText
        smallTextVisible: true
    }

    component FunctionKey: Key {
        functionKey: true
        showPreview: false
        noModifier: true
        noKeyEvent: true
        onClicked: {
            InputContext.sendKeyClick(key, "", desktop.shortcutModifiers);
            desktop.clearModifiers();
        }
    }

    component ModifierKey: Key {
        property bool controlKey: false
        text: controlKey ? "Ctrl" : "Alt"
        functionKey: true
        noKeyEvent: true
        noModifier: true
        highlighted: controlKey ? desktop.controlActive : desktop.altActive
        onClicked: {
            if (controlKey) desktop.controlActive = !desktop.controlActive;
            else desktop.altActive = !desktop.altActive;
        }
    }
    KeyboardRow {
        Layout.fillHeight: true
        Layout.preferredHeight: 70
        FunctionKey { key: Qt.Key_Escape; text: "Esc" }
        SymbolKey { key: Qt.Key_QuoteLeft; baseText: "`"; shiftedText: desktop.ukLayout ? "¬" : "~" }
        SymbolKey {
            key: desktop.functionActive ? Qt.Key_F1 : Qt.Key_1
            baseText: "1"; shiftedText: "!"
            displayText: desktop.functionActive ? "F1" : text
            smallTextVisible: !desktop.functionActive
            noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive
        }
        SymbolKey {
            key: desktop.functionActive ? Qt.Key_F2 : Qt.Key_2
            baseText: "2"; shiftedText: desktop.ukLayout ? '"' : "@"
            displayText: desktop.functionActive ? "F2" : text
            smallTextVisible: !desktop.functionActive
            noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive
        }
        SymbolKey {
            key: desktop.functionActive ? Qt.Key_F3 : Qt.Key_3
            baseText: "3"; shiftedText: desktop.ukLayout ? "£" : "#"
            displayText: desktop.functionActive ? "F3" : text
            smallTextVisible: !desktop.functionActive
            noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive
        }
        SymbolKey {
            key: desktop.functionActive ? Qt.Key_F4 : Qt.Key_4
            baseText: "4"; shiftedText: "$"
            displayText: desktop.functionActive ? "F4" : text
            smallTextVisible: !desktop.functionActive
            noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive
        }
        SymbolKey {
            key: desktop.functionActive ? Qt.Key_F5 : Qt.Key_5
            baseText: "5"; shiftedText: "%"
            displayText: desktop.functionActive ? "F5" : text
            smallTextVisible: !desktop.functionActive
            noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive
        }
        SymbolKey {
            key: desktop.functionActive ? Qt.Key_F6 : Qt.Key_6
            baseText: "6"; shiftedText: "^"
            displayText: desktop.functionActive ? "F6" : text
            smallTextVisible: !desktop.functionActive
            noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive
        }
        SymbolKey {
            key: desktop.functionActive ? Qt.Key_F7 : Qt.Key_7
            baseText: "7"; shiftedText: "&"
            displayText: desktop.functionActive ? "F7" : text
            smallTextVisible: !desktop.functionActive
            noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive
        }
        SymbolKey {
            key: desktop.functionActive ? Qt.Key_F8 : Qt.Key_8
            baseText: "8"; shiftedText: "*"
            displayText: desktop.functionActive ? "F8" : text
            smallTextVisible: !desktop.functionActive
            noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive
        }
        SymbolKey {
            key: desktop.functionActive ? Qt.Key_F9 : Qt.Key_9
            baseText: "9"; shiftedText: "("
            displayText: desktop.functionActive ? "F9" : text
            smallTextVisible: !desktop.functionActive
            noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive
        }
        SymbolKey {
            key: desktop.functionActive ? Qt.Key_F10 : Qt.Key_0
            baseText: "0"; shiftedText: ")"
            displayText: desktop.functionActive ? "F10" : text
            smallTextVisible: !desktop.functionActive
            noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive
        }
        SymbolKey { key: desktop.functionActive ? Qt.Key_F11 : Qt.Key_Minus; baseText: "-"; shiftedText: "_"; displayText: desktop.functionActive ? "F11" : text; smallTextVisible: !desktop.functionActive; noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive }
        SymbolKey { key: desktop.functionActive ? Qt.Key_F12 : Qt.Key_Equal; baseText: "="; shiftedText: "+"; displayText: desktop.functionActive ? "F12" : text; smallTextVisible: !desktop.functionActive; noKeyEvent: desktop.functionActive || desktop.controlActive || desktop.altActive }
        FunctionKey { key: Qt.Key_Backspace; text: "⌫"; weight: 145 }
    }
    KeyboardRow {
        Layout.fillHeight: true
        Layout.preferredHeight: 100
        FunctionKey { key: Qt.Key_Tab; text: "Tab"; weight: 150 }
        DesktopKey { key: Qt.Key_Q; text: "q" }
        DesktopKey { key: Qt.Key_W; text: "w" }
        DesktopKey { key: Qt.Key_E; text: "e" }
        DesktopKey { key: Qt.Key_R; text: "r" }
        DesktopKey { key: Qt.Key_T; text: "t" }
        DesktopKey { key: Qt.Key_Y; text: "y" }
        DesktopKey { key: Qt.Key_U; text: "u" }
        DesktopKey { key: Qt.Key_I; text: "i" }
        DesktopKey { key: Qt.Key_O; text: "o" }
        DesktopKey { key: Qt.Key_P; text: "p" }
        SymbolKey { key: Qt.Key_BracketLeft; baseText: "["; shiftedText: "{" }
        SymbolKey { key: Qt.Key_BracketRight; baseText: "]"; shiftedText: "}" }
        SymbolKey { key: desktop.ukLayout ? Qt.Key_NumberSign : Qt.Key_Backslash; alternativeKeys: desktop.ukLayout ? ["\\", "|"] : []; baseText: desktop.ukLayout ? "#" : "\\"; shiftedText: desktop.ukLayout ? "~" : "|" }
        FunctionKey { key: Qt.Key_Delete; text: "Del" }
    }
    KeyboardRow {
        Layout.fillHeight: true
        Layout.preferredHeight: 100
        Key {
            text: "Caps"; weight: 200; functionKey: true; noKeyEvent: true; noModifier: true
            highlighted: InputContext.capsLockActive
            onClicked: InputContext.priv.shiftHandler.capsLockActive = !InputContext.capsLockActive
        }
        DesktopKey { key: Qt.Key_A; text: "a" }
        DesktopKey { key: Qt.Key_S; text: "s" }
        DesktopKey { key: Qt.Key_D; text: "d" }
        DesktopKey { key: Qt.Key_F; text: "f" }
        DesktopKey { key: Qt.Key_G; text: "g" }
        DesktopKey { key: Qt.Key_H; text: "h" }
        DesktopKey { key: Qt.Key_J; text: "j" }
        DesktopKey { key: Qt.Key_K; text: "k" }
        DesktopKey { key: Qt.Key_L; text: "l" }
        SymbolKey { key: Qt.Key_Semicolon; baseText: ";"; shiftedText: ":" }
        SymbolKey { key: Qt.Key_Apostrophe; baseText: "'"; shiftedText: desktop.ukLayout ? "@" : '"' }
        FunctionKey { key: Qt.Key_Return; text: "Enter"; weight: 245 }
    }
    KeyboardRow {
        Layout.fillHeight: true
        Layout.preferredHeight: 100
        ShiftKey { displayText: "Shift"; weight: 250 }
        DesktopKey { key: Qt.Key_Z; text: "z" }
        DesktopKey { key: Qt.Key_X; text: "x" }
        DesktopKey { key: Qt.Key_C; text: "c" }
        DesktopKey { key: Qt.Key_V; text: "v" }
        DesktopKey { key: Qt.Key_B; text: "b" }
        DesktopKey { key: Qt.Key_N; text: "n" }
        DesktopKey { key: Qt.Key_M; text: "m" }
        SymbolKey { key: Qt.Key_Comma; baseText: ","; shiftedText: "<" }
        SymbolKey { key: Qt.Key_Period; baseText: "."; shiftedText: ">" }
        SymbolKey { key: Qt.Key_Slash; baseText: "/"; shiftedText: "?" }
        FunctionKey { key: Qt.Key_Up; text: "↑" }
        ShiftKey { displayText: "Shift"; weight: 195 }
    }
    KeyboardRow {
        Layout.fillHeight: true
        Layout.preferredHeight: 100
        ModifierKey { controlKey: true }
        Key {
            text: "Fn"; functionKey: true; noModifier: true; noKeyEvent: true
            highlighted: desktop.functionActive
            onClicked: desktop.functionActive = !desktop.functionActive
        }
        Key {
            objectName: "plasmaLauncherKey"
            key: Qt.Key_Meta
            functionKey: true
            noKeyEvent: true
            noModifier: true
            Accessible.name: qsTr("Open Plasma application launcher")
            onClicked: {
                desktop.clearModifiers();
                desktop.launcherRequested();
            }
        }
        ModifierKey {}
        SpaceKey {
            weight: 550
            noKeyEvent: desktop.controlActive || desktop.altActive
        }
        ModifierKey {}
        ModifierKey { controlKey: true }
        FunctionKey { key: Qt.Key_Left; text: "‹" }
        FunctionKey { key: Qt.Key_Down; text: "↓" }
        FunctionKey { key: Qt.Key_Right; text: "›" }
        ChangeLanguageKey { enabled: true }
    }
}
