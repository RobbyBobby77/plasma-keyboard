// SPDX-FileCopyrightText: 2026 RobbyBobby77
// SPDX-License-Identifier: LGPL-2.1-or-later

#pragma once

#include <QKeyEvent>
#include <QtGui/private/qxkbcommon_p.h>
#include <optional>
#include <xkbcommon/xkbcommon-names.h>

struct KeyCombination {
    uint32_t scancode;
    xkb_mod_mask_t depressed;
    xkb_mod_mask_t latched;
    xkb_mod_mask_t locked;
    xkb_layout_index_t group;
};

inline std::optional<KeyCombination> keyCombination(xkb_keymap *keymap, xkb_state *state, int key, Qt::KeyboardModifiers modifiers)
{
    if (!keymap || !state) {
        return std::nullopt;
    }
    QKeyEvent event(QEvent::KeyPress, key, modifiers);
    const auto symbols = QXkbCommon::toKeysym(&event);
    if (symbols.isEmpty()) {
        return std::nullopt;
    }
    const auto symbol = modifiers.testFlag(Qt::ShiftModifier) ? symbols.first() : xkb_keysym_to_lower(symbols.first());
    const auto group = xkb_state_serialize_layout(state, XKB_STATE_LAYOUT_EFFECTIVE);
    for (auto code = xkb_keymap_min_keycode(keymap); code <= xkb_keymap_max_keycode(keymap); ++code) {
        const auto layouts = xkb_keymap_num_layouts_for_key(keymap, code);
        if (!layouts || code < 8) {
            continue;
        }
        const auto layout = group < layouts ? group : 0;
        // A Qt letter key has no text here, so also match its lowercase form.
        const xkb_keysym_t *keySymbols = nullptr;
        const int count = xkb_keymap_key_get_syms_by_level(keymap, code, layout, 0, &keySymbols);
        bool matches = false;
        for (int i = 0; i < count; ++i) {
            matches |= xkb_keysym_to_lower(keySymbols[i]) == xkb_keysym_to_lower(symbol);
        }
        if (!matches) {
            continue;
        }
        auto depressed = xkb_state_serialize_mods(state, XKB_STATE_MODS_DEPRESSED);
        for (const auto &[qtModifier, name] : {
                 std::pair{Qt::ShiftModifier, XKB_MOD_NAME_SHIFT},
                 std::pair{Qt::ControlModifier, XKB_MOD_NAME_CTRL},
                 std::pair{Qt::AltModifier, XKB_MOD_NAME_ALT},
                 std::pair{Qt::MetaModifier, XKB_MOD_NAME_LOGO},
             }) {
            const auto index = xkb_keymap_mod_get_index(keymap, name);
            if (modifiers.testFlag(qtModifier) && index != XKB_MOD_INVALID) {
                depressed |= xkb_mod_mask_t(1) << index;
            }
        }
        return KeyCombination{code - 8,
                              depressed,
                              xkb_state_serialize_mods(state, XKB_STATE_MODS_LATCHED),
                              xkb_state_serialize_mods(state, XKB_STATE_MODS_LOCKED),
                              group};
    }
    return std::nullopt;
}
