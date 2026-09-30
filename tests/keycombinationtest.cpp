// SPDX-FileCopyrightText: 2026 RobbyBobby77
// SPDX-License-Identifier: LGPL-2.1-or-later
#include "../src/keycombination.h"
#include <QtTest/QTest>
#include <linux/input-event-codes.h>

class KeyCombinationTest : public QObject
{
    Q_OBJECT
private Q_SLOTS:
    void combinations_data()
    {
        QTest::addColumn<QString>("layout");
        QTest::addColumn<int>("key");
        QTest::addColumn<int>("modifiers");
        QTest::addColumn<uint>("scancode");
        QTest::newRow("ctrl-c-us") << QStringLiteral("us") << int(Qt::Key_C) << int(Qt::ControlModifier) << uint(KEY_C);
        QTest::newRow("ctrl-a-gb") << QStringLiteral("gb") << int(Qt::Key_A) << int(Qt::ControlModifier) << uint(KEY_A);
        QTest::newRow("ctrl-shift-left") << QStringLiteral("us") << int(Qt::Key_Left) << int(Qt::ControlModifier | Qt::ShiftModifier) << uint(KEY_LEFT);
        QTest::newRow("alt-f4") << QStringLiteral("us") << int(Qt::Key_F4) << int(Qt::AltModifier) << uint(KEY_F4);
        QTest::newRow("ctrl-a-french") << QStringLiteral("fr") << int(Qt::Key_A) << int(Qt::ControlModifier) << uint(KEY_Q);
    }
    void combinations()
    {
        QFETCH(QString, layout);
        QFETCH(int, key);
        QFETCH(int, modifiers);
        QFETCH(uint, scancode);
        QXkbCommon::ScopedXKBContext context(xkb_context_new(XKB_CONTEXT_NO_FLAGS));
        const QByteArray layoutName = layout.toLatin1();
        xkb_rule_names names = {};
        names.layout = layoutName.constData();
        QXkbCommon::ScopedXKBKeymap keymap(xkb_keymap_new_from_names(context.get(), &names, XKB_KEYMAP_COMPILE_NO_FLAGS));
        QVERIFY(keymap);
        QXkbCommon::ScopedXKBState state(xkb_state_new(keymap.get()));
        const auto result = keyCombination(keymap.get(), state.get(), key, Qt::KeyboardModifiers(modifiers));
        QVERIFY(result.has_value());
        QCOMPARE(result->scancode, scancode);
        const auto shift = xkb_mod_mask_t(1) << xkb_keymap_mod_get_index(keymap.get(), XKB_MOD_NAME_SHIFT);
        const auto control = xkb_mod_mask_t(1) << xkb_keymap_mod_get_index(keymap.get(), XKB_MOD_NAME_CTRL);
        const auto alt = xkb_mod_mask_t(1) << xkb_keymap_mod_get_index(keymap.get(), XKB_MOD_NAME_ALT);
        QCOMPARE(bool(result->depressed & shift), bool(modifiers & Qt::ShiftModifier));
        QCOMPARE(bool(result->depressed & control), bool(modifiers & Qt::ControlModifier));
        QCOMPARE(bool(result->depressed & alt), bool(modifiers & Qt::AltModifier));
        QCOMPARE(xkb_state_serialize_mods(state.get(), XKB_STATE_MODS_DEPRESSED), 0u);
    }
    void missingKeymap()
    {
        QVERIFY(!keyCombination(nullptr, nullptr, Qt::Key_A, Qt::ControlModifier));
    }
};
QTEST_GUILESS_MAIN(KeyCombinationTest)
#include "keycombinationtest.moc"
