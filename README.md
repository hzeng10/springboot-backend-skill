# springboot-backend-skill

Spring Boot 3.5 + JDK 21 + MySQL 8 后端项目脚手架技能，适用于 Claude Code / Codex / Gemini / Cursor。

## 技术栈

| 组件 | 版本 |
|---|---|
| Spring Boot | 3.5.x |
| Java | 21 (LTS) |
| MySQL | 8.4 (LTS) |
| Flyway | 10.x |
| Spring Modulith | 1.4.x |
| Testcontainers | 1.20.x |
| Spotless | Palantir Java Format |
| JaCoCo | 80% 覆盖率门槛 |
| ArchUnit | Taikai 规则集 |

## 快速生成项目

```bash
node scripts/create-project.mjs <projectName> <groupId> [artifactId] [packageName]

# 示例
node scripts/create-project.mjs my-service com.example
node scripts/create-project.mjs my-service com.example my-service com.example.myservice
```

可选标志：
- `--boot-version 3.5.x` — 指定 Boot 版本（默认自动解析最新 3.5.x）
- `--no-mirror` — 不注入阿里云 Maven 镜像
- `--no-taskfile` — 不生成 Taskfile.yml
- `--no-startup-banner` — 不生成 StartupInfoListener

---

## 安装

### 方式 A：脚本安装（推荐）

**macOS / Linux / Git Bash / WSL：**

```bash
# 项目级：仅当前项目可用，复制到 ./.claude/skills/（以及其他代理目录）
bash install.sh --project

# 用户级：所有项目可用，复制到 ~/.claude/skills/
bash install.sh --user

# 仅安装到 Claude Code（默认会安装到 claude/codex/gemini/cursor 全部）
bash install.sh --project --agent claude
```

**Windows（原生 PowerShell）：**

```powershell
# 项目级
.\install.ps1 -Project

# 用户级
.\install.ps1 -User

# 仅 Claude Code
.\install.ps1 -Project -Agent claude
```

---

### 方式 B：手动复制 — 项目级（仅当前项目加载）

让 Claude Code 仅为某个特定项目加载本技能：

```bash
# 1) 切到目标项目根目录
cd /path/to/your-project

# 2) 创建 Claude Code 项目级技能目录
mkdir -p .claude/skills

# 3) 复制本技能整个目录进去（保持 SKILL.md 在 .claude/skills/springboot-backend-skill/SKILL.md）
cp -r /path/to/springboot-backend-skill .claude/skills/

# 4) 验证目录结构
ls .claude/skills/springboot-backend-skill/SKILL.md   # 应能看到该文件

# 5)（可选）把 .claude/skills/ 加入项目 .gitignore，或随项目一起提交以便团队共享
```

**Windows PowerShell 等价：**

```powershell
cd C:\path\to\your-project
New-Item -ItemType Directory -Force -Path .claude\skills | Out-Null
Copy-Item -Recurse C:\path\to\springboot-backend-skill .claude\skills\
```

**生效方式**：重启 Claude Code（或在 CLI 中重新开会话）。技能会自动出现在该项目会话的 Skill 列表里，并仅在该项目下可用。

---

### 方式 C：手动复制 — 用户级（全局可用）

```bash
mkdir -p ~/.claude/skills
cp -r /path/to/springboot-backend-skill ~/.claude/skills/
```

**Windows：**

```powershell
New-Item -ItemType Directory -Force -Path $HOME\.claude\skills | Out-Null
Copy-Item -Recurse C:\path\to\springboot-backend-skill $HOME\.claude\skills\
```

---

### 路径对照表

