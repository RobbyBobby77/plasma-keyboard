/*
    SPDX-FileCopyrightText: 2024 Aleix Pol i Gonzalez <aleixpol@kde.org>
    SPDX-FileCopyrightText: 2026 Kristen McWilliam <kristen@kde.org>

    SPDX-License-Identifier: GPL-2.0-only OR GPL-3.0-only OR LicenseRef-KDE-Accepted-GPL
*/

import QtQuick
import QtQuick.VirtualKeyboard
import QtQuick.VirtualKeyboard.Settings

import org.kde.plasma.keyboard.windows
import org.kde.plasma.keyboard.windows.lib as PlasmaKeyboard

import org.kde.kirigami as Kirigami

InputPanelWindow {
    id: root
    property bool previewMode: false
    height: previewMode ? Math.min(Math.max(Screen.height * 0.24, 170), 320) + 230 : Screen.height
    width: previewMode ? Math.max(900, Math.min(Screen.width, 1180)) : Screen.width
    color: previewMode ? '#1076c5' : 'transparent'
    flags: previewMode ? Qt.Window : Qt.FramelessWindowHint
    title: qsTr("Plasma Keyboard — Windows Touch Preview")

    Rectangle {
        visible: root.previewMode
        x: 60; y: 30
        width: root.width - 120; height: 70
        radius: 6
        color: "#202020"
        TextEdit {
            id: previewInput
            anchors.fill: parent
            anchors.margins: 18
            color: "#f3f3f3"
            font.pixelSize: 18
            inputMethodHints: Qt.ImhNoAutoUppercase
            text: qsTr("Try typing here with the keyboard…")
            wrapMode: TextEdit.Wrap
            focus: root.previewMode
            Component.onCompleted: if (root.previewMode) forceActiveFocus()
        }
    }

    onVisibleChanged: {
        if (!visible) {
            const layout = inputPanel.keyboard.keyboardLayoutLoader.item;
            if (layout && typeof layout.clearModifiers === "function") {
                layout.clearModifiers();
                layout.functionActive = false;
            }
            // Reset keyboard navigation when hidden
            // Note: keyboard property is internal Qt API
            if (inputPanel.keyboard.navigationModeActive) {
                inputPanel.keyboard.navigationModeActive = false;
            }

            // Close language dialog
            languageDialog.close();
        }
    }

    InputListenerItem {
        id: thing
        focus: !root.previewMode
        engine: inputPanel.InputContext.inputEngine

        keyboardNavigationActive: inputPanel.keyboard.navigationModeActive

        onKeyNavigationPressed: (key) => {
            // HACK: invoke the Qt VirtualKeyboard keyboard navigation feature ourselves
            // See https://github.com/qt/qtvirtualkeyboard/blob/6d810ac41df96f1ad984f56e17f16860bec2abbf/src/virtualkeyboard/qvirtualkeyboardinputcontext_p.h#L110
            inputPanel.InputContext.priv.navigationKeyPressed(key, false);
        }
        onKeyNavigationReleased: (key) => {
            // HACK: invoke the Qt VirtualKeyboard keyboard navigation feature ourselves
            inputPanel.InputContext.priv.navigationKeyReleased(key, false);
        }
    }

    // Unified overlay system for diacritics, emoji, text expansion, etc.
    OverlayWindow {
        id: overlayWindow
        controller: thing.overlayController
        onCandidateSelected: (index) => thing.overlayController.commitCandidate(index)
    }

    interactiveRegion: Qt.rect(panelWrapper.x, panelWrapper.y, panelWrapper.width, panelWrapper.height)

    Kirigami.ShadowedRectangle {
        id: panelWrapper

        LanguagePopup {
            id: languageDialog
            style: inputPanel.keyboard.style
            keyboardPanel: inputPanel

            onShowSettings: root.showSettings()
        }

        // Whether the panel takes the full width of the screen
        readonly property bool isFullScreenWidth: PlasmaKeyboardSettings.panelFillScreenWidth

        color: PlasmaKeyboard.BreezeConstants.keyboardBackgroundColor

        // Provide shadow and radius when the keyboard is detached from edges
        corners {
            // The window isn't floating, so only curve the top
            bottomLeftRadius: 4
            bottomRightRadius: 4
            topLeftRadius: isFullScreenWidth ? 0 : 4
            topRightRadius: isFullScreenWidth ? 0 : 4
        }
        shadow {
            size: isFullScreenWidth ? 0 : 16
            color: Qt.rgba(0, 0, 0, 0.3)
        }

        // Starting x and y centers the panel on the bottom
        x: (root.width / 2) - (width / 2)
        y: root.height - height - (isFullScreenWidth ? 0 : 32)

        // Padding for background corners and panel drag area
        readonly property real padding: 4

        // Never let width & height to be 0, otherwise it can cause problems for setting interactiveRegion
        width: inputPanel.width > 0 ? (inputPanel.width + padding * 2) : 100
        height: inputPanel.height > 0 ? (inputPanel.height + header.height + padding * 2) : 100

        PlasmaKeyboard.KeyboardHeader {
            id: header
            x: parent.padding
            width: parent.width - parent.padding * 2
            panel: panelWrapper
            docked: panelWrapper.isFullScreenWidth
            availableWidth: root.width
            availableHeight: root.height
            onSettingsRequested: root.showSettings()
            onHideRequested: InputContext.priv.hideInputPanel()
            onDockRequested: {
                PlasmaKeyboardSettings.panelFillScreenWidth = !PlasmaKeyboardSettings.panelFillScreenWidth;
                PlasmaKeyboardSettings.save();
                panelWrapper.x = Qt.binding(() => (root.width - panelWrapper.width) / 2);
                panelWrapper.y = Qt.binding(() => root.height - panelWrapper.height - (panelWrapper.isFullScreenWidth ? 0 : 32));
            }
        }

        InputPanel {
            id: inputPanel
            anchors {
                top: parent.top
                topMargin: parent.padding + header.height
                left: parent.left
                leftMargin: parent.padding
            }

            // height is calculated by InputPanel
            width: inputPanel.keyboard.style ? inputPanel.keyboard.style.aspectRatio * inputPanel.keyboard.style.targetKeyboardHeight : 0

            focusPolicy: Qt.NoFocus
            externalLanguageSwitchEnabled: true
            onExternalLanguageSwitch: (localeList, currentIndex) => {
                languageDialog.show(inputPanel.keyboard.activeKey, localeList, currentIndex)
            }

            function updateLocales() {
                if (PlasmaKeyboardSettings.enabledLocales.length === 0) {
                    // If there are no enabled locales, set it to the current locale
                    // NOTE: If Qt.locale().name is not valid, then all keyboard layouts will be shown.
                    let locale = Qt.locale().name;
                    if (locale === "C") {
                        locale = "en_US";
                    }
                    VirtualKeyboardSettings.activeLocales = [locale];
                } else {
                    VirtualKeyboardSettings.activeLocales = PlasmaKeyboardSettings.enabledLocales;
                }
            }

            Connections {
                target: VirtualKeyboardSettings
                function onAvailableLocalesChanged() {
                    inputPanel.updateLocales();
                }
            }

            Connections {
                target: PlasmaKeyboardSettings
                function onEnabledLocalesChanged() {
                    inputPanel.updateLocales();
                }
            }

            Component.onCompleted: {
                VirtualKeyboardSettings.styleName = "WindowsTouch";
                inputPanel.updateLocales();
            }
        }
    }
}
