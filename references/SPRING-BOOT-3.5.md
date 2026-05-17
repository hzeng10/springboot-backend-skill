# Spring Boot 3.5 + JDK 21 关键特性

## Boot 3.5 关键改动

- Jakarta EE 命名空间（`jakarta.*`，非 `javax.*`）— 沿用 3.0 起的迁移
- `@HttpExchange` 声明式 HTTP 客户端（替代 Feign）
- Micrometer Observability 深度集成
- `ProblemDetail` RFC 7807 原生支持（`spring.mvc.problemdetails.enabled=true`）
- Structured Logging（结构化日志，Logback ECS/JSON Encoder）
- `RestClient`（同步）和 `WebClient`（响应式）均推荐
- 无需 `<start-class>` 属性（Maven 插件自动探测）

## JDK 21 LTS 关键特性

### 虚拟线程（Project Loom）

```properties
# application.properties
spring.threads.virtual.enabled=true
```

**注意事项：**
- 虚拟线程与 `synchronized` 结合会触发"钉线"（pinning），用 `ReentrantLock` 替代
- Hikari 连接池天然支持虚拟线程，无需额外配置
- MySQL Connector/J 9.0 支持虚拟线程

### Record Patterns（JDK 21）

```java
// instanceof + 解构
if (result instanceof UserResult(var id, var name)) {
    log.info("User {} created", name);
}

// switch + record pattern
String label = switch (event) {
    case UserCreated(var email) -> "new:" + email;
    case UserDeleted(var id)    -> "del:" + id;
    default -> "unknown";
};
```

### SequencedCollection

```java
List<String> list = new ArrayList<>(List.of("a", "b", "c"));
list.getFirst();  // "a"
list.getLast();   // "c"
list.reversed();  // ["c", "b", "a"]
```

## 性能优化

### HTTP 压缩

```properties
server.compression.enabled=true
server.compression.mime-types=application/json,application/xml,text/html,text/plain
server.compression.min-response-size=1024
```

### HTTP/2（需 SSL）

```properties
server.http2.enabled=true
server.ssl.enabled=true
```

### Tomcat 线程池（虚拟线程开启后自动管理，无需手动调）

```properties
# 仅在未启用虚拟线程时调整
server.tomcat.threads.max=200
server.tomcat.threads.min-spare=10
```

### Actuator 直方图（Prometheus）

```properties
management.metrics.distribution.percentiles-histogram.http.server.requests=true
management.metrics.distribution.percentiles.http.server.requests=0.5,0.95,0.99
```

## Jackson（必须使用 2.x，非 3.x）

```xml
<!-- pom.xml 已由 spring-boot-starter-web 引入，无需手动声明 -->
<!-- 包路径：com.fasterxml.jackson.*（禁止 tools.jackson.*） -->
```

```java
import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.ObjectMapper;
```

## 测试注解（Boot 3.5，非 Boot 4）

| 用途 | 正确注解 | 错误（Boot 4 专属）|
|---|---|---|
| Mock Bean | `@MockBean` | `@MockitoBean` |
| Spy Bean | `@SpyBean` | `@MockitoSpyBean` |
| Web 切片测试 | `@WebMvcTest` | — |
| `@WebMvcTest` 包路径 | `org.springframework.boot.test.autoconfigure.web.servlet` | — |

## Testcontainers（1.20.x，非 2.x）

```java
// 正确包路径
import org.testcontainers.containers.MySQLContainer;
// 自动装配（Boot 3.1+）
@ServiceConnection
MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.4");
```

## 关键版本依赖对照

| 依赖 | Boot 3.5 兼容版本 |
|---|---|
| Spring Modulith | 1.4.x（禁止 2.x） |
| Testcontainers | 1.20.x |
| Flyway | 10.x |
| Hibernate | 6.6.x（Boot 3.5 默认） |
| hypersistence-utils | hibernate-63（Hibernate 6.3+） |

## 启动性能提示

```properties
# 延迟初始化（按需，会推迟首个请求响应时间）
spring.main.lazy-initialization=true

# 关闭 JPA open-in-view（必须关闭，防止懒加载陷阱）
spring.jpa.open-in-view=false

# 关闭 Actuator 默认安全（开发环境）
management.endpoints.web.exposure.include=*
management.endpoint.health.show-details=always
```
