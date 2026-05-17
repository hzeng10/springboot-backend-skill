#!/usr/bin/env node
/**
 * create-project.mjs — Spring Boot 3.5 + JDK 21 + MySQL 项目生成器
 * 仅使用 Node 内置 API，无 node_modules 依赖。
 *
 * 用法：node scripts/create-project.mjs <projectName> <groupId> [artifactId] [packageName] [flags]
 *
 * 标志：
 *   --boot-version <version>  指定 Boot 版本（默认自动解析最新 3.5.x）
 *   --no-mirror               不注入阿里云 Maven 镜像
 *   --no-taskfile             不生成 Taskfile.yml
 *   --no-startup-banner       不生成 StartupInfoListener
 *   -h, --help                显示帮助
 */

import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { createGunzip } from 'node:zlib';
import { tmpdir } from 'node:os';
import https from 'node:https';

import { resolveBootVersion, getVersions } from './lib/versions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SKILL_DIR = join(__dirname, '..');
const TEMPLATES_DIR = join(SKILL_DIR, 'templates');

// ── 帮助 ──────────────────────────────────────────────────────────────────────
function showHelp() {
  console.log(`
用法: node scripts/create-project.mjs <projectName> <groupId> [artifactId] [packageName] [flags]

参数:
  projectName    项目名称（kebab-case，如 my-service）
  groupId        Maven groupId（如 com.example）
  artifactId     Maven artifactId（默认与 projectName 相同）
  packageName    Java 根包名（默认 groupId + ".app"）

标志:
  --boot-version <v>  指定 Boot 版本（默认自动解析最新 3.5.x）
  --no-mirror         不注入阿里云 Maven 镜像
  --no-taskfile       不生成 Taskfile.yml
  --no-startup-banner 不生成 StartupInfoListener
  -h, --help          显示此帮助

示例:
  node scripts/create-project.mjs my-service com.example
  node scripts/create-project.mjs my-service com.example my-service com.example.myservice
  node scripts/create-project.mjs my-service com.example --no-mirror --boot-version 3.5.0
`);
}

// ── 参数解析 ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = { mirror: true, taskfile: true, startupBanner: true, bootVersion: null };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') { showHelp(); process.exit(0); }
    else if (arg === '--no-mirror') flags.mirror = false;
    else if (arg === '--no-taskfile') flags.taskfile = false;
    else if (arg === '--no-startup-banner') flags.startupBanner = false;
    else if (arg === '--boot-version') { flags.bootVersion = args[++i]; }
    else if (arg.startsWith('--')) { console.error(`未知标志: ${arg}`); process.exit(1); }
    else positional.push(arg);
  }

  if (positional.length < 2) {
    console.error('错误: 必须提供 projectName 和 groupId');
    showHelp();
    process.exit(1);
  }

  const [projectName, groupId, artifactId, packageName] = positional;
  return {
    projectName,
    groupId,
    artifactId: artifactId || projectName,
    packageName: packageName || groupId + '.app',
    ...flags,
  };
}

// ── 下载辅助 ──────────────────────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/octet-stream' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

// ── 下载并解压 ZIP ────────────────────────────────────────────────────────────
async function downloadAndExtractProject(opts, bootVersion, targetDir) {
  const { projectName, groupId, artifactId, packageName } = opts;
  const dependencies = [
    'web', 'actuator', 'data-jpa', 'validation', 'mysql', 'flyway',
    'docker-compose', 'testcontainers', 'configuration-processor', 'modulith',
  ].join(',');

  const params = new URLSearchParams({
    type: 'maven-project',
    language: 'java',
    bootVersion,
    baseDir: artifactId,
    groupId,
    artifactId,
    name: projectName,
    description: `${projectName} - Spring Boot 3.5 + JDK 21 + MySQL`,
    packageName,
    packaging: 'jar',
    javaVersion: '21',
    dependencies,
  });

  const url = `https://start.spring.io/starter.zip?${params}`;
  console.log('  正在从 start.spring.io 下载项目模板...');

  const zipBuffer = await httpsGet(url);
  const tmpZip = join(tmpdir(), `spring-init-${Date.now()}.zip`);
  writeFileSync(tmpZip, zipBuffer);

  console.log('  正在解压...');
  await extractZip(tmpZip, targetDir);

  try { rmSync(tmpZip); } catch { /* ignore */ }
}

