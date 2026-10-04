// SPDX-FileCopyrightText: 2026 RobbyBobby77
// SPDX-License-Identifier: GPL-3.0-only

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WindowsTouchKeyboardPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const a11ySettings = new Gio.Settings({schema_id: 'org.gnome.desktop.a11y.applications'});

        const page = new Adw.PreferencesPage();
        window.add(page);

        const keyboardGroup = new Adw.PreferencesGroup({title: 'Keyboard'});
        page.add(keyboardGroup);

        const alwaysRow = new Adw.SwitchRow({
            title: 'Show Without a Touchscreen',
            subtitle: 'Open the keyboard for text fields when using a mouse too. GNOME otherwise only shows it after touch input.',
        });
        a11ySettings.bind('screen-keyboard-enabled', alwaysRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        keyboardGroup.add(alwaysRow);

        const fillRow = new Adw.SwitchRow({
            title: 'Fill Screen Width',
            subtitle: 'Dock the keyboard across the bottom instead of a floating, draggable panel',
        });
        settings.bind('fill-screen-width', fillRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        keyboardGroup.add(fillRow);

        const sizeRow = new Adw.SpinRow({
            title: 'Size',
            subtitle: 'Scale of the key area relative to the default height',
            digits: 2,
            adjustment: new Gtk.Adjustment({lower: 0.6, upper: 1.6, step_increment: 0.05, page_increment: 0.1}),
        });
        settings.bind('keyboard-scale', sizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        keyboardGroup.add(sizeRow);

        const languageGroup = new Adw.PreferencesGroup({
            title: 'Languages',
            description: 'English (US) and English (UK) input sources use the Windows-style layout. Other languages use GNOME’s standard layouts with the dark style. Switch languages with the ENG key.',
        });
        page.add(languageGroup);

        const sourcesRow = new Adw.ActionRow({
            title: 'Input Sources',
            subtitle: 'Add or remove keyboard languages in GNOME Settings',
            activatable: true,
        });
        sourcesRow.add_suffix(new Gtk.Image({icon_name: 'adw-external-link-symbolic'}));
        sourcesRow.connect('activated', () => {
            Gio.Subprocess.new(['gnome-control-center', 'keyboard'], Gio.SubprocessFlags.NONE);
        });
        languageGroup.add(sourcesRow);
    }
}
