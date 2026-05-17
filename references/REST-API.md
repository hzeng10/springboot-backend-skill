# REST API 设计

## Controller 基本结构

```java
// users/rest/controllers/UserController.java（包级私有）
@RestController
@RequestMapping("/api/users")
class UserController {

    private final UserService userService;

    UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    UserId createUser(@RequestBody @Valid CreateUserRequest request) {
        return userService.createUser(request.toCmd());
    }

    @GetMapping("/{id}")
    UserResponse getUser(@PathVariable UserId id) {
        return UserResponse.from(userService.getUserById(id));
    }

    @GetMapping
    Page<UserResponse> searchUsers(
            @RequestParam(defaultValue = "") String keyword,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return userService.searchUsers(new SearchUsersQuery(keyword, pageable.getPageNumber(), pageable.getPageSize()))
            .map(UserResponse::from);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteUser(@PathVariable UserId id) {
        userService.deleteUser(id);
    }
}
```

## 请求 / 响应 DTO

```java
// users/rest/dtos/CreateUserRequest.java
public record CreateUserRequest(
    @NotBlank(message = "firstName 不能为空") String firstName,
    @NotBlank(message = "lastName 不能为空") String lastName,
    @Email(message = "邮箱格式不正确") @NotBlank String email,
    @Size(min = 8, message = "密码至少 8 位") String password
) {
    public CreateUserCmd toCmd() {
        return new CreateUserCmd(firstName, lastName, email, password);
    }
}

// users/rest/dtos/UserResponse.java
public record UserResponse(String id, String fullName, String email, Instant createdAt) {
    public static UserResponse from(UserResult result) {
        return new UserResponse(
            result.id().value().toString(),
            result.fullName(),
            result.email(),
            result.createdAt()
        );
    }
}
```

## 值对象路径参数绑定

将 `@PathVariable` 自动转换为值对象：

```java
// config/WebMvcConfig.java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(new StringToUserIdConverter());
    }
}

// 转换器（包级私有即可）
class StringToUserIdConverter implements Converter<String, UserId> {
    @Override
    public UserId convert(String source) {
        try {
            return UserId.of(Long.parseLong(source));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("无效的用户 ID：" + source);
        }
    }
}
```

## 值对象 JSON 序列化

```java
// users/domain/models/UserId.java
public record UserId(Long value) {

    @JsonCreator
    public static UserId of(@JsonProperty("value") Long value) {
        return new UserId(value);
    }

    @JsonValue
    public Long getValue() {
        return value;
    }
}
```

> **注意**：使用 `com.fasterxml.jackson.annotation.*`（Jackson 2.x），禁止 `tools.jackson.*`（Jackson 3.x / Boot 4）。

## 全局异常处理

```java
// config/GlobalExceptionHandler.java
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {

        var errors = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> Map.of("field", fe.getField(), "message", fe.getDefaultMessage()))
            .toList();

        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "请求参数校验失败");
        pd.setTitle("Validation Error");
        pd.setProperty("errors", errors);
        pd.setProperty("timestamp", Instant.now());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(pd);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ProblemDetail handle(ResourceNotFoundException ex) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setTitle("Not Found");
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    @ExceptionHandler(DomainException.class)
    ProblemDetail handle(DomainException ex) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        pd.setTitle("Business Error");
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail handleUnexpected(Exception ex, WebRequest request) {
        LOG.error("未预期的异常", ex);
        var pd = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        pd.setTitle("Internal Server Error");
        pd.setDetail("服务器内部错误，请联系管理员");
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }
}
```

## 错误响应格式（ProblemDetail，RFC 7807）

**400 — 校验错误：**
```json
{
  "type": "about:blank",
  "title": "Validation Error",
  "status": 400,
  "detail": "请求参数校验失败",
  "instance": "/api/users",
  "errors": [{"field": "email", "message": "邮箱格式不正确"}],
  "timestamp": "2026-05-17T10:00:00Z"
}
```

**400 — 业务错误：**
```json
{
  "title": "Business Error",
  "status": 400,
  "detail": "邮箱已注册：alice@example.com",
  "timestamp": "2026-05-17T10:00:00Z"
}
```

**404 — 资源不存在：**
```json
{
  "title": "Not Found",
  "status": 404,
  "detail": "用户不存在：123",
  "timestamp": "2026-05-17T10:00:00Z"
}
```

## application.properties 开启 ProblemDetail

```properties
spring.mvc.problemdetails.enabled=true
```

## 分页最佳实践

```java
// 列表接口必须支持分页
@GetMapping
Page<UserResponse> list(
    @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
    Pageable pageable) { ... }

// 深 offset 分页改用 keyset（游标）分页，避免性能问题
// 参见 DATABASE.md 的分页章节
```
