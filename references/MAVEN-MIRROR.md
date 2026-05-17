# 阿里云 Maven 镜像

## 项目级配置（推荐，不污染全局）

生成项目时默认注入到 `.mvn/settings.xml`（可通过 `--no-mirror` 标志关闭）：

```xml
<!-- .mvn/settings.xml -->
<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.2.0
          https://maven.apache.org/xsd/settings-1.2.0.xsd">
  <mirrors>
    <mirror>
      <id>aliyunmaven</id>
      <mirrorOf>*</mirrorOf>
      <name>Aliyun Maven</name>
      <url>https://maven.aliyun.com/repository/public</url>
    </mirror>
  </mirrors>
</settings>
```

Maven 自动读取项目根目录下的 `.mvn/settings.xml`，优先于用户级 `~/.m2/settings.xml`。

## 全局配置（可选，影响所有项目）

```xml
<!-- ~/.m2/settings.xml -->
<settings>
  <mirrors>
    <mirror>
      <id>aliyunmaven</id>
      <mirrorOf>*</mirrorOf>
      <name>Aliyun Maven</name>
      <url>https://maven.aliyun.com/repository/public</url>
    </mirror>
  </mirrors>
</settings>
```

## 可用镜像仓库

| 仓库名 | URL | 说明 |
|---|---|---|
| public（聚合） | `https://maven.aliyun.com/repository/public` | 镜像 central + jcenter |
| central | `https://maven.aliyun.com/repository/central` | 仅 Maven Central |
| spring | `https://maven.aliyun.com/repository/spring` | Spring 官方仓库 |
| gradle-plugin | `https://maven.aliyun.com/repository/gradle-plugin` | Gradle 插件（不需要） |

**推荐使用 `public`（聚合仓库）**，覆盖 central + jcenter，一个配置解决绝大多数依赖。

## 验证镜像生效

```bash
./mvnw -X help:effective-settings | grep -A3 "aliyun"
# 应看到 aliyunmaven mirror 配置被加载
```

## 生成时关闭镜像

```bash
# 不生成阿里云镜像配置（适合海外环境或已有全局配置的团队）
node scripts/create-project.mjs my-service com.example --no-mirror
```

## 镜像更新策略

```xml
<!-- 如需强制更新 SNAPSHOT 依赖 -->
<repository>
  <id>aliyunmaven</id>
  <snapshots>
    <updatePolicy>always</updatePolicy>
  </snapshots>
</repository>
```

## Spring Boot 3.5 + Spring Modulith 依赖加速

所有 Spring Boot、Spring Modulith、Testcontainers 依赖均已在阿里云 public 镜像中同步。如遇特定依赖无法从阿里云获取，可在 `.mvn/settings.xml` 中额外配置官方仓库作为备选。
