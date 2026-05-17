# AGENTS.md — Spring Boot MySQL Skill 硬性约束

> 本文件中的所有规则对 Claude 及所有 AI 代理均为强制性约束，不可绕过。

## 构建工具

- **仅使用 Maven**；禁止 Gradle（禁止生成 `build.gradle`、`settings.gradle`、`gradlew`）
- Maven Wrapper (`mvnw` / `mvnw.cmd`) 必须从 Spring Initializr 获取，不手动生成

## 禁止的依赖

- **Lombok**（`org.projectlombok:lombok`）— 双重守护：Maven Enforcer bannedDependencies + ArchUnit NoLombokTest
- **OpenAPI / springdoc**（`org.springdoc:*`）
- **Buildpacks**（`spring-boot-maven-plugin` 的 `build-image` 目标除 Paketo 外）
- **Jib**（`com.google.cloud.tools:jib-maven-plugin`）
- **Gradle Wrapper**

## Schema 管理

- **仅 Flyway**，禁止 `spring.jpa.hibernate.ddl-auto=update` 或 `create`
- 运行时设置 `spring.jpa.hibernate.ddl-auto=validate`
- 迁移文件命名格式：`V{版本}__{描述}.sql`（双下划线）
- **已发布的迁移脚本不可修改**；如需修正，新建版本

## .env 文件安全约定

- **永远不读取、不打印、不记录 `.env` 文件的内容**
- `.env` 仅存储本地开发密钥，永远不提交到 Git
- `.env.sample` 仅包含占位符键名，不含真实值
- 生成代码不得使用 `dotenv` 库或任何读取 `.env` 的机制

## 脚本约束（Node.js）

生成脚本仅使用以下 Node 内置 API，**禁止 `node_modules` 和 npm/yarn 依赖**：
- `node:fs`、`node:fs/promises`
- `node:https`、`node:http`
- `node:child_process`
- `node:zlib`
- `node:path`
- `node:url`
- `node:os`
- 全局 `fetch`（Node 18+）

## 代码可见性

- `@Entity` 类：包级私有
- `*Repository` 接口：包级私有
- `*Mapper` 类：包级私有
- `@RestController` 类：包级私有
- 仅 `*Service`、`*API`（模块门面）、`models/` 中的类型对外公开

## Spotless & 质量门槛

- 提交前必须通过：`./mvnw spotless:apply verify`
- Spotless 使用 Palantir Java Format
- JaCoCo 行覆盖率不低于 80%（门槛在 `pom.xml` 可调）
- ArchUnit 测试不得禁用（禁用 `@Disabled`）

## Spring Modulith

- 使用 **1.4.x 版本**（Boot 3.5 兼容线）
- **禁止使用 2.x**（仅 Boot 4 兼容）
- 跨模块通信优先用 `@ApplicationModuleListener` 异步事件，避免直接注入其他模块的 Service
- 模块边界由 `ApplicationModules.verify()` 在 CI 中强制执行

## 集成测试

- **maven-failsafe-plugin 必须在 `pom.xml` 中显式声明**
- 若缺少此声明，`*IT.java` 文件将被静默跳过，且构建依然显示 SUCCESS
- 单测命名：`*Test`（Surefire）；集成测试命名：`*IT`（Failsafe）

## Spring Boot 版本兼容性（Boot 3.5，非 Boot 4）

- Jackson：`com.fasterxml.jackson.*`（禁止 `tools.jackson.*`）
- Mock 注解：`@MockBean`、`@SpyBean`（禁止 `@MockitoBean`、`@MockitoSpyBean`）
- Testcontainers：`org.testcontainers.*` 1.20.x（禁止 2.x 命名空间）
- `@WebMvcTest` 包路径：`org.springframework.boot.test.autoconfigure.web.servlet`
- 无需 `<start-class>` 属性（Boot 3.x 自动探测）
