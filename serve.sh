#!/bin/bash
# 로컬에서 앱을 미리보기 위한 간단한 서버
# 사용법: ./serve.sh  (기본 포트 8000, 다른 포트를 쓰려면 ./serve.sh 9000)
PORT="${1:-8000}"
cd "$(dirname "$0")/docs"
echo "http://localhost:$PORT 에서 미리보기 (Ctrl+C로 종료)"
python3 -m http.server "$PORT"
