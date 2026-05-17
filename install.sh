#!/usr/bin/env bash
# install.sh — 将 springboot-backend-skill 安装到 Claude Code / Codex / Gemini / Cursor

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_NAME="springboot-backend-skill"

# ── 默认值 ────────────────────────────────────────────────────────────────────
SCOPE="project"
declare -a AGENTS=()

# ── 帮助 ──────────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
用法: $(basename "$0") [选项]

将 ${SKILL_NAME} 技能安装到 AI 代理的 skills 目录。

选项:
  --project       安装到当前项目（./.claude/skills/ 等），仅当前项目可用（默认）
  --user          安装到用户主目录（~/.claude/skills/ 等），所有项目可用
  --agent NAME    指定代理：claude | codex | gemini | cursor | all（可重复，默认 all）
  -h, --help      显示此帮助

示例:
  $(basename "$0") --project --agent claude
  $(basename "$0") --user
  $(basename "$0") --user --agent claude --agent codex
EOF
}

# ── 参数解析 ──────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) SCOPE="project" ;;
    --user)    SCOPE="user" ;;
    --agent)
      shift
      AGENTS+=("$1")
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知选项: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

# ── 代理列表去重 ───────────────────────────────────────────────────────────────
if [[ ${#AGENTS[@]} -eq 0 ]]; then
  AGENTS=("all")
fi

VALID_AGENTS=("claude" "codex" "gemini" "cursor")

expand_agents() {
  local result=()
  for agent in "${AGENTS[@]}"; do
    if [[ "$agent" == "all" ]]; then
      result+=("${VALID_AGENTS[@]}")
    else
      result+=("$agent")
    fi
  done
  # 去重排序
  printf '%s\n' "${result[@]}" | sort -u
}

mapfile -t RESOLVED_AGENTS < <(expand_agents)

# ── 安装函数 ──────────────────────────────────────────────────────────────────
install_skill() {
  local agent="$1"

  if [[ "$SCOPE" == "user" ]]; then
    local base_dir="${HOME}/.${agent}"
  else
    local base_dir="${PWD}/.${agent}"
  fi

  local target="${base_dir}/skills/${SKILL_NAME}"
  mkdir -p "${target}"

  # 白名单复制（排除安装脚本本身和 .git/）
  cp -r \
    "${SCRIPT_DIR}/SKILL.md" \
    "${SCRIPT_DIR}/README.md" \
    "${SCRIPT_DIR}/AGENTS.md" \
    "${SCRIPT_DIR}/versions.json" \
    "${SCRIPT_DIR}/references" \
    "${SCRIPT_DIR}/scripts" \
    "${SCRIPT_DIR}/templates" \
    "${SCRIPT_DIR}/agents" \
    "${target}/"

  echo "已安装到: ${target}"
}

# ── 执行安装 ──────────────────────────────────────────────────────────────────
echo "正在安装 ${SKILL_NAME}（范围：${SCOPE}）..."
echo ""

for agent in "${RESOLVED_AGENTS[@]}"; do
  install_skill "$agent"
done

echo ""
echo "安装完成。重启 Claude Code（或重新开会话）使技能生效。"