| 安装范围 | macOS / Linux / WSL 路径 | Windows 路径 |
|---|---|---|
| 项目级 | `<project>/.claude/skills/springboot-backend-skill/` | `<project>\.claude\skills\springboot-backend-skill\` |
| 用户级 | `~/.claude/skills/springboot-backend-skill/` | `%USERPROFILE%\.claude\skills\springboot-backend-skill\` |

> **优先级**：项目级优先于用户级。如同名技能同时存在，Claude Code 会优先加载项目级版本。

---

## 目录结构

```
springboot-backend-skill/
├── SKILL.md                    # 主技能说明（派遣式格式）
├── README.md                   # 本文件
├── AGENTS.md                   # Claude 硬性约束
├── versions.json               # 版本单一来源
├── install.sh                  # macOS/Linux/Git Bash/WSL 安装脚本
├── install.ps1                 # Windows PowerShell 安装脚本
├── LICENSE                     # Apache-2.0
├── agents/
│   └── code-reviewer.md        # 代码审查子代理（Spring Boot 3.5/MySQL 调优）
├── references/                 # 全部简体中文参考文档
│   ├── PROJECT-SETUP.md
│   ├── SPRING-BOOT-3.5.md
│   ├── CODE-ORGANIZATION.md
│   ├── SPRING-MODULITH.md
│   ├── SERVICE-LAYER.md
│   ├── REST-API.md
│   ├── DATABASE.md
│   ├── DOCKER.md
│   ├── TESTING.md
│   ├── ARCHUNIT.md
│   ├── CONFIGURATION.md
│   ├── LOGGING.md
│   ├── SECURITY.md
│   ├── TASKFILE.md
│   └── MAVEN-MIRROR.md
├── scripts/
│   ├── create-project.mjs      # 主生成脚本（零依赖，纯 Node 内置 API）
│   └── lib/
│       └── versions.mjs        # 版本读取 + 编排辅助函数
└── templates/                  # 覆盖到生成项目的文件模板
    ├── pom-plugins.xml
    ├── pom-enforcer.xml
    ├── settings.xml.aliyun
    ├── compose.yaml
    ├── application.properties
    ├── application-test.properties
    ├── env.sample
    ├── Taskfile.yml
    ├── V1__init.sql
    ├── StartupInfoListener.java.tmpl
    ├── TestcontainersConfiguration.java.tmpl
    ├── BaseIT.java.tmpl
    ├── NoLombokTest.java.tmpl
    ├── ArchitectureTest.java.tmpl
    ├── ModularityTest.java.tmpl
    └── package-info.java.tmpl
```

## 在项目 CLAUDE.md 中启用技能规则

安装技能到 `.claude/skills/` 后，Claude Code 会在该项目会话中自动加载技能，可通过斜杠命令（`/springboot-backend-skill`）手动触发。

若希望 Claude **在该项目中始终自动遵守**本技能的架构约束（无需每次手动触发），在项目根目录的 `CLAUDE.md` 中添加以下内容：

### 最简引用（推荐）

```markdown
## 技术栈与编码规范

本项目使用 Spring Boot 3.5 + JDK 21 + MySQL 8 技术栈。所有 Java 代码生成与项目结构必须遵循
`.claude/skills/springboot-backend-skill/` 技能中定义的规范：

- 参考 `SKILL.md` 了解各主题的完整规范
- 参考 `AGENTS.md` 了解强制性硬性约束（不可绕过）
- 参考 `references/CODE-ORGANIZATION.md` 了解包结构规范
- 参考 `references/DATABASE.md` 了解 Flyway 与 MySQL 规范
- 参考 `references/TESTING.md` 了解测试规范
```

### 完整 CLAUDE.md 模板

将以下内容保存为项目根目录的 `CLAUDE.md`（按实际情况修改 `<>` 占位符）：

```markdown
# <项目名称>

## 项目概述

<简短描述本项目的业务目标>

## 技术栈

Spring Boot 3.5 + JDK 21 + MySQL 8（Maven，Flyway 管理 Schema）。
技能目录：`.claude/skills/springboot-backend-skill/`

## 编码规范（必须遵守）

> 以下规则来自 `.claude/skills/springboot-backend-skill/AGENTS.md`，在本项目中强制执行。

1. **仅 Maven**；禁止 Gradle、Lombok、OpenAPI/springdoc、Buildpacks、Jib
2. **Flyway** 管理所有 Schema 变更；`ddl-auto=validate`；迁移命名 `V{版本}__{描述}.sql`；已发布迁移不可修改
3. `@Entity` / `*Repository` / `*Mapper` / `@RestController` 必须为**包级私有**
4. `.env` 文件**永远不读取、不打印、不记录**
5. 提交前必须通过 `./mvnw spotless:apply verify`（Spotless + ArchUnit + JaCoCo 80%）
6. Spring Modulith 使用 **1.4.x**（Boot 3.5 兼容线）；跨模块通信优先用 `@ApplicationModuleListener`
7. **maven-failsafe-plugin 必须显式声明**，否则 `*IT` 静默跳过
8. 使用**构造器注入**，禁止字段注入（`@Autowired` on field）

## 包结构

遵循领域驱动包结构，详见 `.claude/skills/springboot-backend-skill/references/CODE-ORGANIZATION.md`：

