// SPDX-FileCopyrightText: 2026 RobbyBobby77
// SPDX-License-Identifier: GPL-3.0-only

// Windows-touch-style replacement for GNOME Shell's on-screen keyboard.
//
// WindowsTouchKeyboard subclasses the stock Keyboard so it keeps GNOME's
// integration (showing on text-field focus, sliding the focused window,
// IBus/emoji/suggestions, input-source switching) and only replaces the
// key layout, the header and the panel geometry. The overridden methods
// mirror js/ui/keyboard.js from GNOME Shell 50.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Keyboard from 'resource:///org/gnome/shell/ui/keyboard.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as InputSourceManager from 'resource:///org/gnome/shell/ui/status/keyboard.js';

import {getDesktopLayout, ROW_HEIGHTS} from './layout.js';

const KEY_LONG_PRESS_TIME = 250;
const SHIFT_DOUBLE_TAP_TIME = 400;

// Logical pixels; keep in sync with stylesheet.css.
const HEADER_HEIGHT = 42;
const PANEL_PADDING = 4;
const FLOATING_GAP = 32;

// Same sizing as the Qt style: key area height is 24% of the screen,
// clamped to 170–320px, and the compact panel is 3.35 times as wide.
const KEY_AREA_SCREEN_FRACTION = 0.24;
const KEY_AREA_MIN_HEIGHT = 170;
const KEY_AREA_MAX_HEIGHT = 320;
const COMPACT_ASPECT_RATIO = 3.35;
const FONT_SIZE_FRACTION = 0.076;

let context = null;

/**
 * @param {{settings: Gio.Settings, openPreferences: Function} | null} ctx
 */
export function setContext(ctx) {
    context = ctx;
}

function scaleFactor() {
    return St.ThemeContext.get_for_stage(global.stage).scale_factor;
}

// Lays out children along one axis in proportion to their `_wtWeight`,
// like the Qt KeyboardRow/KeyboardColumn weights.
const WeightedLayout = GObject.registerClass(
class WeightedLayout extends Clutter.LayoutManager {
    _init(vertical) {
        super._init();
        this._vertical = vertical;
    }

    vfunc_get_preferred_width(_container, _forHeight) {
        return [0, 0];
    }

    vfunc_get_preferred_height(_container, _forWidth) {
        return [0, 0];
    }

    vfunc_allocate(container, box) {
        const children = [...container].filter(c => c.visible);
        const total = children.reduce((sum, c) => sum + (c._wtWeight ?? 1), 0);
        const length = this._vertical ? box.get_height() : box.get_width();
        let accumulated = 0;

        for (const child of children) {
            const start = Math.round(accumulated / total * length);
            accumulated += child._wtWeight ?? 1;
            const end = Math.round(accumulated / total * length);

            const childBox = new Clutter.ActorBox();
            if (this._vertical) {
                childBox.set_origin(box.x1, box.y1 + start);
                childBox.set_size(box.get_width(), end - start);
            } else {
                childBox.set_origin(box.x1 + start, box.y1);
                childBox.set_size(end - start, box.get_height());
            }
            child.allocate(childBox);
        }
    }
});

