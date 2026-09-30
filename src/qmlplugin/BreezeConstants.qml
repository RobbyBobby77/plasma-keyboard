// SPDX-FileCopyrightText: 2025 Devin Lin <devin@kde.org>
// SPDX-License-Identifier: LGPL-2.1-only OR LGPL-3.0-only OR LicenseRef-KDE-Accepted-LGPL

import QtQuick

import org.kde.kirigami as Kirigami

pragma Singleton

QtObject {
    // Filled in by the style
    property real scaleHint

    readonly property string fontFamily: Kirigami.Theme.defaultFont.family
    readonly property real keyBackgroundMargin: Math.max(1, Math.round(4 * scaleHint))
    readonly property real keyContentMargin: Math.round(40 * scaleHint)
    readonly property real keyIconScale: scaleHint * 0.5

    property color primaryColor: "#202020"
    property color primaryLightColor: "#353535"
    property color primaryDarkColor: "#515151"
    property color textOnPrimaryColor: "#f3f3f3"
    property color secondaryColor: "#202020"
    property color secondaryLightColor: Qt.lighter(secondaryColor, 1.3)
    property color secondaryDarkColor: Qt.darker(secondaryColor, 1.3)
    property color textOnSecondaryColor: "#f3f3f3"

    property color keyboardBackgroundColor: primaryColor
    property color normalKeyBackgroundColor: "#353535"
    property color normalKeyPressedBackgroundColor: primaryDarkColor
    property color highlightedKeyBackgroundColor: "#515151"
    property color capsLockKeyAccentColor: "#515151"
    property color modeKeyAccentColor: textOnPrimaryColor
    property color keyTextColor: textOnPrimaryColor
    property color keySmallTextColor: "#c0c0c0"
    property color popupBackgroundColor: secondaryColor
    property color popupBorderColor: Kirigami.ColorUtils.tintWithAlpha("#f3f3f3", secondaryColor, 0.9)
    property color popupTextColor: textOnSecondaryColor
    property color popupTextSelectedColor: textOnSecondaryColor
    property color popupHighlightBorderColor: Kirigami.Theme.highlightColor
    property color popupHighlightColor: Qt.rgba(Kirigami.Theme.highlightColor.r, Kirigami.Theme.highlightColor.g, Kirigami.Theme.highlightColor.b, 0.3)
    property color selectionListTextColor: textOnPrimaryColor
    property color selectionListSeparatorColor: primaryLightColor
    property color selectionListBackgroundColor: primaryColor
    property color navigationHighlightColor: Qt.rgba(navigationHighlightBorderColor.r, navigationHighlightBorderColor.g, navigationHighlightBorderColor.b, 0.3)
    property color navigationHighlightBorderColor: Kirigami.Theme.highlightColor

    readonly property real buttonRadius: 1
    readonly property real popupRadius: Kirigami.Units.cornerRadius
}
