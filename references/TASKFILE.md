# Taskfile 任务运行器

## 安装

```bash
# macOS
brew install go-task/tap/go-task

# Linux（apt）
sudo apt install go-task

# Windows（Chocolatey）
choco install go-task

# 通用（curl 安装）
sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b ~/.local/bin
```

## Taskfile.yml

```yaml
version: '3'

vars:
  MVN: '{{if eq OS "windows"}}mvnw.cmd{{else}}./mvnw{{end}}'

tasks:
  build:
    desc: 格式化代码并执行完整构建（含测试和质量门槛）
    cmds:
      - '{{.MVN}} clean spotless:apply verify'

  start:
    desc: 启动本地 Docker Compose 服务（MySQL）
    cmds:
      - docker compose up --force-recreate -d

  stop:
    desc: 停止本地 Docker Compose 服务
    cmds:
      - docker compose down

  restart:
    desc: 重启本地 Docker Compose 服务
    cmds:
      - task: stop
      - docker compose up --force-recreate -d

  run:
    desc: 启动 Spring Boot 应用（自动启动 Docker Compose）
    cmds:
      - '{{.MVN}} spring-boot:run'

  test:
    desc: 只运行单元测试（快速）
    cmds:
      - '{{.MVN}} test'

  verify:
    desc: 运行全量测试（含集成测试、ArchUnit、JaCoCo）
    cmds:
      - '{{.MVN}} verify'

  format:
    desc: 格式化所有 Java 代码（Spotless Palantir）
    cmds:
      - '{{.MVN}} spotless:apply'

  build-image:
    desc: 用 Spring Boot Maven Plugin（Paketo Buildpacks）构建 Docker 镜像
    cmds:
      - '{{.MVN}} spring-boot:build-image -DskipTests'

  clean:
    desc: 清理构建产物
    cmds:
      - '{{.MVN}} clean'
```

## 常用命令

```bash
task build          # 完整构建（格式化 + 全量测试 + 质量门槛）
task start          # 启动 MySQL
task stop           # 停止 MySQL
task restart        # 重启 MySQL
task run            # 启动 Spring Boot 应用
task test           # 仅单元测试
task verify         # 全量测试（含集成测试）
task format         # 格式化代码
task build-image    # 构建 Docker 镜像
task clean          # 清理

task --list         # 列出所有可用任务
```

## 与 Maven 命令的对应关系

| Taskfile 命令 | Maven 等价命令 |
|---|---|
| `task build` | `./mvnw clean spotless:apply verify` |
| `task test` | `./mvnw test` |
| `task verify` | `./mvnw verify` |
| `task format` | `./mvnw spotless:apply` |
| `task build-image` | `./mvnw spring-boot:build-image -DskipTests` |

## 注意事项

- Taskfile 使用 `OS` 变量自动选择 `mvnw` 或 `mvnw.cmd`（跨平台支持）
- `task start` 使用 `--force-recreate` 确保容器使用最新配置
- CI/CD 中直接调用 Maven 命令（不依赖 Taskfile），确保 CI 环境无需安装 go-task
