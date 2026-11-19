#!/usr/bin/env bash
# apt-get install through a directory of .deb files that CI caches, so a
# re-run installs without reaching a package mirror.
#   apt-cached.sh <deb-dir> <package>...
# A complete cache installs offline; anything else (first run, a new runner
# image needing other dependencies) falls back to the mirror and refills it.
set -euo pipefail
dir="$1"; shift
SUDO=""; [[ "$(id -u)" == 0 ]] || SUDO=sudo
export DEBIAN_FRONTEND=noninteractive
mkdir -p "$dir/partial"
if [[ -f "$dir/.complete" && "$(cat "$dir/.complete")" == "$*" ]] && compgen -G "$dir/*.deb" >/dev/null; then
  if $SUDO apt-get install -y --no-install-recommends "$dir"/*.deb; then exit 0; fi
  echo "Cached packages did not install; using the mirror" >&2
fi
rm -f "$dir/.complete"
$SUDO apt-get update -o Acquire::Retries=3
$SUDO apt-get install -y --no-install-recommends -o Acquire::Retries=3 -o Dir::Cache::archives="$dir" "$@"
$SUDO chmod -R a+rX "$dir"
echo "$*" > "$dir/.complete" # the package list this cache was filled for
