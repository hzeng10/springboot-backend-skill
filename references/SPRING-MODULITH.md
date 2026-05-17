# Spring Modulith 模块化单体

## 版本选择

**使用 1.4.x（Boot 3.5 兼容线）**，禁止使用 2.x（Boot 4 专属）。

## Maven 依赖

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.modulith</groupId>
      <artifactId>spring-modulith-bom</artifactId>
      <version>${spring-modulith.version}</version>  <!-- 1.4.1 -->
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <!-- 核心：模块边界声明与验证 -->
  <dependency>
    <groupId>org.springframework.modulith</groupId>
    <artifactId>spring-modulith-starter-core</artifactId>
  </dependency>

  <!-- 事件外发存储（JDBC，将事件持久化到 event_publication 表） -->
  <dependency>
    <groupId>org.springframework.modulith</groupId>
    <artifactId>spring-modulith-starter-jdbc</artifactId>
  </dependency>

  <!-- 测试支持（ApplicationModuleTest、Scenario API） -->
  <dependency>
    <groupId>org.springframework.modulith</groupId>
    <artifactId>spring-modulith-starter-test</artifactId>
    <scope>test</scope>
  </dependency>

  <!-- 文档生成（PlantUML + AsciiDoc，仅在测试阶段运行） -->
  <dependency>
    <groupId>org.springframework.modulith</groupId>
    <artifactId>spring-modulith-docs</artifactId>
    <scope>test</scope>
  </dependency>
</dependencies>
```

## application.properties 配置

```properties
# 事件持久化表自动建表（开发便捷；生产环境可改为 Flyway 管理）
spring.modulith.events.jdbc.schema-initialization.enabled=true

# 事件完成后的处理策略：delete（删除）或 archive（归档，保留审计记录）
spring.modulith.events.completion-mode=delete

# 重启后重发未完成的事件（at-least-once 语义）
spring.modulith.republish-outstanding-events-on-restart=true
```

## 模块声明

每个顶层业务包根目录放 `package-info.java`：

```java
// users/package-info.java
@org.springframework.modulith.ApplicationModule(
    displayName = "Users",
    allowedDependencies = {"shared"}   // 只允许依赖 shared 模块
)
package com.example.demo.users;
```

### OPEN 模块（shared）

`shared` 模块不强制封装其内部结构，允许其他模块自由访问：

```java
// shared/package-info.java
@org.springframework.modulith.ApplicationModule(
    type = org.springframework.modulith.ApplicationModule.Type.OPEN
)
package com.example.demo.shared;
```

## 命名接口（暴露 models/）

其他模块只能访问 `models/` 子包中用 `@NamedInterface` 标注的类型：

```java
// users/domain/models/package-info.java
@org.springframework.modulith.NamedInterface("api")
package com.example.demo.users.domain.models;
```

其他模块声明依赖时引用命名接口：

```java
@ApplicationModule(
    allowedDependencies = {"users::api", "shared"}  // 只能访问 users 的 models/ 子包
)
package com.example.demo.orders;
```

## 异步事件监听（跨模块解耦）

**优先使用 `@ApplicationModuleListener` 替代直接注入其他模块的 Service：**

```java
// orders/domain/services/OrderEventHandler.java
@Service
class OrderEventHandler {

    @org.springframework.modulith.events.ApplicationModuleListener
    void on(UserCreated event) {
        // 特性：
        // - 异步执行（@Async）
        // - 独立新事务（propagation = REQUIRES_NEW）
        // - 事务性事件监听（@TransactionalEventListener）
        // - 事件经 JDBC 表持久化，宕机后可重发
    }
}
```

**发布事件（在 UserService 中）：**

```java
@Service
public class UserService {
    private final SpringEventPublisher events;

    @Transactional
    public UserId createUser(CreateUserCmd cmd) {
        var entity = // ... 保存
        events.publishEvent(new UserCreated(entity.getId(), entity.getEmail()));
        return entity.getId();
    }
}
```

**领域事件 record（放在 models/ 子包）：**

```java
// users/domain/models/UserCreated.java
public record UserCreated(UserId userId, String email) implements DomainEvent {}
```

## 模块化测试

### 全局模块验证（ModularityTest.java）

```java
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

class ModularityTest {

    static final ApplicationModules modules = ApplicationModules.of(Application.class);

    @Test
    void verifiesModularStructure() {
        // 失败示例：orders 模块直接引用了 users/entities/UserEntity（包级私有）
        modules.verify();
    }

    @Test
    void writesDocumentationSnippets() {
        new Documenter(modules)
            .writeDocumentation()                    // 输出到 target/spring-modulith-docs/
            .writeIndividualModulesAsPlantUml();     // PlantUML 模块图
    }
}
```

### 模块切片测试（仅启动单个模块上下文）

```java
@org.springframework.modulith.test.ApplicationModuleTest
class UsersModuleTests {

    @Autowired
    UsersAPI usersAPI;

    @Test
    void createsUser() {
        var cmd = new CreateUserCmd("Alice", "alice@example.com", "password123");
        var userId = usersAPI.createUser(cmd);
        assertThat(userId).isNotNull();
    }
}
```

### 使用 Scenario API 验证事件发布

```java
@org.springframework.modulith.test.ApplicationModuleTest
class UsersModuleTests {

    @Test
    void publishesUserCreatedEvent(
            @org.springframework.modulith.test.ApplicationModuleTest.Scenario scenario) {
        scenario
            .stimulate(() -> usersAPI.createUser(new CreateUserCmd("Alice", "alice@example.com", "pw")))
            .andWaitForEventOfType(UserCreated.class)
            .toArriveAndVerify(event ->
                assertThat(event.email()).isEqualTo("alice@example.com"));
    }
}
```

## Flyway 管理事件表（生产推荐）

关闭自动建表，改用 Flyway 迁移：

```properties
# 关闭自动建表
spring.modulith.events.jdbc.schema-initialization.enabled=false
```

```sql
-- V2__modulith_events.sql
CREATE TABLE event_publication (
  id               VARCHAR(36)   NOT NULL,
  listener_id      VARCHAR(512)  NOT NULL,
  event_type       VARCHAR(512)  NOT NULL,
  serialized_event TEXT          NOT NULL,
  publication_date DATETIME(6)   NOT NULL,
  completion_date  DATETIME(6),
  PRIMARY KEY (id),
  INDEX idx_ep_completion_date (completion_date)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

## 约束与注意事项

1. **模块名即顶层包名**，保持稳定。改名会破坏 `allowedDependencies` 字符串引用
2. `@ApplicationModuleListener` 默认 `REQUIRES_NEW` 事务，不要期望监听器中的异常回滚发布方事务
3. `Documenter` 输出可纳入 CI 工件，便于评审模块依赖图
4. `ApplicationModules.verify()` 在 `./mvnw verify` 阶段自动运行，违规即构建失败
5. 模块间禁止循环依赖，`verify()` 会检测并报告
