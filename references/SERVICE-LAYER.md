# Service 层设计

## 核心模式：XCmd / XQuery / XResult

所有 Service 方法围绕三类对象设计：

```java
// 命令（写操作输入）— 放在 models/ 子包
public record CreateUserCmd(String firstName, String lastName, String email, String password) {}

// 查询（读操作输入）
public record SearchUsersQuery(String keyword, int page, int size) {}

// 结果（输出）
public record UserResult(UserId id, String fullName, String email) {}
```

## DomainEvent 标记接口

```java
// shared/domain/models/DomainEvent.java
public interface DomainEvent {}

// users/domain/models/UserCreated.java（放在 @NamedInterface 暴露的 models/ 子包）
public record UserCreated(UserId userId, String email) implements DomainEvent {}
```

## SpringEventPublisher 包装器

```java
// shared/services/SpringEventPublisher.java
@Service
public class SpringEventPublisher {
    private final ApplicationEventPublisher publisher;

    public SpringEventPublisher(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void publishEvent(DomainEvent event) {
        publisher.publishEvent(event);
    }
}
```

## UserService 完整示例

```java
// users/domain/services/UserService.java
@Service
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final SpringEventPublisher events;

    UserService(UserRepository userRepository, UserMapper userMapper, SpringEventPublisher events) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
        this.events = events;
    }

    @Transactional
    public UserId createUser(CreateUserCmd cmd) {
        if (userRepository.existsByEmail(cmd.email())) {
            throw new UserAlreadyExistsException("邮箱已注册：" + cmd.email());
        }
        var entity = userMapper.toEntity(cmd);
        userRepository.save(entity);
        events.publishEvent(new UserCreated(entity.getId(), entity.getEmail()));
        return entity.getId();
    }

    @Transactional(readOnly = true)
    public List<UserResult> searchUsers(SearchUsersQuery query) {
        return userRepository
            .findByKeyword(query.keyword(), PageRequest.of(query.page(), query.size()))
            .stream()
            .map(userMapper::toResult)
            .toList();
    }

    @Transactional(readOnly = true)
    public UserResult getUserById(UserId id) {
        return userRepository.findById(id)
            .map(userMapper::toResult)
            .orElseThrow(() -> new UserNotFoundException(id));
    }

    @Transactional
    public void deleteUser(UserId id) {
        var entity = userRepository.findById(id)
            .orElseThrow(() -> new UserNotFoundException(id));
        userRepository.delete(entity);
        events.publishEvent(new UserDeleted(id));
    }
}
```

## 跨模块通信：优先使用领域事件

```java
// ❌ 错误：直接注入其他模块的 Service
@Service
class OrderService {
    private final UserService userService;  // 跨模块直接注入，违反 Modulith 边界
}

// ✅ 正确：通过 UsersAPI 门面调用（同步需要结果时）
@Service
class OrderService {
    private final UsersAPI usersAPI;

    @Transactional
    public OrderId placeOrder(PlaceOrderCmd cmd) {
        var user = usersAPI.getUserById(cmd.userId());  // 通过门面
        // ...
    }
}

// ✅ 更优：通过领域事件异步解耦（不需要实时结果时）
@Service
class OrderEventHandler {
    @ApplicationModuleListener
    void on(UserCreated event) {
        // 用户创建后自动触发，无需直接依赖 UserService
    }
}
```

## @Transactional 规则

| 场景 | 注解 |
|---|---|
| 写操作（INSERT/UPDATE/DELETE） | `@Transactional` |
| 只读查询 | `@Transactional(readOnly = true)` |
| 跨模块事件监听 | `@ApplicationModuleListener`（自动 REQUIRES_NEW） |
| 批量操作 | `@Transactional`，循环内调 `repository.flush()` 或批量 `saveAll()` |

**不要在 Controller 层加 `@Transactional`**，事务边界属于 Service 层。

## 异常层次

```java
// 基础业务异常（可映射到 HTTP 状态码）
public class DomainException extends RuntimeException {
    public DomainException(String message) { super(message); }
}

public class ResourceNotFoundException extends DomainException {
    public ResourceNotFoundException(String message) { super(message); }
}

public class UserNotFoundException extends ResourceNotFoundException {
    public UserNotFoundException(UserId id) {
        super("用户不存在：" + id.value());
    }
}

public class UserAlreadyExistsException extends DomainException {
    public UserAlreadyExistsException(String message) { super(message); }
}
```

## Mapper 示例

```java
// users/domain/mappers/UserMapper.java（包级私有）
class UserMapper {

    UserEntity toEntity(CreateUserCmd cmd) {
        var entity = new UserEntity();
        entity.setFirstName(cmd.firstName());
        entity.setLastName(cmd.lastName());
        entity.setEmail(cmd.email());
        entity.setPasswordHash(hashPassword(cmd.password()));
        return entity;
    }

    UserResult toResult(UserEntity entity) {
        return new UserResult(
            entity.getId(),
            entity.getFirstName() + " " + entity.getLastName(),
            entity.getEmail()
        );
    }

    private String hashPassword(String raw) {
        return new BCryptPasswordEncoder().encode(raw);
    }
}
```
