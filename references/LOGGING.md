# 日志最佳实践

## 基本原则

- **仅使用 Logback**（Spring Boot 默认，无需额外依赖）
- **始终通过 SLF4J 接口**记录日志（不直接使用 Logback API）
- **使用参数化日志**（`log.info("User: {}", user)`），避免字符串拼接
- **Logger 声明：** `private static final Logger LOG = LoggerFactory.getLogger(ClassName.class);`

## 安全约束（必须遵守）

```java
// ❌ 禁止记录敏感信息
log.info("用户登录: email={}, password={}", email, password);   // 密码
log.info("Token: {}", jwtToken);                               // 认证令牌
log.info("User data: {}", userEntity);                         // 大型对象（含 PII）

// ✅ 仅记录安全信息
log.info("用户登录成功: userId={}", userId);
log.info("Token 颁发: userId={}, expiresAt={}", userId, expiresAt);
```

## 异常记录

```java
// ✅ 异常作为最后一个参数（保留 stack trace）
log.error("处理用户请求失败: userId={}", userId, ex);

// ❌ 不要同时 log AND throw（会导致重复日志）
log.error("创建用户失败", ex);
throw ex;  // 上层已有日志，这里重复了
```

## 日志级别使用规范

| 级别 | 场景 |
|---|---|
| `ERROR` | 系统错误、未预期异常、影响功能的故障 |
| `WARN` | 可恢复的异常情况、性能降级、配置问题 |
| `INFO` | 业务里程碑（用户注册、订单创建）、启动/关闭事件 |
| `DEBUG` | 方法入参/返回值、分支决策（仅开发环境） |
| `TRACE` | 极详细的执行步骤（性能分析专用） |

## 热路径性能守护

```java
// ❌ 热路径中拼接 toString（即使不打印也会执行）
log.debug("Processing: " + object.toString());

// ✅ 懒加载守护（isDebugEnabled）
if (log.isDebugEnabled()) {
    log.debug("Processing: {}", object.expensiveToString());
}

// ✅ SLF4J 惰性求值（supplier 方式）
log.debug("Processing: {}", () -> object.expensiveToString());
```

## logback-spring.xml 完整配置

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <springProperty scope="context" name="APP_NAME" source="spring.application.name" defaultValue="app"/>

  <!-- 控制台 Appender -->
  <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
      <charset>UTF-8</charset>
    </encoder>
  </appender>

  <!-- 文件 Appender（滚动策略） -->
  <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
    <file>logs/${APP_NAME}.log</file>
    <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
      <fileNamePattern>logs/${APP_NAME}-%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
      <maxFileSize>10MB</maxFileSize>
      <maxHistory>30</maxHistory>
      <totalSizeCap>1GB</totalSizeCap>
    </rollingPolicy>
    <encoder>
      <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
      <charset>UTF-8</charset>
    </encoder>
  </appender>

  <!-- 异步包装（减少 I/O 阻塞对业务线程的影响） -->
  <appender name="ASYNC_FILE" class="ch.qos.logback.classic.AsyncAppender">
    <appender-ref ref="FILE"/>
    <queueSize>512</queueSize>
    <discardingThreshold>0</discardingThreshold>
    <includeCallerData>false</includeCallerData>
  </appender>

  <!-- 开发环境：详细日志 -->
  <springProfile name="dev,local">
    <logger name="com.example" level="DEBUG"/>
    <logger name="org.springframework.web" level="DEBUG"/>
    <root level="INFO">
      <appender-ref ref="CONSOLE"/>
    </root>
  </springProfile>

  <!-- 生产环境：结构化日志 + 异步写文件 -->
  <springProfile name="prod">
    <logger name="com.example" level="INFO"/>
    <root level="WARN">
      <appender-ref ref="CONSOLE"/>
      <appender-ref ref="ASYNC_FILE"/>
    </root>
  </springProfile>

  <!-- 默认（未指定 profile） -->
  <springProfile name="!dev &amp; !local &amp; !prod">
    <root level="INFO">
      <appender-ref ref="CONSOLE"/>
    </root>
  </springProfile>
</configuration>
```

## 请求追踪（MDC）

```java
// 在 Filter 中注入 requestId（用于关联同一请求的所有日志）
@Component
class RequestTraceFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        var requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        MDC.put("requestId", requestId);
        res.setHeader("X-Request-Id", requestId);
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.clear();
        }
    }
}
```

```xml
<!-- logback-spring.xml 中引用 MDC -->
<pattern>%d{HH:mm:ss} [%X{requestId}] %-5level %logger{20} - %msg%n</pattern>
```
