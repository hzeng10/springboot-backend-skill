# 数据库：MySQL 8 + Flyway + JPA

## JDBC URL 配置

```properties
spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:mysql://localhost:3306/mydb?characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true&rewriteBatchedStatements=true}
spring.datasource.username=${SPRING_DATASOURCE_USERNAME:user}
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:password}
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
```

关键参数说明：
- `characterEncoding=utf8mb4` — 支持全 Unicode（含 Emoji）
- `serverTimezone=Asia/Shanghai` — 与应用时区保持一致
- `useSSL=false` — 本地开发关闭 SSL（生产应开启）
- `rewriteBatchedStatements=true` — 批量写入性能优化（必须）

## Hikari 连接池

```properties
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000
spring.datasource.hikari.auto-commit=false
```

## JPA 配置

```properties
# Flyway 管理 Schema，ddl-auto 只做验证（禁止 update/create）
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.open-in-view=false

# 批量写入优化
spring.jpa.properties.hibernate.jdbc.batch_size=25
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true

# 开发时开启 SQL 日志（生产关闭）
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=false
```

## Flyway 配置

```properties
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=false
```

### 迁移文件命名规范

```
src/main/resources/db/migration/
├── V1__init.sql               # 初始 Schema
├── V2__add_orders_table.sql   # 版本号递增，双下划线分隔描述
└── V3__add_user_status.sql
```

**规则：**
- 格式：`V{版本}__{描述}.sql`（双下划线）
- **已发布的迁移脚本不可修改**（Flyway 用校验和检测）
- 如需修正已发布迁移，新建版本并用 `flyway:repair` 修复
- 表字符集统一：`ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`

### 常用 Flyway 命令

```bash
./mvnw flyway:info      # 查看迁移状态
./mvnw flyway:migrate   # 执行待迁移脚本
./mvnw flyway:repair    # 修复失败的迁移记录
./mvnw flyway:baseline  # 在已有数据库上设置基线版本
```

## BaseEntity（审计字段基类）

```java
// shared/domain/entities/BaseEntity.java
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private int version;

    // getters
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public int getVersion() { return version; }
}
```

**启用 JPA Auditing：**

```java
// config/JpaConfig.java
@Configuration
@EnableJpaAuditing
public class JpaConfig {}
```

## 值对象主键（TSID）

使用 Hypersistence Utils 生成时序唯一 ID：

```xml
<!-- pom.xml -->
<dependency>
  <groupId>io.hypersistence</groupId>
  <artifactId>hypersistence-utils-hibernate-63</artifactId>
  <version>${hypersistence-utils.version}</version>
</dependency>
```

```java
// users/domain/models/UserId.java
public record UserId(Long value) {
    @JsonCreator
    public static UserId of(@JsonProperty("value") Long value) { return new UserId(value); }

    @JsonValue
    public Long getValue() { return value; }
}

// 用于生成 ID 的工具类
public final class IdGenerator {
    private IdGenerator() {}

    public static Long generate() {
        return io.hypersistence.utils.hibernate.id.TsidFactory.getTsid().toLong();
    }
}

// users/domain/entities/UserEntity.java（包级私有）
@Entity
@Table(name = "app_user")
class UserEntity extends BaseEntity {

    @EmbeddedId
    @AttributeOverride(name = "value", column = @Column(name = "id"))
    private UserId id;

    @Column(nullable = false, length = 50)
    private String firstName;

    @Column(nullable = false, length = 50)
    private String lastName;

    @Column(nullable = false, length = 191, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    // 使用 @PrePersist 自动生成 TSID
    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UserId.of(IdGenerator.generate());
        }
    }

    // package-private getters & setters
    UserId getId() { return id; }
    String getEmail() { return email; }
    void setFirstName(String firstName) { this.firstName = firstName; }
    void setLastName(String lastName) { this.lastName = lastName; }
    void setEmail(String email) { this.email = email; }
    void setPasswordHash(String hash) { this.passwordHash = hash; }
}
```

## 性能最佳实践

### N+1 检测与修复

```java
// ❌ N+1 问题：每个 order 都触发一次 user 查询
List<Order> orders = orderRepository.findAll();
orders.forEach(o -> log.info(o.getUser().getName()));  // 懒加载触发 N 次

// ✅ 修复：JOIN FETCH
@Query("SELECT o FROM OrderEntity o JOIN FETCH o.user WHERE o.status = :status")
List<OrderEntity> findByStatusWithUser(@Param("status") String status);

// ✅ 修复：@EntityGraph
@EntityGraph(attributePaths = {"user"})
List<OrderEntity> findByStatus(String status);
```

```properties
# 开发时开启 Hibernate 统计（检测 N+1）
spring.jpa.properties.hibernate.generate_statistics=true
```

### 批量写入

```java
// ✅ 批量保存（配合 rewriteBatchedStatements=true 效果显著）
userRepository.saveAll(userEntities);

// ✅ 大批量时分批处理
IntStream.range(0, totalBatches).forEach(i -> {
    var batch = entities.subList(i * BATCH_SIZE, Math.min((i + 1) * BATCH_SIZE, entities.size()));
    userRepository.saveAll(batch);
    userRepository.flush();  // 清空 JPA 一级缓存
    entityManager.clear();
});
```

### 分页查询

```java
// 普通分页（小数据量）
Page<UserEntity> findByStatus(String status, Pageable pageable);

// 深 offset 分页改用 keyset（游标）—— 避免 OFFSET 性能劣化
@Query("SELECT u FROM UserEntity u WHERE u.id > :lastId ORDER BY u.id ASC LIMIT :size")
List<UserEntity> findNextPage(@Param("lastId") Long lastId, @Param("size") int size);
```

### 只读查询优化

```java
@Transactional(readOnly = true)
public List<UserResult> listUsers() {
    // readOnly=true：Hibernate 跳过脏检查，Hikari 不锁定连接写入
    return userRepository.findAll().stream().map(mapper::toResult).toList();
}
```

## MySQL 8.4 注意事项

- MySQL 8.4 起，`caching_sha2_password` 是默认认证插件（Connector/J 9.0 已原生支持）
- 如遇老客户端连接问题，加 `allowPublicKeyRetrieval=true` 或切换 `mysql_native_password`
- JSON 列用 `@JdbcTypeCode(SqlTypes.JSON)` + `@Column(columnDefinition = "json")`
- 全文索引用 `FULLTEXT` + `MATCH ... AGAINST`，不要用 `LIKE '%keyword%'`
