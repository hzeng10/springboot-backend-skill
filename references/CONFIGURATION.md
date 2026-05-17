# 配置管理

## 格式选择：.properties 优于 YAML

优先使用 `.properties` 文件：
- IDE 自动补全更准确（Spring Boot Configuration Processor 支持）
- 更易 `grep` 和 `diff`
- 无缩进敏感问题
- 层级清晰（`spring.datasource.url` vs YAML 嵌套）

## @ConfigurationProperties 最佳实践

```java
// config/AppProperties.java
@ConfigurationProperties(prefix = "app")
@Validated
public record AppProperties(
    @NotBlank String name,
    @Valid JwtProperties jwt,
    @Valid UploadProperties upload
) {
    public record JwtProperties(
        @NotBlank String secret,
        @Positive long expirationMs
    ) {}

    public record UploadProperties(
        @NotNull Path directory,
        @Positive long maxFileSizeMb
    ) {}
}
```

```java
// Application.java 或 config 类
@SpringBootApplication
@ConfigurationPropertiesScan  // 自动扫描并注册所有 @ConfigurationProperties
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

```xml
<!-- pom.xml — 启用配置处理器（IDE 自动补全） -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-configuration-processor</artifactId>
  <optional>true</optional>
</dependency>
```

## application.properties 完整模板

```properties
# ── 应用 ─────────────────────────────────────────────────────────────────────
spring.application.name=my-service
server.port=8080
spring.main.banner-mode=off

# ── 数据源 ────────────────────────────────────────────────────────────────────
spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:mysql://localhost:3306/mydb?characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true&rewriteBatchedStatements=true}
spring.datasource.username=${SPRING_DATASOURCE_USERNAME:user}
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:password}
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# ── Hikari ──────────────────────────────────────────────────────────────────
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000
spring.datasource.hikari.auto-commit=false

# ── JPA ─────────────────────────────────────────────────────────────────────
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.open-in-view=false
spring.jpa.properties.hibernate.jdbc.batch_size=25
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true

# ── Flyway ──────────────────────────────────────────────────────────────────
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration

# ── 虚拟线程（JDK 21）───────────────────────────────────────────────────────
spring.threads.virtual.enabled=true

# ── Actuator ─────────────────────────────────────────────────────────────────
management.endpoints.web.exposure.include=health,info,metrics
management.endpoint.health.show-details=when-authorized
management.info.git.mode=full
management.info.build.enabled=true

# ── Spring Modulith 事件 ──────────────────────────────────────────────────────
spring.modulith.events.jdbc.schema-initialization.enabled=true
spring.modulith.events.completion-mode=delete
spring.modulith.republish-outstanding-events-on-restart=true

# ── HTTP ─────────────────────────────────────────────────────────────────────
server.compression.enabled=true
server.compression.mime-types=application/json,text/plain
spring.mvc.problemdetails.enabled=true
```

## Profile 切换

```bash
# 环境变量（推荐）
export SPRING_PROFILES_ACTIVE=dev

# JVM 参数
java -Dspring.profiles.active=prod -jar app.jar

# Maven 运行
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

**Profile 文件：**
- `application.properties` — 默认配置（生产安全值）
- `application-dev.properties` — 开发配置（详细日志、不安全选项）
- `application-test.properties` — 测试配置（Testcontainers 覆盖）
- `application-prod.properties` — 生产微调

## application-dev.properties 示例

```properties
# 开发模式：详细日志
logging.level.com.example=DEBUG
logging.level.org.springframework.web=DEBUG
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true

# 开发时 Actuator 全开
management.endpoints.web.exposure.include=*
management.endpoint.health.show-details=always
```

## application-test.properties 示例

```properties
# Testcontainers 接管数据源配置（@ServiceConnection 自动注入）
# 覆盖 Flyway 位置（如测试用独立迁移）
spring.flyway.locations=classpath:db/migration,classpath:db/test-migration

# 禁用 Modulith 事件外发（测试中用内存模式）
spring.modulith.events.jdbc.schema-initialization.enabled=false
```

## 配置优先级（从低到高）

1. 默认值（`application.properties`）
2. `@PropertySource` 注解
3. `application-{profile}.properties`
4. 环境变量
5. 系统属性（`-D`）
6. 命令行参数（`--`）
