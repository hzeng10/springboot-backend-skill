#Requires -Version 5.1
<#
.SYNOPSIS
    将 springboot-backend-skill 安装到 Claude Code / Codex / Gemini / Cursor（Windows PowerShell）
.EXAMPLE
    .\install.ps1 -Project -Agent claude
    .\install.ps1 -User
    .\install.ps1 -Project -Agent claude,codex
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

param(
    [switch]$Project,
    [switch]$User,
    [string[]]$Agent = @('all'),
    [switch]$Help
)

$SkillName = 'springboot-backend-skill'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

function Show-Help {
    Write-Host @"
用法: .\install.ps1 [选项]

将 $SkillName 技能安装到 AI 代理的 skills 目录。

选项:
  -Project        安装到当前项目（.\.claude\skills\ 等），仅当前项目可用（默认）
  -User           安装到用户主目录（`$HOME\.claude\skills\ 等），所有项目可用
  -Agent NAME     指定代理：claude | codex | gemini | cursor | all（逗号分隔，默认 all）
  -Help           显示此帮助

示例:
  .\install.ps1 -Project -Agent claude
  .\install.ps1 -User
  .\install.ps1 -User -Agent claude,codex
"@
}

if ($Help) {
    Show-Help
    exit 0
}

if ($Project -and $User) {
    Write-Error "-Project 与 -User 不能同时指定。"
    exit 1
}

# 默认 -Project
if (-not $Project -and -not $User) {
    $Project = $true
}

# 验证并展开 agent 列表
$ValidAgents = @('claude', 'codex', 'gemini', 'cursor')

$ResolvedAgents = @()
foreach ($a in $Agent) {
    $a = $a.Trim().ToLower()
    if ($a -eq 'all') {
        $ResolvedAgents += $ValidAgents
    } elseif ($ValidAgents -contains $a) {
        $ResolvedAgents += $a
    } else {
        Write-Error "未知代理: $a。有效值：claude | codex | gemini | cursor | all"
        exit 1
    }
}

$ResolvedAgents = $ResolvedAgents | Sort-Object -Unique

# 安装函数
function Install-Skill {
    param([string]$AgentName)

    if ($User) {
        $BaseDir = Join-Path $HOME ".$AgentName"
    } else {
        $BaseDir = Join-Path (Get-Location) ".$AgentName"
    }

    $TargetDir = Join-Path $BaseDir "skills\$SkillName"

    try {
        New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

        # 白名单复制
        $Items = @('SKILL.md', 'README.md', 'AGENTS.md', 'versions.json',
                   'references', 'scripts', 'templates', 'agents')

        foreach ($Item in $Items) {
            $Source = Join-Path $ScriptDir $Item
            if (Test-Path $Source) {
                Copy-Item -Recurse -Force -Path $Source -Destination $TargetDir
            }
        }

        Write-Host "已安装到: $TargetDir"
    } catch {
        Write-Error "安装到 $TargetDir 失败：$_"
        exit 1
    }
}

$ScopeLabel = if ($User) { '用户级' } else { '项目级' }
Write-Host "正在安装 $SkillName（范围：$ScopeLabel）..."
Write-Host ""

foreach ($AgentName in $ResolvedAgents) {
    Install-Skill -AgentName $AgentName
}

Write-Host ""
Write-Host "安装完成。重启 Claude Code（或重新开会话）使技能生效。"
