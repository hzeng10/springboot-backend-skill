---
name: springboot-backend-skill
description: 创建 Spring Boot 3.5 + JDK 21 + MySQL 8 后端项目，遵循领域驱动设计与质量工程最佳实践。当用户要创建新的 Spring Boot 后端项目、需要项目脚手架、或询问 Spring Boot/MySQL 最佳实践时使用此技能。
---

# Spring Boot 3.5 + JDK 21 + MySQL 技能

## 项目初始化

从 Spring Initializr 生成项目并应用所有 dotfiles 和配置：

```bash
node scripts/create-project.mjs <projectName> <groupId> [artifactId] [packageName]
```

详见 `references/PROJECT-SETUP.md`。

## 包结构与代码组织

采用领域驱动的包结构，每个顶层业务包即一个 Spring Modulith 应用模块。Controller、Repository、Mapper、Entity 均为包级私有。

详见 `references/CODE-ORGANIZATION.md`。

## Spring Modulith 模块化单体

使用 Spring Modulith 1.4.x（Boot 3.5 兼容线）管理模块边界。通过 `@ApplicationModuleListener` 实现异步跨模块事件，通过 `ApplicationModules.verify()` 在 CI 中验证边界。

详见 `references/SPRING-MODULITH.md`。

## Service 层

Service 使用构造器注入，命令对象 `XCmd`、结果对象 `XResult`、查询对象 `XQuery`。写方法加 `@Transactional`，查询方法加 `@Transactional(readOnly=true)`。跨模块通信优先用领域事件而非直接注入。

详见 `references/SERVICE-LAYER.md`。

## REST API

`@RestController` 加 `@Valid` 校验请求 DTO，统一用 `ProblemDetail`（RFC 7807）返回错误，`GlobalExceptionHandler` 继承 `ResponseEntityExceptionHandler`。用 `Converter` 将路径参数绑定到值对象。

详见 `references/REST-API.md`。

## 数据库（MySQL + Flyway）

MySQL 8.4 + utf8mb4_0900_ai_ci + Asia/Shanghai 时区。Flyway 管理 Schema（`V{版本}__{描述}.sql`），`ddl-auto=validate`。开启批量写入 `rewriteBatchedStatements=true`，启用 Hibernate 批处理。

详见 `references/DATABASE.md`。

## Docker Compose

本地开发用 `compose.yaml` 启动 MySQL 8.4，集成 `spring-boot-docker-compose` 自动管理容器生命周期。

详见 `references/DOCKER.md`。

## 测试

单测 `*Test`（Surefire），集成测试 `*IT`（Failsafe，必须显式声明插件）。`BaseIT` 基类集成 Testcontainers `@ServiceConnection` 自动连接 MySQL，`@Sql` 预置测试数据。

详见 `references/TESTING.md`。

## 架构测试

Taikai ArchUnit 强制命名规范、访问限制、Spring 约定。`NoLombokTest` 禁止 Lombok 依赖。Maven Enforcer 插件二次封锁。

详见 `references/ARCHUNIT.md`。

## 配置与 Profile

用 `.properties`（不用 YAML），`@ConfigurationProperties` + `@Validated` 优于 `@Value`。Profile 切换用 `application-{dev,test,prod}.properties`。

详见 `references/CONFIGURATION.md`。

## 日志

仅 Logback + SLF4J，参数化日志，永不记录密码/PII/token，生产环境 AsyncAppender + 滚动策略。

详见 `references/LOGGING.md`。

## 安全

Spring Security 按需启用。无状态 REST 用 JWT（jjwt 0.12.5），lambda DSL，BCrypt 加密，ProblemDetail 错误响应。

详见 `references/SECURITY.md`。

## 任务运行器

用 Taskfile 封装常用命令：build / start / stop / restart / build-image。

详见 `references/TASKFILE.md`。

## 阿里云 Maven 镜像

项目级 `.mvn/settings.xml` 注入阿里云镜像，不污染全局。生成时默认启用，`--no-mirror` 可关闭。

详见 `references/MAVEN-MIRROR.md`。

## Spring Boot 3.5 + JDK 21 特性

虚拟线程（`spring.threads.virtual.enabled=true`）、record patterns、SequencedCollection、Boot 3.5 关键改动。

详见 `references/SPRING-BOOT-3.5.md`。

---

## 硬性规则（必须遵守）

1. **禁止** Lombok、OpenAPI/springdoc、Gradle、Buildpacks、Jib
2. **Flyway** 管理 Schema；`ddl-auto=validate`；迁移文件命名 `V{版本}__{描述}.sql`；已发布迁移不可修改
3. Entity / Repository / Mapper / Controller 必须 **包级私有**
4. `.env` 文件永远**不读取、不打印、不记录**
5. 脚本仅用 **Node 内置 API**（`node:fs`、`node:https`、`node:child_process`、`node:zlib`、`node:path`、`node:url`、全局 `fetch`）；无 `node_modules`
6. 提交前必须通过 `./mvnw spotless:apply verify`（Spotless + ArchUnit + JaCoCo 80%）
7. Spring Modulith 使用 **1.4.x**（Boot 3.5 兼容线）；禁用 2.x（Boot 4 专属）
8. **maven-failsafe-plugin 必须显式声明**，否则 `*IT` 静默跳过