const WtKey = GObject.registerClass({
    Signals: {
        'pressed': {},
        // The argument is true when the press was cancelled (popup shown,
        // key destroyed), so the key must not be activated.
        'released': {param_types: [GObject.TYPE_BOOLEAN]},
        'long-press': {},
        'commit': {param_types: [GObject.TYPE_STRING]},
    },
}, class WtKey extends St.BoxLayout {
    _init(spec) {
        super._init({
            style_class: 'wt-key-container',
            x_expand: true,
            y_expand: true,
        });

        this.spec = spec;
        this._wtWeight = spec.width ?? 1;
        this._extendedKeys = spec.extended ?? [];
        this._pressed = false;
        this._pressTimeoutId = 0;
        this._touchPressSlot = null;
        this._capturedPress = false;

        this._content = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        if (spec.iconName) {
            this._content.add_child(new St.Icon({icon_name: spec.iconName}));
        } else {
            this._smallLabel = new St.Label({
                style_class: 'wt-key-small',
                x_align: Clutter.ActorAlign.CENTER,
                visible: false,
            });
            this._label = new St.Label({
                style_class: 'wt-key-label',
                x_align: Clutter.ActorAlign.CENTER,
            });
            this._content.add_child(this._smallLabel);
            this._content.add_child(this._label);
            this.setLabel(spec.label ?? '');
        }

        this.keyButton = this._makeButton(this._content, () => this._press(), cancelled => this._release(cancelled));
        if (spec.styleClass)
            this.keyButton.add_style_class_name(spec.styleClass);
        this.add_child(this.keyButton);

        this.connect('destroy', this._onDestroy.bind(this));
    }

    setLabel(text, smallText = null) {
        if (!this._label)
            return;

        this._label.text = text;
        this._smallLabel.text = smallText ?? '';
        this._smallLabel.visible = smallText !== null;
        if (smallText !== null)
            this._label.add_style_class_name('wt-has-small');
        else
            this._label.remove_style_class_name('wt-has-small');
    }

    setLatched(latched) {
        if (latched)
            this.keyButton.add_style_pseudo_class('latched');
        else
            this.keyButton.remove_style_pseudo_class('latched');
    }

    setLocked(locked) {
        if (locked)
            this.keyButton.add_style_class_name('wt-locked');
        else
            this.keyButton.remove_style_class_name('wt-locked');
    }

    _makeButton(child, onPress, onRelease) {
        const button = new St.Button({
            style_class: 'wt-key',
            x_expand: true,
            y_expand: true,
            can_focus: false,
            child,
        });

        button.connect('button-press-event', () => {
            onPress();
            return Clutter.EVENT_STOP;
        });
        button.connect('button-release-event', () => {
            onRelease(false);
            return Clutter.EVENT_STOP;
        });
        button.connect('touch-event', (actor, event) => {
            const slot = event.get_event_sequence().get_slot();
            const type = event.type();

            if (!this._touchPressSlot && type === Clutter.EventType.TOUCH_BEGIN) {
                this._touchPressSlot = slot;
                onPress();
            } else if (type === Clutter.EventType.TOUCH_END ||
                       type === Clutter.EventType.TOUCH_CANCEL) {
                if (!this._touchPressSlot || this._touchPressSlot === slot)
                    onRelease(type === Clutter.EventType.TOUCH_CANCEL);

                if (this._touchPressSlot === slot)
                    this._touchPressSlot = null;
            }
            return Clutter.EVENT_STOP;
        });

        return button;
    }

    _press() {
        if (this._pressed)
            return;

        this._pressed = true;
        this.keyButton.add_style_pseudo_class('active');
        this._pressTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, KEY_LONG_PRESS_TIME, () => {
            this._pressTimeoutId = 0;
            this.emit('long-press');

            if (this._extendedKeys.length > 0) {
                this._touchPressSlot = null;
                this._release(true);
                this._showSubkeys();
            }
            return GLib.SOURCE_REMOVE;
        });
        this.emit('pressed');
    }

    _release(cancelled) {
        if (this._pressTimeoutId) {
            GLib.source_remove(this._pressTimeoutId);
            this._pressTimeoutId = 0;
        }

        if (!this._pressed)
            return;

        this._pressed = false;
        this.keyButton.remove_style_pseudo_class('active');
        this.keyButton.set_hover(false);
        this.emit('released', cancelled);
    }

    _ensureSubkeysPopup() {
        if (this._boxPointer)
            return;

        this._boxPointer = new BoxPointer.BoxPointer(St.Side.BOTTOM);
        this._boxPointer.add_style_class_name('keyboard-subkeys-boxpointer');
        this._boxPointer.add_style_class_name('wt-subkeys');
        this._boxPointer.hide();
        Main.layoutManager.addTopChrome(this._boxPointer);
        this._boxPointer.setPosition(this.keyButton, 0.5);

        const box = new St.BoxLayout({style_class: 'wt-subkeys-box'});
        for (const str of this._extendedKeys) {
            const label = new St.Label({
                text: str,
                style_class: 'wt-key-label',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            const button = this._makeButton(label,
                () => button.add_style_pseudo_class('active'),
                cancelled => {
                    button.remove_style_pseudo_class('active');
                    if (!cancelled)
                        this.emit('commit', str);
                    this._hideSubkeys();
                });
            // Recognised by the stock Keyboard/KeyboardManager as part of
            // the keyboard when the popup takes key focus or a grab is active.
            button.extendedKey = str;
            button.set_size(...this.keyButton.allocation.get_size());
            box.add_child(button);
        }
        this._boxPointer.bin.add_child(box);
        this.keyButton._extendedKeys = box;
    }

    _showSubkeys() {
        this._ensureSubkeysPopup();
        this._boxPointer.set_style(this.get_parent()?.get_parent()?.get_style() ?? null);
        this._boxPointer.open(BoxPointer.PopupAnimation.FULL);
        global.stage.connectObject('captured-event', this._onCapturedEvent.bind(this), this);
        this.keyButton.connectObject('notify::mapped', () => {
            if (!this.keyButton.is_mapped())
                this._hideSubkeys();
        }, this);
    }

    _hideSubkeys() {
        this._boxPointer?.close(BoxPointer.PopupAnimation.FULL);
        global.stage.disconnectObject(this);
        this.keyButton.disconnectObject(this);
        this._capturedPress = false;
    }

    _onCapturedEvent(actor, event) {
        const type = event.type();
        const press = type === Clutter.EventType.BUTTON_PRESS || type === Clutter.EventType.TOUCH_BEGIN;
        const release = type === Clutter.EventType.BUTTON_RELEASE || type === Clutter.EventType.TOUCH_END;
        const targetActor = global.stage.get_event_actor(event);

        if (targetActor === this._boxPointer.bin || this._boxPointer.bin.contains(targetActor))
            return Clutter.EVENT_PROPAGATE;

        if (press)
            this._capturedPress = true;
        else if (release && this._capturedPress)
            this._hideSubkeys();

        return Clutter.EVENT_STOP;
    }

    _onDestroy() {
        this._hideSubkeys();
        this._boxPointer?.destroy();
        this._boxPointer = null;
        this._release(true);
    }
});

const DesktopPage = GObject.registerClass(
class DesktopPage extends St.Widget {
    _init(uk, languageLabel) {
        super._init({
            style_class: 'wt-page',
            layout_manager: new WeightedLayout(true),
            x_expand: true,
            y_expand: true,
        });

        // Read by the stock Keyboard code paths that touch pages.
        this.shiftKeys = [];
        this.ratio = [15.5, 4.7];

        this.shift = false;
        this.shiftLocked = false;
        this.capsLock = false;
        this.fnActive = false;
        this.entries = [];

        getDesktopLayout(uk).forEach((row, i) => {
            const rowActor = new St.Widget({
                style_class: 'wt-row',
                layout_manager: new WeightedLayout(false),
                x_expand: true,
            });
            rowActor._wtWeight = ROW_HEIGHTS[i];

            for (const spec of row) {
                const key = new WtKey(this._decorate(spec, languageLabel));
                rowActor.add_child(key);
                this.entries.push({key, spec});
            }
            this.add_child(rowActor);
        });

        this._sync();
    }

    _decorate(spec, languageLabel) {
        switch (spec.type) {
        case 'backspace':
            return {...spec, iconName: 'edit-clear-symbolic'};
        case 'super':
            return {...spec, iconName: 'start-here-symbolic'};
        case 'shift':
            return {...spec, label: 'Shift'};
        case 'caps':
            return {...spec, label: 'Caps'};
        case 'fn':
            return {...spec, label: 'Fn'};
        case 'space':
            return {...spec, label: ''};
        case 'language':
            return {...spec, label: languageLabel, styleClass: 'wt-key-language'};
        default:
            return spec;
        }
    }

    getRatio() {
        return this.ratio;
    }

    letterText(spec, forShortcut) {
        const upper = forShortcut ? this.shift : this.shift || this.capsLock;
        return upper ? spec.base.toUpperCase() : spec.base;
    }

    symbolText(spec) {
        return this.shift ? spec.shifted : spec.base;
    }

    setShift(shift) {
        this.shift = shift;
        this._sync();
    }

    setShiftLocked(locked) {
        this.shiftLocked = locked;
        this._sync();
    }

    setCaps(caps) {
        this.capsLock = caps;
        this._sync();
    }

    setFn(fn) {
        this.fnActive = fn;
        this._sync();
    }

    _sync() {
        for (const {key, spec} of this.entries) {
            switch (spec.type) {
            case 'letter':
                key.setLabel(this.letterText(spec, false));
                break;
            case 'symbol':
                if (this.fnActive && spec.fn)
                    key.setLabel(`F${spec.fn - Clutter.KEY_F1 + 1}`);
                else
                    key.setLabel(this.symbolText(spec), this.shift ? spec.base : spec.shifted);
                break;
            case 'shift':
                key.setLatched(this.shift);
                key.setLocked(this.shiftLocked);
                break;
            case 'caps':
                key.setLatched(this.capsLock);
                break;
            case 'fn':
                key.setLatched(this.fnActive);
                break;
            }
        }
    }
});

function desktopLayoutFor(group, purpose) {
    const P = Clutter.InputContentPurpose;
    if ([P.DIGITS, P.NUMBER, P.PHONE].includes(purpose))
        return null;

    const base = (group ?? 'us').split('+')[0];
    if (base !== 'us' && base !== 'gb')
        return null;

    const shortName = InputSourceManager.getInputSourceManager().currentSource?.shortName ?? 'en';
    const label = shortName.toLowerCase().startsWith('en') ? 'ENG' : shortName.toUpperCase();
    return {uk: base === 'gb', label, id: `${base}:${label}`};
}

export const WindowsTouchKeyboard = GObject.registerClass(
class WindowsTouchKeyboard extends Keyboard.Keyboard {
    _setupKeyboard() {
        super._setupKeyboard();

        this.add_style_class_name('wt-keyboard');
        // Children with x_expand would otherwise make keyboardBox stretch
        // the compact panel to the monitor width.
        this.x_expand = false;
        this._wtHeader = this._wtCreateHeader();
        this.insert_child_at_index(this._wtHeader, 0);
        this._suggestions.hide();

        context.settings.connectObject('changed::fill-screen-width', () => {
            this._wtDragX = 0;
            this._wtDragY = 0;
            this._relayout();
        }, 'changed::keyboard-scale', () => this._relayout(), this);

        // Runs before the stock destroy handler, while the virtual
        // keyboard device still exists.
        this.connect('destroy', () => {
            this._wtReleaseHeld();
            this._keyboardController.toggleDelete(false);
            this._wtEndDrag();
            if (this._keyboardVisible || this.get_transition('translation-y'))
                global.compositor.enable_unredirect();
            this._wtDestroyed = true;
        });

        this._relayout();
    }

    // Header: settings / drag handle / hide on top, compact toggle below,
    // matching KeyboardHeader.qml.
    _wtCreateHeader() {
        const header = new St.BoxLayout({
            style_class: 'wt-header',
            orientation: Clutter.Orientation.VERTICAL,
            reactive: true,
            x_expand: true,
        });

        this._wtHeaderButtons = [];
        const makeButton = (iconName, accessibleName, callback) => {
            const button = new St.Button({
                style_class: 'wt-header-button',
                can_focus: false,
                accessible_name: accessibleName,
                child: new St.Icon({icon_name: iconName}),
            });
            button.connect('clicked', callback);
            this._wtHeaderButtons.push(button);
            return button;
        };

        const top = new St.BoxLayout({style_class: 'wt-header-top', x_expand: true});
        top.add_child(makeButton('emblem-system-symbolic', 'Keyboard settings',
            () => context?.openPreferences()));
        const handleArea = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });
        handleArea.add_child(new St.Widget({
            style_class: 'wt-drag-handle',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        top.add_child(handleArea);
        top.add_child(makeButton('window-close-symbolic', 'Hide keyboard', () => {
            this.close(true);
            this._updateLevelFromHints(true);
        }));
        header.add_child(top);

        header.add_child(new St.Widget({style_class: 'wt-header-separator', x_expand: true}));

        const bottom = new St.BoxLayout({style_class: 'wt-header-bottom', x_expand: true});
        this._wtDockButton = makeButton('input-keyboard-symbolic', '', () => {
            context.settings.set_boolean('fill-screen-width', !this._wtIsFill());
        });
        bottom.add_child(this._wtDockButton);
        header.add_child(bottom);

        header.connect('event', this._wtOnHeaderEvent.bind(this));
        return header;
    }

    _wtIsFill() {
        return context?.settings.get_boolean('fill-screen-width') ?? false;
    }

    _wtOnHeaderEvent(actor, event) {
        const type = event.type();
        const T = Clutter.EventType;

        if (type !== T.BUTTON_PRESS && type !== T.TOUCH_BEGIN)
            return Clutter.EVENT_PROPAGATE;
        if (this._wtDrag || this._wtIsFill())
            return Clutter.EVENT_PROPAGATE;

        // Leave presses on the header buttons to their click gestures.
        const target = global.stage.get_event_actor(event);
        if (this._wtHeaderButtons.some(b => b === target || b.contains(target)))
            return Clutter.EVENT_PROPAGATE;
        if (type === T.BUTTON_PRESS && event.get_button() !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;

        const [x, y] = event.get_coords();
        this._wtDrag = {
            x, y,
            dragX: this._wtDragX ?? 0,
            dragY: this._wtDragY ?? 0,
            slot: event.get_event_sequence()?.get_slot() ?? -1,
        };

        // Follow the drag from the stage instead of taking a Clutter grab:
        // a grab moves keyboard focus away from the client, which closes
        // the panel, and motion outside the header would otherwise go to
        // whatever is underneath.
        this._wtDragCaptureId = global.stage.connect('captured-event',
            this._wtOnDragCaptured.bind(this));
        return Clutter.EVENT_STOP;
    }

    _wtOnDragCaptured(stage, event) {
        const type = event.type();
        const T = Clutter.EventType;

        // Follow only the pointer or the touch point that started the drag.
        const slot = event.get_event_sequence()?.get_slot() ?? -1;
        if (slot !== this._wtDrag.slot)
            return Clutter.EVENT_PROPAGATE;

        if (type === T.MOTION || type === T.TOUCH_UPDATE) {
            const [x, y] = event.get_coords();
            this._wtDragX = this._wtDrag.dragX + (x - this._wtDrag.x);
            this._wtDragY = this._wtDrag.dragY - (y - this._wtDrag.y);
            this._wtApplyPosition();
            return Clutter.EVENT_STOP;
        }

        if (type === T.BUTTON_RELEASE || type === T.TOUCH_END || type === T.TOUCH_CANCEL) {
            this._wtEndDrag();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _wtEndDrag() {
        if (this._wtDragCaptureId) {
            global.stage.disconnect(this._wtDragCaptureId);
            this._wtDragCaptureId = 0;
        }
        this._wtDrag = null;
    }

    _wtShownY() {
        const gap = this._wtIsFill() ? 0 : FLOATING_GAP * scaleFactor() + (this._wtDragY ?? 0);
        return -((this._wtHeight ?? this.height) + gap);
    }

    // Clamps the drag offsets to the monitor and applies the panel position.
    _wtApplyPosition() {
        const monitor = Main.layoutManager.keyboardMonitor;
        if (!monitor)
            return;

        // Use the computed size, not the allocation, which may be stale.
        const width = this._wtWidth ?? this.width;
        const height = this._wtHeight ?? this.height;

        if (this._wtIsFill()) {
            this._wtDragX = 0;
            this._wtDragY = 0;
            this.translation_x = 0;
        } else {
            const baseX = (monitor.width - width) / 2;
            const gap = FLOATING_GAP * scaleFactor();
            this._wtDragX = Math.clamp(this._wtDragX ?? 0, -baseX, monitor.width - width - baseX);
            this._wtDragY = Math.clamp(this._wtDragY ?? 0, -gap, monitor.height - height - gap);
            this.translation_x = Math.round(baseX + this._wtDragX);
        }

        if (this._keyboardVisible && !this.get_transition('translation-y'))
            this.translation_y = this._wtShownY();
    }

    _wtSuggestionsHeight() {
        const suggestions = this._suggestions;
        if (!suggestions?.visible || suggestions.get_n_children() === 0)
            return 0;
        return suggestions.get_preferred_height(-1)[1];
    }

    _relayout() {
        const monitor = Main.layoutManager.keyboardMonitor;
        if (!monitor || !context)
            return;

        const scale = scaleFactor();
        const fill = this._wtIsFill();
        const userScale = context.settings.get_double('keyboard-scale');
        const logicalHeight = monitor.height / scale;
        const keyAreaHeight = Math.round(Math.min(
            Math.clamp(logicalHeight * KEY_AREA_SCREEN_FRACTION, KEY_AREA_MIN_HEIGHT, KEY_AREA_MAX_HEIGHT) * userScale,
            logicalHeight * 0.6));
        const padding = PANEL_PADDING * scale;

        const width = fill
            ? monitor.width
            : Math.min(monitor.width, Math.round(keyAreaHeight * COMPACT_ASPECT_RATIO * scale) + 2 * padding);
        const header = this._wtHeader ? HEADER_HEIGHT * scale : 0;

        this._wtWidth = width;
        this._wtHeight = keyAreaHeight * scale + header + this._wtSuggestionsHeight() + 2 * padding;
        this.width = this._wtWidth;
        this.height = this._wtHeight;
        this._wtKeyArea = [width - 2 * padding, keyAreaHeight * scale];
        this._wtFontSize = Math.max(10, Math.round(keyAreaHeight * FONT_SIZE_FRACTION));

        if (fill)
            this.remove_style_class_name('wt-floating');
        else
            this.add_style_class_name('wt-floating');
        if (this._wtDockButton)
            this._wtDockButton.accessible_name = fill ? 'Use compact keyboard' : 'Fill screen width';

        this._wtSyncPage();
        this._wtApplyPosition();
    }

    _wtSyncPage() {
        const page = this._desktopPage;
        if (!page || !this._wtKeyArea)
            return;

        page.set_style(`font-size: ${this._wtFontSize}px;`);
        page.ratio = this._wtKeyArea;
        if (this._currentPage === page)
            this._aspectContainer.setRatio(...page.ratio);
    }

    _updateLayout(groupName, purpose) {
        const desktop = desktopLayoutFor(groupName, purpose);
        if (!desktop) {
            this._desktopPage = null;
            super._updateLayout(groupName, purpose);
            return;
        }

        // Keep Caps/Fn state when only the content purpose changed.
        if (this._desktopPage?.layoutId === desktop.id)
            return;

        this._wtReleaseHeld();
        this._modifiers.clear();
        this._modifierKeys.clear();

        const layout = new Clutter.Actor({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });
        const page = new DesktopPage(desktop.uk, desktop.label);
        page.layoutId = desktop.id;
        this._wtConnectPage(page);
        layout.add_child(page);
        page.hide();

        this._aspectContainer.add_child(layout);
        this._currentLayout?.destroy();
        this._currentLayout = layout;
        this._layers = {default: page, shift: page};
        this._desktopPage = page;
        this._wtSyncPage();
    }

    _setActiveLevel(activeLevel) {
        const page = this._desktopPage;
        if (!page || this._layers?.[activeLevel] !== page) {
            super._setActiveLevel(activeLevel);
            return;
        }

        if (this._currentPage !== page) {
            if (this._currentPage) {
                this._setCurrentLevelLatched(this._currentPage, false);
                this._currentPage.disconnect(this._currentPage._destroyID);
                this._currentPage.hide();
                delete this._currentPage._destroyID;
            }
            this._currentPage = page;
            page._destroyID = page.connect('destroy', () => {
                this._currentPage = null;
            });
        }

        page.setShift(activeLevel === 'shift');
        this._updateCurrentPageVisible();
        this._aspectContainer.setRatio(...page.getRatio());
    }

    _setCurrentLevelLatched(layout, latched) {
        if (layout && layout === this._desktopPage) {
            layout.setShiftLocked(latched);
            return;
        }
        super._setCurrentLevelLatched(layout, latched);
    }

    _updateLevelFromHints(userInputHappened) {
        // With Caps Lock on, auto-capitalisation must not shift symbols.
        const page = this._desktopPage;
        if (page && this._currentPage === page && page.capsLock) {
            if (userInputHappened && !this._latched)
                this._setActiveLevel('default');
            return;
        }
        super._updateLevelFromHints(userInputHappened);
    }

    _wtConnectPage(page) {
        for (const {key, spec} of page.entries) {
            switch (spec.type) {
            case 'letter':
                key.connect('released', (_k, cancelled) => {
                    if (!cancelled)
                        this._wtCommit(page.letterText(spec, this._modifiers.size > 0));
                });
                break;
            case 'symbol':
                key.connect('released', (_k, cancelled) => {
                    if (cancelled)
                        return;
                    if (page.fnActive && spec.fn)
                        this._wtTap(spec.fn);
                    else
                        this._wtCommit(page.symbolText(spec));
                });
                key.connect('commit', (_k, str) => this._wtCommit(str));
                break;
            case 'space':
                key.connect('released', (_k, cancelled) => {
                    if (!cancelled)
                        this._wtCommit(' ');
                });
                break;
            case 'key':
                // Held like a physical key, so the client's key repeat
                // works for arrows, Delete and so on.
                key.connect('pressed', () => this._wtHoldPress(key, spec.keyval));
                key.connect('released', () => this._wtHoldRelease(key));
                break;
            case 'backspace':
                key.connect('pressed', () => {
                    if (this._modifiers.size > 0)
                        this._wtHoldPress(key, Clutter.KEY_BackSpace);
                });
                key.connect('long-press', () => {
                    if (!key._wtHeld)
                        this._keyboardController.toggleDelete(true);
                });
                key.connect('released', (_k, cancelled) => {
                    if (this._wtDestroyed)
                        return;
                    if (key._wtHeld) {
                        this._wtHoldRelease(key);
                        return;
                    }
                    if (!cancelled)
                        this._keyboardController.toggleDelete(true);
                    this._keyboardController.toggleDelete(false);
                    this._updateLevelFromHints(true);
                });
                break;
            case 'shift':
                key.connect('long-press', () => {
                    this._setActiveLevel('shift');
                    this._setLatched(true);
                    this._wtShiftLongPressed = true;
                });
                key.connect('released', (_k, cancelled) => {
                    if (!cancelled)
                        this._wtShiftTapped(page);
                });
                break;
            case 'caps':
                key.connect('released', (_k, cancelled) => {
                    if (!cancelled)
                        page.setCaps(!page.capsLock);
                });
                break;
            case 'modifier': {
                const keys = this._modifierKeys.get(spec.keyval) ?? [];
                keys.push(key);
                this._modifierKeys.set(spec.keyval, keys);
                key.connect('released', (_k, cancelled) => {
                    if (!cancelled)
                        this._toggleModifier(spec.keyval);
                });
                break;
            }
            case 'fn':
                key.connect('released', (_k, cancelled) => {
                    if (!cancelled)
                        page.setFn(!page.fnActive);
                });
                break;
            case 'super':
                key.connect('released', (_k, cancelled) => {
                    if (cancelled)
                        return;
                    this._disableAllModifiers();
                    if (Main.overview.visible)
                        Main.overview.hide();
                    else
                        Main.overview.showApps();
                });
                break;
            case 'language':
                key.connect('released', (_k, cancelled) => {
                    if (!cancelled)
                        this._popupLanguageMenu(key);
                });
                break;
            }
        }
    }

    _popupLanguageMenu(keyActor) {
        // GNOME Shell 50 builds the popup but then throws on the
        // non-existent BoxPointer.AnimationMode before opening it.
        try {
            super._popupLanguageMenu(keyActor);
        } catch (e) {
            if (!(e instanceof TypeError))
                throw e;
        }
        this._languagePopup?.open(BoxPointer.PopupAnimation.FULL);
    }

    _wtShiftTapped(page) {
        if (this._wtShiftLongPressed) {
            this._wtShiftLongPressed = false;
            return;
        }

        const now = GLib.get_monotonic_time();
        if (this._latched) {
            this._setLatched(false);
            this._setActiveLevel('default');
        } else if (page.shift && now - (this._wtShiftTime ?? 0) < SHIFT_DOUBLE_TAP_TIME * 1000) {
            this._setLatched(true);
        } else if (page.shift) {
            this._setActiveLevel('default');
        } else {
            this._setActiveLevel('shift');
            this._wtShiftTime = now;
        }
    }

    _wtCommit(str) {
        if (this._wtDestroyed)
            return;

        this._keyboardController.commit(str, this._modifiers).then(() => {
            this._disableAllModifiers();
            this._updateLevelFromHints(true);
        }).catch(console.error);
    }

    _wtActiveModifiers() {
        const modifiers = [...this._modifiers];
        if (this._desktopPage?.shift)
            modifiers.push(Clutter.KEY_Shift_L);
        return modifiers;
    }

    _wtTap(keyval) {
        const controller = this._keyboardController;
        const modifiers = this._wtActiveModifiers();
        modifiers.forEach(m => controller.keyvalPress(m));
        controller.keyvalPress(keyval);
        controller.keyvalRelease(keyval);
        modifiers.reverse().forEach(m => controller.keyvalRelease(m));
        this._disableAllModifiers();
        this._updateLevelFromHints(true);
    }

    _wtHoldPress(key, keyval) {
        if (key._wtHeld || this._wtDestroyed)
            return;

        const modifiers = this._wtActiveModifiers();
        modifiers.forEach(m => this._keyboardController.keyvalPress(m));
        this._keyboardController.keyvalPress(keyval);
        key._wtHeld = {keyval, modifiers};
        (this._wtHeldKeys ??= new Set()).add(key);
    }

    _wtHoldRelease(key) {
        const held = key._wtHeld;
        if (!held || this._wtDestroyed)
            return;

        delete key._wtHeld;
        this._wtHeldKeys.delete(key);
        this._keyboardController.keyvalRelease(held.keyval);
        held.modifiers.reverse().forEach(m => this._keyboardController.keyvalRelease(m));
        this._disableAllModifiers();
        this._updateLevelFromHints(true);
    }

    _wtReleaseHeld() {
        for (const key of [...this._wtHeldKeys ?? []])
            this._wtHoldRelease(key);
    }

    _close() {
        super._close();
        if (!this._keyboardRequested) {
            this._wtReleaseHeld();
            this._wtEndDrag();
            this._desktopPage?.setFn(false);
        }
    }

    // The overrides below match the stock versions, except that the shown
    // position includes the floating gap and the drag offset.
    _animateShow() {
        global.compositor.disable_unredirect();

        if (this._focusWindow)
            this._animateWindow(this._focusWindow, true);

        Main.layoutManager.keyboardBox.show();
        this.ease({
            translation_y: this._wtShownY(),
            opacity: 255,
            duration: Keyboard.KEYBOARD_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._animateShowComplete();
            },
        });
        this._keyboardVisible = true;
        this.emit('visibility-changed');
    }

    _animateShowComplete() {
        const keyboardBox = Main.layoutManager.keyboardBox;
        this._keyboardHeightNotifyId = keyboardBox.connect('notify::height', () => {
            this.translation_y = this._wtShownY();
        });
    }

    gestureProgress(delta) {
        this._gestureInProgress = true;
        Main.layoutManager.keyboardBox.show();
        const shown = -this._wtShownY();
        const progress = Math.min(delta, shown) / shown;
        this.translation_y = -shown * progress;
        this.opacity = 255 * progress;
        const windowActor = this._focusWindow?.get_compositor_private();
        if (windowActor)
            windowActor.y = this._focusWindowStartY - (this.height * progress);
    }

    // A floating keyboard leaves windows where they are, like the
    // Windows touch keyboard; the docked one slides them up as usual.
    setCursorLocation(window, x, y, w, h) {
        if (window && !this._wtIsFill()) {
            this._setFocusWindow(null);
            return;
        }
        super.setCursorLocation(window, x, y, w, h);
    }

    addSuggestion(text, callback) {
        super.addSuggestion(text, callback);
        this._relayout();
    }

    resetSuggestions() {
        super.resetSuggestions();
        this._suggestions?.hide();
        this._relayout();
    }
});
