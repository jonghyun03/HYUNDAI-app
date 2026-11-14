#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
wooricha_node="$(command -v node)"
if [[ -z "$wooricha_node" ]]; then
  for wooricha_candidate in "$HOME"/.nvm/versions/node/*/bin/node(N); do
    wooricha_node="$wooricha_candidate"
  done
fi
if [[ -z "$wooricha_node" ]]; then
  print 'Node.js 설치가 필요합니다. 이 화면을 개발자에게 알려주세요.'
  read -r '?엔터를 누르면 닫습니다.'
  exit 1
fi
export PATH="$(dirname -- "$wooricha_node"):$PATH"
"$wooricha_node" scripts/launch.mjs
wooricha_result=$?
if [[ $wooricha_result -ne 0 ]]; then
  read -r '?시작 중 문제가 발생했습니다. 엔터를 누르면 닫습니다.'
fi
exit "$wooricha_result"
