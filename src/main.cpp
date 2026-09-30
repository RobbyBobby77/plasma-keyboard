/*
    SPDX-FileCopyrightText: 2024 Aleix Pol i Gonzalez <aleixpol@kde.org>
    SPDX-FileCopyrightText: 2025 Kristen McWilliam <kristen@kde.org>

    SPDX-License-Identifier: GPL-2.0-only OR GPL-3.0-only OR LicenseRef-KDE-Accepted-GPL
*/

#include "config-plasma-keyboard.h"
#include "inputpanelintegration.h"
#include "layoutpathhelper.h"
#include "logging.h"
#include "plasmakeyboardsettings.h"
#include <plasma_keyboard_version.h>

#include <KAboutData>
#include <KConfigWatcher>
#include <KCrash>
#include <KLocalizedQmlContext>
#include <KLocalizedString>

#include <QCommandLineParser>
#include <QDir>
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQuickWindow>
#include <QTimer>
#include <QWindow>
#include <qpa/qwindowsysteminterface.h>

int main(int argc, char **argv)
{
    qputenv("QT_IM_MODULE", QByteArray("qtvirtualkeyboard"));

    initLayoutsPath();

    QGuiApplication application(argc, argv);

    KLocalizedString::setApplicationDomain("plasma-keyboard");

    KAboutData aboutData(QStringLiteral("plasma-keyboard-windows"),
                         i18n("Plasma Keyboard — Windows Touch"),
                         QStringLiteral(PLASMA_KEYBOARD_VERSION_STRING),
                         i18n("An on-screen keyboard for Plasma"),
                         KAboutLicense::GPL,
                         i18n("Copyright 2024, Aleix Pol Gonzalez"));

    aboutData.addAuthor(i18n("Aleix Pol Gonzalez"), i18n("Author"), QStringLiteral("aleixpol@kde.org"));
    aboutData.setOrganizationDomain("kde.org");
    aboutData.setDesktopFileName(QStringLiteral("org.kde.plasma.keyboard.windows"));
    application.setWindowIcon(QIcon::fromTheme(QStringLiteral("input-keyboard-virtual")));
    aboutData.setProgramLogo(application.windowIcon());

    KAboutData::setApplicationData(aboutData);

    KCrash::initialize();

    bool preview = false;
    QString previewScreenshot;
    {
        QCommandLineParser parser;
        aboutData.setupCommandLine(&parser);
        parser.addOption({QStringLiteral("preview"), i18n("Open a standalone keyboard preview with a text field")});
        parser.addOption({QStringLiteral("preview-screenshot"), i18n("Save a preview screenshot and exit"), QStringLiteral("path")});
        parser.process(application);
        aboutData.processCommandLine(&parser);
        previewScreenshot = parser.value(QStringLiteral("preview-screenshot"));
        preview = parser.isSet(QStringLiteral("preview")) || !previewScreenshot.isEmpty();
    }

    if (!PLASMA_KEYBOARD_SOUND_ENABLED) {
        PlasmaKeyboardSettings::self()->setSoundEnabled(false);
    }

    if (!PLASMA_KEYBOARD_VIBRATION_ENABLED) {
        PlasmaKeyboardSettings::self()->setVibrationEnabled(false);
    }

    // Listen to config updates from kcm, and reparse
    auto watcher = KConfigWatcher::create(PlasmaKeyboardSettings::self()->sharedConfig());
    // clang-format off
    QObject::connect(watcher.get(),
        &KConfigWatcher::configChanged,
        &application,
        [](const KConfigGroup &, const QByteArrayList &) {
            PlasmaKeyboardSettings::self()->sharedConfig()->reparseConfiguration();
            PlasmaKeyboardSettings::self()->load();
        });
    // clang-format on

    QQmlApplicationEngine view;
    KLocalization::setupLocalizedContext(&view);
    view.setInitialProperties({{QStringLiteral("previewMode"), preview}});

    QObject::connect(&view, &QQmlApplicationEngine::objectCreated, &application, [&application, preview, previewScreenshot](QObject *object) {
        auto window = qobject_cast<QWindow *>(object);
        if (!window) {
            application.exit(1);
            return;
        }
        const bool initSuccessful = preview || initInputPanelIntegration(window, InputPanelRole::Keyboard);

        if (!initSuccessful) {
            qCCritical(PlasmaKeyboard)
                << "Cannot run plasma-keyboard standalone. You can enable it in Plasma's System Settings app, on the “Virtual Keyboard” page.";
            exit(1);
        }

        window->requestActivate();
        window->setVisible(true);
        if (!previewScreenshot.isEmpty()) {
            QTimer::singleShot(1500, window, [window, previewScreenshot, &application] {
                const auto image = qobject_cast<QQuickWindow *>(window)->grabWindow();
                application.exit(image.save(previewScreenshot) ? 0 : 1);
            });
        }
    });
    view.load(QUrl(QStringLiteral("qrc:/qt/qml/org/kde/plasma/keyboard/windows/main.qml")));

    qCDebug(PlasmaKeyboard) << "Starting Plasma Keyboard application";

    return application.exec();
}