async function extractZip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });

  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const result = spawnSync('powershell', [
      '-Command',
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`,
    ], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('解压失败（PowerShell Expand-Archive）');
  } else {
    const result = spawnSync('unzip', ['-q', '-o', zipPath, '-d', destDir], { stdio: 'inherit' });
    if (result.status !== 0) {
      // 尝试 python 作为备选
      const py = spawnSync('python3', [
        '-c',
        `import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])`,
        zipPath, destDir,
      ], { stdio: 'inherit' });
      if (py.status !== 0) throw new Error('解压失败：请安装 unzip 或 python3');
    }
  }
}

// ── 包路径转目录路径 ──────────────────────────────────────────────────────────
function packageToPath(pkg) {
  return pkg.replace(/\./g, '/');
}

// ── mergeGitignore（sentinel 模式，避免重复合并）────────────────────────────
function mergeGitignore(projectDir) {
  const gitignorePath = join(projectDir, '.gitignore');
  const sentinel = '# ── springboot-backend-skill additions ──';
  const additions = `
${sentinel}
.env
.env.*
!.env.sample
.testcontainers.properties
node_modules/
`;
  let content = '';
  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, 'utf-8');
  }
  if (!content.includes(sentinel)) {
    writeFileSync(gitignorePath, content + additions, 'utf-8');
  }
}

// ── patchPom：合并插件和依赖到 pom.xml ──────────────────────────────────────
function patchPom(projectDir, opts, bootVersion) {
  const pomPath = join(projectDir, 'pom.xml');
  let pom = readFileSync(pomPath, 'utf-8');
  const v = getVersions();

  // 1. 注入 <properties>
  const propsToAdd = `
        <spotless.version>${v.spotlessVersion}</spotless.version>
        <palantir-java-format.version>${v.palantirJavaFormatVersion}</palantir-java-format.version>
        <jacoco.version>${v.jacocoVersion}</jacoco.version>
        <jacoco.minimum.coverage>0.80</jacoco.minimum.coverage>
        <git-commit-id.version>${v.gitCommitIdVersion}</git-commit-id.version>
        <taikai.version>${v.taikaiVersion}</taikai.version>
        <spring-modulith.version>${v.springModulithVersion}</spring-modulith.version>
        <maven-enforcer.version>${v.mavenEnforcerVersion}</maven-enforcer.version>
        <hypersistence-utils.version>${v.hypersistenceUtilsVersion}</hypersistence-utils.version>
        <jjwt.version>${v.jjwtVersion}</jjwt.version>`;

  pom = pom.replace(
    /(\s*<\/properties>)/,
    `${propsToAdd}$1`
  );

  // 2. 注入 Spring Modulith BOM 到 <dependencyManagement>
  const modulithBom = `
            <dependency>
                <groupId>org.springframework.modulith</groupId>
                <artifactId>spring-modulith-bom</artifactId>
                <version>\${spring-modulith.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>`;

  if (pom.includes('<dependencyManagement>')) {
    pom = pom.replace(
      /(<dependencyManagement>[\s\S]*?<dependencies>)/,
      `$1${modulithBom}`
    );
  } else {
    // 没有 dependencyManagement，插入在 <dependencies> 前
    pom = pom.replace(
      /(\s*<dependencies>)/,
      `\n    <dependencyManagement>\n        <dependencies>${modulithBom}\n        </dependencies>\n    </dependencyManagement>$1`
    );
  }

  // 3. 注入 Spring Modulith + Taikai + hypersistence-utils 到 <dependencies>
  const depsToAdd = `
        <!-- Spring Modulith -->
        <dependency>
            <groupId>org.springframework.modulith</groupId>
            <artifactId>spring-modulith-starter-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.modulith</groupId>
            <artifactId>spring-modulith-starter-jdbc</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.modulith</groupId>
            <artifactId>spring-modulith-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.modulith</groupId>
            <artifactId>spring-modulith-docs</artifactId>
            <scope>test</scope>
        </dependency>
        <!-- Taikai ArchUnit -->
        <dependency>
            <groupId>com.enofex</groupId>
            <artifactId>taikai</artifactId>
            <version>\${taikai.version}</version>
            <scope>test</scope>
        </dependency>
        <!-- Hypersistence Utils (TSID) -->
        <dependency>
            <groupId>io.hypersistence</groupId>
            <artifactId>hypersistence-utils-hibernate-63</artifactId>
            <version>\${hypersistence-utils.version}</version>
        </dependency>`;

  pom = pom.replace(
    /(\s*<dependencies>)/,
    `$1${depsToAdd}`
  );

  // 4. 注入插件（在 </plugins> 之前）
  const plugins = readFileSync(join(TEMPLATES_DIR, 'pom-plugins.xml'), 'utf-8');
  const enforcer = readFileSync(join(TEMPLATES_DIR, 'pom-enforcer.xml'), 'utf-8');

  if (pom.includes('<plugins>')) {
    pom = pom.replace(
      /(\s*<\/plugins>)/,
      `\n        ${plugins.trim()}\n\n        ${enforcer.trim()}$1`
    );
  } else {
    pom = pom.replace(
      /(\s*<\/build>)/,
      `\n    <plugins>\n        ${plugins.trim()}\n\n        ${enforcer.trim()}\n    </plugins>$1`
    );
  }

  writeFileSync(pomPath, pom, 'utf-8');
}

// ── 写入文件（替换模板占位符）───────────────────────────────────────────────
function writeTemplate(tmplName, destPath, replacements) {
  const tmplPath = join(TEMPLATES_DIR, tmplName);
  let content = readFileSync(tmplPath, 'utf-8');
  for (const [key, val] of Object.entries(replacements)) {
    content = content.split(key).join(val);
  }
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, content, 'utf-8');
}

// ── 主后处理编排 ──────────────────────────────────────────────────────────────
async function applyDotfiles(projectDir, opts) {
  const { projectName, packageName, mirror, taskfile, startupBanner } = opts;
  const pkgPath = packageToPath(packageName);
  const mainJava = join(projectDir, 'src/main/java', pkgPath);
  const testJava = join(projectDir, 'src/test/java', pkgPath);
  const mainRes = join(projectDir, 'src/main/resources');
  const testRes = join(projectDir, 'src/test/resources');

  // 确保目录存在
  mkdirSync(mainJava, { recursive: true });
  mkdirSync(testJava, { recursive: true });
  mkdirSync(join(mainRes, 'db/migration'), { recursive: true });
  mkdirSync(testRes, { recursive: true });

  console.log('  应用 application.properties...');
  const appProps = readFileSync(join(TEMPLATES_DIR, 'application.properties'), 'utf-8')
    .replace(/\{\{projectName\}\}/g, projectName);
  writeFileSync(join(mainRes, 'application.properties'), appProps, 'utf-8');

  console.log('  应用 application-test.properties...');
  copyFileSync(join(TEMPLATES_DIR, 'application-test.properties'), join(mainRes, 'application-test.properties'));

  console.log('  写入 Flyway V1__init.sql...');
  copyFileSync(join(TEMPLATES_DIR, 'V1__init.sql'), join(mainRes, 'db/migration/V1__init.sql'));

  console.log('  写入测试基础数据文件...');
  writeFileSync(join(testRes, 'test-data.sql'), '-- 测试前置数据（由 @Sql 在每个测试方法前执行）\n-- TRUNCATE TABLE app_user;\n', 'utf-8');

  console.log('  写入 compose.yaml...');
  copyFileSync(join(TEMPLATES_DIR, 'compose.yaml'), join(projectDir, 'compose.yaml'));

  console.log('  写入 .env.sample...');
  copyFileSync(join(TEMPLATES_DIR, 'env.sample'), join(projectDir, '.env.sample'));

  console.log('  合并 .gitignore...');
  mergeGitignore(projectDir);

  // TestcontainersConfiguration
  console.log('  写入 TestcontainersConfiguration.java...');
  writeTemplate('TestcontainersConfiguration.java.tmpl', join(testJava, 'TestcontainersConfiguration.java'), {
    '__PACKAGE__': packageName,
  });

  // BaseIT
  console.log('  写入 BaseIT.java...');
  writeTemplate('BaseIT.java.tmpl', join(testJava, 'BaseIT.java'), {
    '__PACKAGE__': packageName,
  });

  // NoLombokTest
  console.log('  写入 NoLombokTest.java...');
  writeTemplate('NoLombokTest.java.tmpl', join(testJava, 'NoLombokTest.java'), {
    '__PACKAGE__': packageName,
  });

  // ArchitectureTest
  console.log('  写入 ArchitectureTest.java...');
  writeTemplate('ArchitectureTest.java.tmpl', join(testJava, 'ArchitectureTest.java'), {
    '__PACKAGE__': packageName,
    '__BASE_PACKAGE__': packageName,
  });

  // ModularityTest — 推断主应用类名
  const appClassName = toClassName(opts.artifactId) + 'Application';
  console.log('  写入 ModularityTest.java...');
  writeTemplate('ModularityTest.java.tmpl', join(testJava, 'ModularityTest.java'), {
    '__PACKAGE__': packageName,
    '__APP_CLASS__': appClassName,
  });

  // package-info.java 示例（users 模块）
  console.log('  写入示例模块 package-info.java...');
  const usersModulePkg = packageName + '.users';
  mkdirSync(join(mainJava, 'users'), { recursive: true });
  writeFileSync(join(mainJava, 'users', 'package-info.java'),
    `@org.springframework.modulith.ApplicationModule(\n    displayName = "Users",\n    allowedDependencies = {"shared"}\n)\npackage ${usersModulePkg};\n`,
    'utf-8'
  );

  // shared 模块 package-info.java
  const sharedModulePkg = packageName + '.shared';
  mkdirSync(join(mainJava, 'shared'), { recursive: true });
  writeFileSync(join(mainJava, 'shared', 'package-info.java'),
    `@org.springframework.modulith.ApplicationModule(\n    type = org.springframework.modulith.ApplicationModule.Type.OPEN\n)\npackage ${sharedModulePkg};\n`,
    'utf-8'
  );

  // StartupInfoListener
  if (startupBanner) {
    console.log('  写入 StartupInfoListener.java...');
    const configDir = join(mainJava, 'config');
    mkdirSync(configDir, { recursive: true });
    writeTemplate('StartupInfoListener.java.tmpl', join(configDir, 'StartupInfoListener.java'), {
      '__PACKAGE__': packageName,
    });
  }

  // Taskfile.yml
  if (taskfile) {
    console.log('  写入 Taskfile.yml...');
    copyFileSync(join(TEMPLATES_DIR, 'Taskfile.yml'), join(projectDir, 'Taskfile.yml'));
  }

  // 阿里云 Maven 镜像
  if (mirror) {
    console.log('  注入阿里云 Maven 镜像（.mvn/settings.xml）...');
    const mvnDir = join(projectDir, '.mvn');
    mkdirSync(mvnDir, { recursive: true });
    copyFileSync(join(TEMPLATES_DIR, 'settings.xml.aliyun'), join(mvnDir, 'settings.xml'));
  }
}

// ── kebab-case → PascalCase ───────────────────────────────────────────────────
function toClassName(name) {
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

// ── 打印后续步骤 ──────────────────────────────────────────────────────────────
function printNextSteps(opts) {
  const { projectName, artifactId } = opts;
  const dir = artifactId || projectName;
  console.log(`
╔══════════════════════════════════════════════════════════╗
  项目生成成功！

  后续步骤：

  1. cd ${dir}
  2. cp .env.sample .env        # 填入本地数据库密码
  3. docker compose up -d       # 启动 MySQL
  4. ./mvnw spotless:apply      # 格式化代码
  5. ./mvnw spring-boot:run     # 启动应用
  6. ./mvnw verify              # 全量测试

  API:      http://localhost:8080/api
  Actuator: http://localhost:8080/actuator/health
╚══════════════════════════════════════════════════════════╝
`);
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv);
  const { projectName, groupId, artifactId, packageName, bootVersion: userBootVersion } = opts;

  console.log(`\n生成 Spring Boot 项目：${projectName}`);
  console.log(`  groupId:     ${groupId}`);
  console.log(`  artifactId:  ${artifactId}`);
  console.log(`  packageName: ${packageName}`);

  console.log('\n解析 Spring Boot 版本...');
  const bootVersion = userBootVersion || await resolveBootVersion();
  console.log(`  Boot 版本: ${bootVersion}`);

  const targetParentDir = process.cwd();
  const projectDir = join(targetParentDir, artifactId);

  if (existsSync(projectDir)) {
    console.error(`\n错误：目录已存在 → ${projectDir}`);
    process.exit(1);
  }

  console.log('\n下载并解压 Spring Initializr 模板...');
  await downloadAndExtractProject(opts, bootVersion, targetParentDir);

  console.log('\n修改 pom.xml...');
  patchPom(projectDir, opts, bootVersion);

  console.log('\n应用 dotfiles 和模板文件...');
  await applyDotfiles(projectDir, opts);

  printNextSteps(opts);
}

main().catch(err => {
  console.error('\n生成失败:', err.message);
  process.exit(1);
});
