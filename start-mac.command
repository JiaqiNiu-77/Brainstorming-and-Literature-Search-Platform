#!/bin/bash

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js。请先安装 Node.js 18 或更高版本：https://nodejs.org/"
  read -r -p "按回车键退出..."
  exit 1
fi

echo "正在启动家电技术创新关键词发散工具..."
echo "启动后请访问：http://localhost:3000/"
node server.js
