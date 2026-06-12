#!/bin/bash

# 커밋 메시지 기본값
COMMIT_MSG=${1:-"update: automatic deploy"}

echo "Pushing changes with commit message: '$COMMIT_MSG'"
git add .
git commit -m "$COMMIT_MSG"
git push

echo "푸시 완료, Cloudflare Pages가 자동으로 배포를 시작합니다."