```
com.<groupId>.<artifactId>/
├── Application.java
├── shared/                    # OPEN 模块，跨模块工具
├── <module>/                  # 每个限界上下文一个顶层包
│   ├── package-info.java      # @ApplicationModule 声明
│   ├── <Module>API.java       # public 门面
│   ├── domain/
│   │   ├── models/            # record 值对象、Cmd、Result、Event（@NamedInterface）
│   │   ├── entities/          # 包级私有
│   │   ├── repositories/      # 包级私有
│   │   ├── mappers/           # 包级私有
│   │   └── services/
│   └── rest/
│       ├── controllers/       # 包级私有
│       └── dtos/
└── config/
    ├── WebMvcConfig.java
    └── GlobalExceptionHandler.java
```

## 生成新 Java 类时的默认行为

创建任何 Java 类时，Claude 必须：

- **Entity**：继承 `BaseEntity`（含 `@CreatedDate`/`@LastModifiedDate`/`@Version`），包级私有，表名用 `snake_case`，字符集 `utf8mb4`
- **Repository**：包级私有，继承 `JpaRepository`，只读查询加 `@Transactional(readOnly=true)`
- **Service**：构造器注入，写方法 `@Transactional`，读方法 `@Transactional(readOnly=true)`，入参用 `*Cmd`/`*Query` record，返回 `*Result` record
- **Controller**：包级私有，`@RestController`，请求 DTO 加 `@Valid`，响应返回 DTO 不暴露 Entity，错误统一用 `ProblemDetail`
- **Flyway 迁移**：新增迁移而非修改已有文件，命名 `V{N}__{描述}.sql`，字符集 `utf8mb4_0900_ai_ci`
- **测试**：单测 `*Test`，集成测试 `*IT`（继承 `BaseIT`），使用 AssertJ

## 参考文档

| 主题 | 文件 |
|---|---|
| 包结构 | `.claude/skills/springboot-backend-skill/references/CODE-ORGANIZATION.md` |
| 数据库 / Flyway | `.claude/skills/springboot-backend-skill/references/DATABASE.md` |
| REST API | `.claude/skills/springboot-backend-skill/references/REST-API.md` |
| Service 层 | `.claude/skills/springboot-backend-skill/references/SERVICE-LAYER.md` |
| Spring Modulith | `.claude/skills/springboot-backend-skill/references/SPRING-MODULITH.md` |
| 测试 | `.claude/skills/springboot-backend-skill/references/TESTING.md` |
| 安全 | `.claude/skills/springboot-backend-skill/references/SECURITY.md` |
| 配置 | `.claude/skills/springboot-backend-skill/references/CONFIGURATION.md` |
| 日志 | `.claude/skills/springboot-backend-skill/references/LOGGING.md` |
| 架构测试 | `.claude/skills/springboot-backend-skill/references/ARCHUNIT.md` |
```

### 说明

| 方式 | 效果 | 适用场景 |
|---|---|---|
| 仅安装技能，不修改 CLAUDE.md | 需要手动输入 `/springboot-backend-skill` 触发 | 偶尔使用，不想每次会话都强制加载 |
| 安装技能 + 最简 CLAUDE.md 引用 | Claude 主动查阅规范；仍可按需触发技能 | **推荐**：团队项目，确保一致性 |
| 安装技能 + 完整 CLAUDE.md 模板 | Claude 在每次生成代码时自动应用所有规则 | 新建项目，希望全面约束所有代码生成行为 |

> **注意**：`CLAUDE.md` 中的规则约束 Claude 的行为；技能（Skill）提供详细参考文档和可调用的脚手架命令。两者协同工作效果最佳。

---

## 参考来源

| 来源仓库 | 主要贡献 |
|---|---|
| [jdubois/dr-jskill](https://github.com/jdubois/dr-jskill) | 生成脚本架构、AGENTS.md 约束、dotfiles 安全约定、CONFIGURATION/LOGGING/SECURITY/DOCKER 参考文档、StartupInfoListener、Maven Enforcer + no-Lombok |
| [sivaprasadreddy/sivalabs-agent-skills](https://github.com/sivaprasadreddy/sivalabs-agent-skills) | SKILL.md 派遣式格式、install.sh 多 agent 安装、领域驱动包结构、XCmd/XResult 模式、Maven 质量插件、REST API ProblemDetail、Taikai ArchUnit、Taskfile、code-reviewer 子代理 |

## 许可证

Apache License 2.0
