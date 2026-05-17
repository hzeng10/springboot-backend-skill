/**
 * versions.mjs — 从 versions.json 读取版本常量，提供网络版本解析辅助。
 * 仅使用 Node 内置 API（node:fs、node:https、全局 fetch），无 node_modules。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _versionsCache = null;

function loadVersions() {
  if (_versionsCache) return _versionsCache;
  try {
    const filePath = join(__dirname, '../../versions.json');
    _versionsCache = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    // 文件缺失时返回硬编码默认值
    _versionsCache = {
      javaVersion: '21',
      springBootPreferredMajor: '3',
      springBootFallback: '3.5.0',
      mysqlVersion: '8.4',
      temurinVersion: '21',
      mavenMinVersion: '3.9.0',
      flywayVersion: '10',
      testcontainersVersion: '1.20.4',
      mysqlConnectorVersion: '9.0.0',
      spotlessVersion: '3.2.0',
      palantirJavaFormatVersion: '2.85.0',
      jacocoVersion: '0.8.14',
      jacocoMinimumCoverage: '80%',
      gitCommitIdVersion: '9.0.1',
      taikaiVersion: '1.60.0',
      mavenEnforcerVersion: '3.4.1',
      jjwtVersion: '0.12.5',
      springModulithVersion: '1.4.1',
      hypersistenceUtilsVersion: '3.9.10',
    };
  }
  return _versionsCache;
}

export function getVersions() {
  return loadVersions();
}

export function getJavaVersion() { return loadVersions().javaVersion; }
export function getSpringBootFallback() { return loadVersions().springBootFallback; }
export function getMysqlVersion() { return loadVersions().mysqlVersion; }
export function getSpotlessVersion() { return loadVersions().spotlessVersion; }
export function getJacocoVersion() { return loadVersions().jacocoVersion; }
export function getTaikaiVersion() { return loadVersions().taikaiVersion; }
export function getSpringModulithVersion() { return loadVersions().springModulithVersion; }

/**
 * 从 start.spring.io 解析最新的 Boot 3.5.x GA 版本。
 * 失败时回退到 versions.json 中的 springBootFallback。
 */
export async function resolveBootVersion(preferredMajorVersion) {
  const fallback = loadVersions().springBootFallback;
  const major = preferredMajorVersion || loadVersions().springBootPreferredMajor;

  try {
    const resp = await fetch('https://start.spring.io/metadata/client', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const meta = await resp.json();

    const versions = meta?.bootVersion?.values ?? [];
    const ga = versions
      .flatMap(group => group.values ?? [])
      .map(v => v.id)
      .filter(id => id && !id.includes('SNAPSHOT') && !id.includes('M') && !id.includes('RC'))
      .filter(id => id.startsWith(major + '.'))
      .sort((a, b) => compareVersions(b, a)); // 降序，最新在前

    if (ga.length === 0) return fallback;

    const candidate = ga[0].replace(/\.(RELEASE|GA)$/, '');

    // HEAD 校验 Maven Central 可用性
    const mavenUrl = `https://repo1.maven.org/maven2/org/springframework/boot/spring-boot/${candidate}/`;
    try {
      const check = await fetch(mavenUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      if (check.ok) return candidate;
    } catch {
      // Maven Central 不可达，接受候选版本
      return candidate;
    }

    return candidate;
  } catch (err) {
    console.warn(`  [警告] 无法解析 Boot 版本（${err.message}），使用回退版本 ${fallback}`);
    return fallback;
  }
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
