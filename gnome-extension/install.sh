#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 RobbyBobby77
# SPDX-License-Identifier: BSD-2-Clause
#
# Packs the GNOME Shell extension and installs it for the current user.
set -euo pipefail

src_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
out_dir="$src_dir/../dist"
uuid="windows-touch-keyboard@robbybobby77.github.io"

mkdir -p "$out_dir"
gnome-extensions pack "$src_dir" --force --out-dir="$out_dir" \
    --extra-source=keyboard.js \
    --extra-source=layout.js \
    --schema=schemas/org.gnome.shell.extensions.windows-touch-keyboard.gschema.xml
gnome-extensions install --force "$out_dir/$uuid.shell-extension.zip"

echo "Installed $uuid."
echo "On Wayland, log out and back in so GNOME Shell finds it, then run:"
echo "  gnome-extensions enable $uuid"
