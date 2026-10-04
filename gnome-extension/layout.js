// SPDX-FileCopyrightText: 2026 RobbyBobby77
// SPDX-License-Identifier: GPL-3.0-only

// Port of src/layouts/components/DesktopLayout.qml. Widths are in key units,
// row heights are relative weights, matching the QML weights divided by 100.

import Clutter from 'gi://Clutter';

export const ROW_HEIGHTS = [0.7, 1, 1, 1, 1];

const letters = str => [...str].map(c => ({type: 'letter', base: c}));

const sym = (base, shifted, extra = {}) => ({type: 'symbol', base, shifted, ...extra});

const fkey = (base, shifted, fn) => sym(base, shifted, {fn});

const key = (label, keyval, width = 1) => ({type: 'key', label, keyval, width});

export function getDesktopLayout(uk) {
    return [
        [
            key('Esc', Clutter.KEY_Escape),
            sym('`', uk ? '¬' : '~'),
            fkey('1', '!', Clutter.KEY_F1),
            fkey('2', uk ? '"' : '@', Clutter.KEY_F2),
            fkey('3', uk ? '£' : '#', Clutter.KEY_F3),
            fkey('4', '$', Clutter.KEY_F4),
            fkey('5', '%', Clutter.KEY_F5),
            fkey('6', '^', Clutter.KEY_F6),
            fkey('7', '&', Clutter.KEY_F7),
            fkey('8', '*', Clutter.KEY_F8),
            fkey('9', '(', Clutter.KEY_F9),
            fkey('0', ')', Clutter.KEY_F10),
            fkey('-', '_', Clutter.KEY_F11),
            fkey('=', '+', Clutter.KEY_F12),
            {type: 'backspace', width: 1.45},
        ],
        [
            key('Tab', Clutter.KEY_Tab, 1.5),
            ...letters('qwertyuiop'),
            sym('[', '{'),
            sym(']', '}'),
            uk ? sym('#', '~', {extended: ['\\', '|']}) : sym('\\', '|'),
            key('Del', Clutter.KEY_Delete),
        ],
        [
            {type: 'caps', width: 2},
            ...letters('asdfghjkl'),
            sym(';', ':'),
            sym('\'', uk ? '@' : '"'),
            key('Enter', Clutter.KEY_Return, 2.45),
        ],
        [
            {type: 'shift', width: 2.5},
            ...letters('zxcvbnm'),
            sym(',', '<'),
            sym('.', '>'),
            sym('/', '?'),
            key('↑', Clutter.KEY_Up),
            {type: 'shift', width: 1.95},
        ],
        [
            {type: 'modifier', label: 'Ctrl', keyval: Clutter.KEY_Control_L},
            {type: 'fn'},
            {type: 'super'},
            {type: 'modifier', label: 'Alt', keyval: Clutter.KEY_Alt_L},
            {type: 'space', width: 5.5},
            {type: 'modifier', label: 'Alt', keyval: Clutter.KEY_Alt_L},
            {type: 'modifier', label: 'Ctrl', keyval: Clutter.KEY_Control_L},
            key('‹', Clutter.KEY_Left),
            key('↓', Clutter.KEY_Down),
            key('›', Clutter.KEY_Right),
            {type: 'language'},
        ],
    ];
}
