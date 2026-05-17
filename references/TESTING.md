# 测试策略

## 命名约定

| 后缀 | 插件 | 说明 |
|---|---|---|
| `*Test` | Surefire | 单元测试（无 Spring 上下文，快速） |
| `*IT` | Failsafe | 集成测试（真实 Spring 上下文 + 数据库） |

## 关键警告：maven-failsafe-plugin 必须显式声明

**如果 `pom.xml` 中没有显式声明 `maven-failsafe-plugin`，`*IT.java` 文件会被静默跳过，构建仍然显示 BUILD SUCCESS。**

```xml
<!-- pom.xml — 必须显式声明，否则 IT 静默跳过 -->
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-failsafe-plugin</artifactId>
  <executions>
    <execution>
      <goals>
        <goal>integration-test</goal>
        <goal>verify</goal>
      </goals>
    </execution>
  </executions>
</plugin>
```

## TestcontainersConfiguration

```java
// 包级私有，放在测试根包
@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    @RestartScope
    MySQLContainer<?> mysqlContainer() {
        return new MySQLContainer<>("mysql:8.4").withReuse(true);
    }
}
```

**包路径（Testcontainers 1.20.x）：**
```java
import org.testcontainers.containers.MySQLContainer;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
```

## BaseIT 基类

```java
// 放在测试根包，供所有集成测试继承
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@Sql("/test-data.sql")
public abstract class BaseIT {

    @Autowired
    protected TestRestTemplate restTemplate;
}
```

**TestRestTemplate 包路径（Boot 3.5）：**
```java
import org.springframework.boot.test.web.client.TestRestTemplate;
```

## test-data.sql

```sql
-- src/test/resources/test-data.sql
-- 每次测试前清空并插入基础数据（@Sql 默认 BEFORE_TEST_METHOD）
TRUNCATE TABLE app_user;

INSERT INTO app_user (id, first_name, last_name, email, password_hash, created_at, updated_at, version)
VALUES (1, 'Alice', 'Smith', 'alice@example.com', '$2a$10$...', NOW(6), NOW(6), 0);
```

## 集成测试示例

```java
class UserControllerIT extends BaseIT {

    @Test
    void createUser_success() {
        var request = """
            {"firstName": "Bob", "lastName": "Jones", "email": "bob@test.com", "password": "password123"}
            """;

        restTemplate.post().uri("/api/users")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(request)
            .exchange()
            .expectStatus().isCreated()
            .expectBody(Long.class).value(id -> assertThat(id).isPositive());
    }

    @Test
    void getUser_notFound() {
        restTemplate.get().uri("/api/users/99999")
            .exchange()
            .expectStatus().isNotFound()
            .expectBody()
            .jsonPath("$.title").isEqualTo("Not Found");
    }

    @ParameterizedTest
    @CsvSource({
        ", 邮箱格式不正确",          // 空邮箱
        "not-an-email, 邮箱格式不正确" // 格式错误
    })
    void createUser_invalidEmail(String email, String expectedMessage) {
        // ...
    }
}
```

## 单元测试示例

```java
class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock UserMapper userMapper;
    @Mock SpringEventPublisher events;

    @InjectMocks UserService userService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void createUser_duplicateEmail_throws() {
        given(userRepository.existsByEmail("alice@example.com")).willReturn(true);

        assertThatThrownBy(() -> userService.createUser(
            new CreateUserCmd("Alice", "Smith", "alice@example.com", "pw")))
            .isInstanceOf(UserAlreadyExistsException.class);
    }
}
```

## Web 切片测试

```java
// 仅启动 Web 层，Mock Service
@WebMvcTest(UserController.class)  // 包路径：org.springframework.boot.test.autoconfigure.web.servlet
class UserControllerTest {

    @Autowired MockMvc mvc;

    @MockBean UserService userService;  // Boot 3.5 用 @MockBean（非 @MockitoBean）

    @Test
    void createUser_validatesInput() throws Exception {
        mvc.perform(post("/api/users")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.title").value("Validation Error"));
    }
}
```

## Spring Modulith 模块切片测试

```java
@ApplicationModuleTest
class UsersModuleIT {

    @Autowired UsersAPI usersAPI;

    @Test
    void createUser() {
        var id = usersAPI.createUser(new CreateUserCmd("Alice", "Smith", "a@test.com", "pw123456"));
        assertThat(id).isNotNull();
    }

    @Test
    void publishesEvent(Scenario scenario) {
        scenario
            .stimulate(() -> usersAPI.createUser(new CreateUserCmd("Bob", "Jones", "b@test.com", "pw123456")))
            .andWaitForEventOfType(UserCreated.class)
            .toArriveAndVerify(e -> assertThat(e.email()).isEqualTo("b@test.com"));
    }
}
```

## Testcontainers 容器重用

```properties
# ~/.testcontainers.properties（本地开发，加快 IT 速度）
testcontainers.reuse.enable=true
```

## 命令区别

| 命令 | 运行 | 说明 |
|---|---|---|
| `./mvnw test` | `*Test` | 仅单元测试（快速） |
| `./mvnw verify` | `*Test` + `*IT` | 全量测试 + JaCoCo 门槛 + ArchUnit |
| `./mvnw -DskipTests package` | 无 | 跳过测试，仅构建 |

## JaCoCo 覆盖率报告

```bash
./mvnw verify
# 报告：target/site/jacoco/index.html
open target/site/jacoco/index.html
```

覆盖率门槛（80% 行覆盖率）在 `pom.xml` 的 `maven-failsafe-plugin` 之后的 JaCoCo `check` goal 中配置。
