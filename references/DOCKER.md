# Docker Compose 与容器化

## compose.yaml（本地开发）

```yaml
services:
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: mydb
      MYSQL_USER: user
      MYSQL_PASSWORD: password
      MYSQL_ROOT_PASSWORD: rootpassword
      TZ: Asia/Shanghai
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 可选：本地邮件测试（取消注释启用）
  # mailpit:
  #   image: axllent/mailpit:latest
  #   ports:
  #     - "1025:1025"   # SMTP
  #     - "8025:8025"   # Web UI
  #   environment:
  #     MP_MAX_MESSAGES: 500

volumes:
  mysql_data:
```

## spring-boot-docker-compose 集成

在 `pom.xml` 添加依赖（Spring Initializr 生成时选 `docker-compose`）：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-docker-compose</artifactId>
  <scope>runtime</scope>
  <optional>true</optional>
</dependency>
```

Boot 会在启动时自动检测并运行 `compose.yaml`。

```properties
# 仅启动容器，应用停止时不自动关闭（保留数据）
spring.docker.compose.lifecycle-management=start-only

# 指定 compose 文件（默认自动查找 compose.yaml）
# spring.docker.compose.file=compose.yaml
```

## Dockerfile（生产镜像）

```dockerfile
# 构建阶段
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -q dependency:resolve -Dmaven.test.skip=true
COPY src/ src/
RUN ./mvnw -q -Dmaven.test.skip=true package

# 运行阶段
FROM eclipse-temurin:21-jre-alpine
LABEL maintainer="your-team@example.com"

# 非 root 用户运行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar

# JVM 容器感知
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

## 构建镜像（Spring Boot Maven Plugin）

```bash
# Paketo Buildpacks（无 Dockerfile）
./mvnw spring-boot:build-image -DskipTests

# 或用 Taskfile
task build-image
```

```xml
<!-- pom.xml 中配置镜像名 -->
<plugin>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-maven-plugin</artifactId>
  <configuration>
    <image>
      <name>${project.artifactId}:${project.version}</name>
    </image>
  </configuration>
</plugin>
```

## 常用 Docker 命令

```bash
# 启动本地 MySQL
docker compose up -d

# 查看日志
docker compose logs -f mysql

# 进入 MySQL 命令行
docker compose exec mysql mysql -u user -p mydb

# 停止并清除数据（重置数据库）
docker compose down -v

# 重建容器（更新镜像）
docker compose pull && docker compose up -d --force-recreate
```

## CI/CD 中的 Testcontainers

集成测试使用 Testcontainers，无需在 CI 机器上安装 MySQL：

```yaml
# .github/workflows/ci.yml 片段
- name: Run tests
  run: ./mvnw verify
  env:
    TESTCONTAINERS_RYUK_DISABLED: "true"   # GitHub Actions 环境
```

Testcontainers 自动拉取 `mysql:8.4` 镜像并在测试结束后清理。
