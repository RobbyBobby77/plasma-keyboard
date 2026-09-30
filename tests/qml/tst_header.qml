// SPDX-FileCopyrightText: 2026 RobbyBobby77
// SPDX-License-Identifier: GPL-3.0-only
import QtQuick
import QtTest
import org.kde.plasma.keyboard.windows.lib as Keyboard

Item {
    id: scene
    width: 940; height: 450
    Rectangle {
        id: frame
        x: 100; y: 150; width: 500; height: 230
        Keyboard.KeyboardHeader {
            id: header
            width: parent.width; height: implicitHeight
            panel: frame
            availableWidth: scene.width
            availableHeight: scene.height
        }
    }
    SignalSpy { id: settingsSpy; target: header; signalName: "settingsRequested" }
    SignalSpy { id: closeSpy; target: header; signalName: "hideRequested" }
    SignalSpy { id: dockSpy; target: header; signalName: "dockRequested" }
    TestCase {
        name: "WindowsTouchHeader"
        when: windowShown
        function test_controls() {
            mouseClick(findChild(header, "settingsButton")); compare(settingsSpy.count, 1);
            mouseClick(findChild(header, "dockButton")); compare(dockSpy.count, 1);
            mouseClick(findChild(header, "closeButton")); compare(closeSpy.count, 1);
        }
        function test_dragAndDock() {
            const dragArea = findChild(header, "dragArea");
            mouseDrag(dragArea, 250, 12, 100, -50);
            verify(frame.x > 100); verify(frame.y < 150);
            header.docked = true;
            const x = frame.x; const y = frame.y;
            mouseDrag(dragArea, 250, 12, 100, -50);
            compare(frame.x, x); compare(frame.y, y);
        }
    }
}
