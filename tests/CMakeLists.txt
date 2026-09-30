# SPDX-FileCopyrightText: 2026 RobbyBobby77
# SPDX-License-Identifier: BSD-2-Clause
find_package(Qt6 ${QT_MIN_VERSION} REQUIRED COMPONENTS Test QuickTest)
include(ECMAddTests)
ecm_add_test(keycombinationtest.cpp LINK_LIBRARIES Qt::GuiPrivate Qt::Test PkgConfig::XKBCommon)
add_test(NAME windowstouch-qml COMMAND Qt6::qmltestrunner
    -input ${CMAKE_CURRENT_SOURCE_DIR}/qml
    -import ${CMAKE_BINARY_DIR}/bin
    -import ${CMAKE_CURRENT_SOURCE_DIR}/qml/imports)
set_tests_properties(windowstouch-qml PROPERTIES ENVIRONMENT
    "QT_QPA_PLATFORM=offscreen;QT_QUICK_BACKEND=software;QT_IM_MODULE=qtvirtualkeyboard;QT_VIRTUALKEYBOARD_LAYOUT_PATH=${PROJECT_SOURCE_DIR}/src/layouts")
