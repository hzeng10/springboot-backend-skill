# 架构测试：Taikai ArchUnit + no-Lombok 守护

## Maven 依赖

```xml
<dependency>
  <groupId>com.enofex</groupId>
  <artifactId>taikai</artifactId>
  <version>${taikai.version}</version>  <!-- 1.60.0 -->
  <scope>test</scope>
</dependency>
```

## ArchitectureTest.java（完整 Taikai 规则集）

```java
import com.enofex.taikai.Taikai;
import org.junit.jupiter.api.Test;

class ArchitectureTest {

    private static final String BASE_PACKAGE = "com.example.demo";

    @Test
    void shouldFollowArchitectureRules() {
        Taikai.builder()
            .namespace(BASE_PACKAGE)
            .java(java -> java
                .noUsageOfDeprecatedAPIs()
                .noUsageOfSystemOutOrErr()
                .methodsShouldNotThrowGenericException()
                .utilityClassesShouldBeFinalAndHavePrivateConstructor()
                .noImportsCycles()
                .fieldsShouldNotHaveCollectionSuffixes()
                .constantsShouldFollowConventions()
                .interfacesShouldNotHavePrefixI()
            )
            .logging(logging -> logging
                .loggersShouldBePrivateStaticFinal()
                .loggersShouldBeNamedLog()
            )
            .test(test -> test
                .classesShouldBePackagePrivate(".*Test")
                .classesShouldNotBeAnnotatedWithDisabled()
            )
            .spring(spring -> spring
                .noAutowiredFields()
                .controllers(controllers -> controllers
                    .shouldBeAnnotatedWithRestController()
                    .namesShouldEndWithController()
                    .shouldBePackagePrivate()
                    .shouldNotDependOnOtherControllers()
                )
                .services(services -> services
                    .shouldBeAnnotatedWithService()
                    .namesShouldEndWithService()
                    .shouldNotDependOnControllers()
                )
                .repositories(repositories -> repositories
                    .shouldNotDependOnServices()
                    .namesShouldEndWithRepository()
                )
                .configurations(configurations -> configurations
                    .namesShouldMatch(".+Config")
                )
            )
            .build()
            .check();
    }
}
```

## NoLombokTest.java（no-Lombok 守护）

```java
import com.tngtech.archunit.core.importer.ClassFileImporter;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

class NoLombokTest {

    @Test
    void noLombokOnClasspath() {
        classes()
            .should()
            .notDependOnClassesThat()
            .resideInAPackage("..lombok..")
            .check(new ClassFileImporter().importPath("target/classes"));
    }
}
```

## Maven Enforcer（双重保险）

```xml
<!-- pom.xml — 禁止 Lombok 依赖 -->
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-enforcer-plugin</artifactId>
  <version>${maven-enforcer.version}</version>
  <executions>
    <execution>
      <id>enforce-rules</id>
      <goals>
        <goal>enforce</goal>
      </goals>
      <configuration>
        <rules>
          <requireMavenVersion>
            <version>[3.9.0,)</version>
          </requireMavenVersion>
          <requireJavaVersion>
            <version>[21,)</version>
          </requireJavaVersion>
          <bannedDependencies>
            <excludes>
              <exclude>org.projectlombok:lombok</exclude>
            </excludes>
            <message>禁止使用 Lombok！请改用 Java record 或 IDE 生成代码。</message>
          </bannedDependencies>
        </rules>
      </configuration>
    </execution>
  </executions>
</plugin>
```

## 架构规则说明

| 规则 | 目的 |
|---|---|
| `noAutowiredFields` | 强制构造器注入，提高可测试性 |
| `controllers shouldBePackagePrivate` | 封装路由细节，防止跨包直接引用 |
| `controllers shouldNotDependOnOtherControllers` | 防止 Controller 层耦合 |
| `services shouldNotDependOnControllers` | 维护层次边界 |
| `repositories shouldNotDependOnServices` | 防止循环依赖 |
| `configurations namesShouldMatch(".+Config")` | 统一配置类命名 |
| `loggersShouldBeNamedLog` | 统一日志字段名为 `LOG` |
| `noImportsCycles` | 防止包级循环依赖 |
| `noUsageOfDeprecatedAPIs` | 及时迁移废弃 API |

## 运行架构测试

```bash
# 随 verify 一起运行
./mvnw verify

# 单独运行（跳过集成测试）
./mvnw test -Dtest="ArchitectureTest,NoLombokTest"
```

## 与 Spring Modulith 的协同

| 工具 | 检查范围 |
|---|---|
| **Taikai ArchUnit** | 类级：命名规范、可见性、注解约定、Spring 层次 |
| **Spring Modulith verify()** | 包级：模块边界、跨模块依赖、命名接口使用 |

两者互补，都在 `./mvnw verify` 中运行，违规即构建失败。
