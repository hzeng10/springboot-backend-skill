# 项目初始化与 dotfiles 配置

## .gitignore

合并 Spring Initializr 标准规则与以下扩展：

```gitignore
### Spring Boot / Maven ###
target/
!.mvn/wrapper/maven-wrapper.jar
!**/src/main/**/target/
!**/src/test/**/target/
*.class
*.log
*.jar
*.war
*.ear
*.zip
*.tar.gz
*.rar
hs_err_pid*
replay_pid*

### dotenv ###
.env
.env.*
!.env.sample

### IDE ###
.idea/
*.iml
.vscode/
*.swp
*.swo

### Node（脚本工具） ###
node_modules/
npm-debug.log*

### Testcontainers ###
.testcontainers.properties

### OS ###
.DS_Store
Thumbs.db
```

## .editorconfig

```editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{java,xml,json,yml,yaml,properties,sql}]
indent_style = space
indent_size = 4

[*.{js,mjs,ts,css,html}]
indent_style = space
indent_size = 2
```

## .gitattributes

```gitattributes
* text=auto
*.sh  text eol=lf
*.ps1 text eol=crlf
*.java text eol=lf
*.xml text eol=lf
*.properties text eol=lf
*.yml text eol=lf
*.json text eol=lf
*.sql text eol=lf
*.md text eol=lf
*.png binary
*.jar binary
*.zip binary
```

## .dockerignore

```dockerignore
.git/
.github/
.gitignore
.editorconfig
target/
*.md
node_modules/
.env
.env.*
!.env.sample
```

## .env 安全约定

| 文件 | 用途 | 是否提交到 Git |
|---|---|---|
| `.env` | 本地开发真实密钥 | **绝不提交** |
| `.env.sample` | 占位键名模板 | 提交，供团队参考 |

**.env.sample 示例：**

```bash
# 数据库（本地开发用，生产通过 K8s Secret / 云参数存储注入）
SPRING_DATASOURCE_URL=
SPRING_DATASOURCE_USERNAME=
SPRING_DATASOURCE_PASSWORD=

# JWT
JWT_SECRET=
JWT_EXPIRATION_MS=
```

**规则：**
- 代码永远不读取 `.env` 文件内容
- `.env` 列入 `.gitignore`，通过 pre-commit hook 二次检测
- 生产密钥通过环境变量或 Secrets Manager 注入，不在 `application.properties` 硬编码

## .devcontainer（可选）

```json
{
  "name": "Spring Boot Dev",
  "image": "mcr.microsoft.com/devcontainers/java:21",
  "features": {
    "ghcr.io/devcontainers/features/java:1": {
      "version": "21",
      "installMaven": true
    },
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },
  "postCreateCommand": "./mvnw -q dependency:resolve",
  "forwardPorts": [8080, 3306],
  "remoteEnv": {
    "TESTCONTAINERS_RYUK_DISABLED": "true"
  }
}
```

## 首次项目初始化检查清单

- [ ] 生成项目：`node scripts/create-project.mjs <name> <groupId>`
- [ ] 复制 `.env.sample` 为 `.env` 并填入本地值
- [ ] `docker compose up -d`（启动 MySQL）
- [ ] `./mvnw -q spotless:apply`（格式化代码）
- [ ] `./mvnw -q -DskipTests package`（验证编译）
- [ ] `./mvnw spring-boot:run`（启动应用）
- [ ] 访问 `http://localhost:8080/actuator/health`（确认 UP）
