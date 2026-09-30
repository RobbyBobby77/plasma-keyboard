#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 RobbyBobby77
# SPDX-License-Identifier: BSD-2-Clause
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
prefix_dir="${PLASMA_KEYBOARD_WINDOWS_PREFIX:-$project_dir/install}"
if [[ ! -x "$prefix_dir/bin/plasma-keyboard-windows" ]]; then
    echo "Build and install into $prefix_dir first; see README.md." >&2
    exit 1
fi
export QML_IMPORT_PATH="$prefix_dir/lib/qml:$prefix_dir/lib64/qml:$prefix_dir/lib/qt6/qml:${QML_IMPORT_PATH:-}"
export XDG_DATA_DIRS="$prefix_dir/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
exec "$prefix_dir/bin/plasma-keyboard-windows" "$@"
