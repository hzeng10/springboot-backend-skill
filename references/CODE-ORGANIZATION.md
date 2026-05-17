# 代码组织与包结构

## 顶层包结构

```
com.example.projectname/
├── Application.java                    # @SpringBootApplication 启动类
├── shared/                             # 跨模块工具（OPEN 模块）
│   ├── package-info.java               # @ApplicationModule(type = OPEN)
│   └── services/
│       └── SpringEventPublisher.java   # 领域事件发布器
├── users/                              # 用户限界上下文（Modulith 模块）
│   ├── package-info.java               # @ApplicationModule
│   ├── UsersAPI.java                   # 模块对外门面（public）
│   ├── config/
│   ├── domain/
│   │   ├── models/                     # 值对象、Cmd、Query、Result、Event（@NamedInterface 暴露）
│   │   │   ├── package-info.java       # @NamedInterface("api")
│   │   │   ├── UserId.java
│   │   │   ├── CreateUserCmd.java
│   │   │   ├── UserResult.java
│   │   │   └── UserCreated.java        # 领域事件 record
│   │   ├── entities/                   # @Entity（包级私有）
│   │   │   └── UserEntity.java
│   │   ├── repositories/               # JpaRepository（包级私有）
│   │   │   └── UserRepository.java
│   │   ├── mappers/                    # Entity ↔ DTO 转换（包级私有）
│   │   │   └── UserMapper.java
│   │   └── services/                   # @Service（public，供本模块 Controller 和门面使用）
│   │       └── UserService.java
│   └── rest/
│       ├── controllers/                # @RestController（包级私有）
│       │   └── UserController.java
│       └── dtos/                       # HTTP 请求/响应 DTO
│           ├── CreateUserRequest.java
│           └── UserResponse.java
├── orders/                             # 订单限界上下文（另一个 Modulith 模块）
│   └── ...
└── config/
    ├── WebMvcConfig.java
    └── GlobalExceptionHandler.java
```

## 命名规范

| 类型 | 命名格式 | 示例 |
|---|---|---|
| Entity | `*Entity` | `UserEntity` |
| 值对象（record） | 纯名词 | `UserId`、`Email` |
| 命令对象 | `*Cmd` | `CreateUserCmd` |
| 结果对象 | `*Result` | `UserResult` |
| 查询对象 | `*Query` | `SearchUsersQuery` |
| HTTP 请求 DTO | `*Request` | `CreateUserRequest` |
| HTTP 响应 DTO | `*Response` | `UserResponse` |
| Repository | `*Repository` | `UserRepository` |
| Service | `*Service` | `UserService` |
| 模块门面 | `*API` | `UsersAPI` |
| 领域事件 | 过去式名词 | `UserCreated`、`OrderPlaced` |
| 异常 | `*Exception` | `UserNotFoundException` |
| 配置 | `*Config` | `WebMvcConfig` |

## 可见性规则

| 类型 | 可见性 | 原因 |
|---|---|---|
| `@Entity` | 包级私有 | 防止跨模块直接引用 |
| `*Repository` | 包级私有 | 数据访问层封装 |
| `*Mapper` | 包级私有 | 实现细节 |
| `@RestController` | 包级私有 | 路由细节封装 |
| `*Service` | 包级或模块内公开 | 门面和内部使用 |
| `{Module}API.java` | **public** | 跨模块调用入口 |
| `models/` 下的类型 | **public**（`@NamedInterface`） | 跨模块事件与值对象 |

## 与 Spring Modulith 的对齐

每个顶层业务包（`users/`、`orders/` 等）即一个 Spring Modulith **应用模块**：

```java
// users/package-info.java
@org.springframework.modulith.ApplicationModule(
    displayName = "Users",
    allowedDependencies = {"shared"}
)
package com.example.demo.users;
```

- `entities/`、`repositories/`、`mappers/`、`controllers/` 保持包级私有 → 其他模块无法直接引用
- `models/` 通过 `@NamedInterface` 暴露 → 其他模块可依赖事件 record 和值对象
- 跨模块调用通过 `{Module}API.java` 门面或领域事件（`@ApplicationModuleListener`）

详见 `references/SPRING-MODULITH.md`。

## 包内类布局示例

```java
// 包级私有 Entity
class UserEntity extends BaseEntity {
    // ...
}

// 包级私有 Repository
interface UserRepository extends JpaRepository<UserEntity, UserId> {
    Optional<UserEntity> findByEmail(String email);
}

// public Service（供门面和 Controller 调用）
@Service
public class UserService {
    private final UserRepository repository;    // 包级私有注入
    private final UserMapper mapper;            // 包级私有注入
    private final SpringEventPublisher events;

    UserService(UserRepository repository, UserMapper mapper, SpringEventPublisher events) {
        this.repository = repository;
        this.mapper = mapper;
        this.events = events;
    }
    // ...
}

// public 模块门面
public class UsersAPI {
    private final UserService userService;

    public UsersAPI(UserService userService) {
        this.userService = userService;
    }

    public UserId createUser(CreateUserCmd cmd) {
        return userService.createUser(cmd);
    }
}
```
