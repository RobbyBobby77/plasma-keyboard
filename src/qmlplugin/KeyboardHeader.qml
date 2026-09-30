// SPDX-FileCopyrightText: 2026 RobbyBobby77
// SPDX-License-Identifier: GPL-3.0-only

import QtQuick
import QtQuick.Controls as QQC2

Item {
    id: header
    property bool docked: false
    property Item panel
    property real availableWidth
    property real availableHeight
    signal settingsRequested()
    signal hideRequested()
    signal dockRequested()
    implicitHeight: 42

    MouseArea {
        objectName: "dragArea"
        anchors.fill: parent
        enabled: !header.docked
        cursorShape: pressed ? Qt.ClosedHandCursor : Qt.OpenHandCursor
        drag.target: header.panel
        drag.minimumX: 0
        drag.maximumX: Math.max(0, header.availableWidth - header.panel.width)
        drag.minimumY: 0
        drag.maximumY: Math.max(0, header.availableHeight - header.panel.height)
    }
    Rectangle {
        width: 42; height: 2
        anchors.horizontalCenter: parent.horizontalCenter
        y: 10
        color: "#737373"
        radius: 1
    }
    Rectangle {
        anchors.left: parent.left; anchors.right: parent.right
        anchors.top: parent.top; anchors.topMargin: 24
        height: 1
        color: "#2b2b2b"
    }
    component HeaderButton: QQC2.ToolButton {
        id: headerButton
        width: 32; height: 24
        focusPolicy: Qt.NoFocus
        background: Rectangle { color: parent.hovered || parent.down ? "#3d3d3d" : "transparent"; radius: 2 }
        contentItem: Text {
            text: headerButton.icon.name === "settings-configure" ? "⚙"
                : headerButton.icon.name === "window-close" ? "×" : "▤"
            color: "#d0d0d0"
            font.pixelSize: 13
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
        }
    }
    HeaderButton {
        objectName: "settingsButton"
        x: 2; y: 0
        icon.name: "settings-configure"
        Accessible.name: qsTr("Keyboard settings")
        QQC2.ToolTip.text: Accessible.name
        QQC2.ToolTip.visible: hovered
        onClicked: header.settingsRequested()
    }
    HeaderButton {
        objectName: "dockButton"
        x: 2; y: 25; height: 17
        icon.name: "input-keyboard-virtual"
        Accessible.name: header.docked ? qsTr("Use compact keyboard") : qsTr("Fill screen width")
        QQC2.ToolTip.text: Accessible.name
        QQC2.ToolTip.visible: hovered
        onClicked: header.dockRequested()
    }
    HeaderButton {
        objectName: "closeButton"
        anchors.right: parent.right
        y: 0
        icon.name: "window-close"
        Accessible.name: qsTr("Hide keyboard")
        QQC2.ToolTip.text: Accessible.name
        QQC2.ToolTip.visible: hovered
        onClicked: header.hideRequested()
    }
}
