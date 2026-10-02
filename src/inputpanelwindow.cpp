/*
    SPDX-FileCopyrightText: 2025 Devin Lin <devin@kde.org>
    SPDX-FileCopyrightText: 2026 Kristen McWilliam <kristen@kde.org>

    SPDX-License-Identifier: GPL-2.0-only OR GPL-3.0-only OR LicenseRef-KDE-Accepted-GPL
*/

#include "inputpanelwindow.h"

#include "inputpanelintegration.h"

#include <KSandbox>
#include <QDBusConnection>
#include <QDBusMessage>
#include <QDBusPendingCallWatcher>
#include <QDBusPendingReply>
#include <QDesktopServices>
#include <QProcess>
#include <qnamespace.h>

InputPanelWindow::InputPanelWindow(QWindow *parent)
    : QQuickWindow{parent}
{
    setFlag(Qt::FramelessWindowHint);
}

QRect InputPanelWindow::interactiveRegion() const
{
    return m_interactiveRegion;
}

void InputPanelWindow::setInteractiveRegion(QRect interactiveRegion)
{
    if (interactiveRegion == m_interactiveRegion) {
        return;
    }
    m_interactiveRegion = interactiveRegion;
    Q_EMIT interactiveRegionChanged();

    // Set only a part of the window to be interactive
    setMask(QRegion(m_interactiveRegion));
}

void InputPanelWindow::showSettings()
{
    if (KSandbox::isInside()) {
        QProcess::startDetached(QStringLiteral("kcmshell6"), {QStringLiteral("kcm_plasmakeyboardwindows")});
    } else {
        QDesktopServices::openUrl(QUrl(QStringLiteral("systemsettings:kcm_plasmakeyboardwindows")));
    }
}

bool InputPanelWindow::initInputPanel(InputPanelRole::Role role)
{
    return initInputPanelIntegration(this, role);
}

void InputPanelWindow::showLauncher()
{
    const auto message = QDBusMessage::createMethodCall(QStringLiteral("org.kde.plasmashell"),
                                                        QStringLiteral("/PlasmaShell"),
                                                        QStringLiteral("org.kde.PlasmaShell"),
                                                        QStringLiteral("activateLauncherMenu"));
    auto *watcher = new QDBusPendingCallWatcher(QDBusConnection::sessionBus().asyncCall(message), this);
    connect(watcher, &QDBusPendingCallWatcher::finished, this, [](QDBusPendingCallWatcher *call) {
        const QDBusPendingReply<> reply = *call;
        if (reply.isError()) {
            qWarning() << "Could not open the Plasma application launcher:" << reply.error().message();
        }
        call->deleteLater();
    });
}

#include "moc_inputpanelwindow.cpp"
