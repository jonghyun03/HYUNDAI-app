#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if [[ -z "$JAVA_HOME" ]]; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null)"
fi
wooricha_python="$(command -v python3)"
if [[ -z "$wooricha_python" ]]; then
  print 'Python 3.9 이상을 설치하세요. MACOS.md를 확인해주세요.'
  read -r '?엔터를 누르면 닫습니다.'
  exit 1
fi
"$wooricha_python" scripts/build-vehicle.py && "$wooricha_python" scripts/run-vehicle.py "$@"
wooricha_status=$?
if [[ $wooricha_status -ne 0 ]]; then
  read -r '?실행 중 문제가 발생했습니다. 엔터를 누르면 닫습니다.'
fi
exit "$wooricha_status"
