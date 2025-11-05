#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取 __dirname 的 ES 模块等价物
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ 请提供版本号，例如: pnpm version:update 0.2.0');
  process.exit(1);
}

const newVersion = args[0];

// 验证版本号格式
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('❌ 版本号格式错误，应该是 x.y.z 格式（如 0.2.0）');
  process.exit(1);
}

console.log(`🔄 正在更新版本号到 ${newVersion}...\n`);

// 1. 更新根目录 package.json
const rootPackageJsonPath = path.join(__dirname, '..', 'package.json');
const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const oldRootVersion = rootPackageJson.version;
rootPackageJson.version = newVersion;
fs.writeFileSync(rootPackageJsonPath, JSON.stringify(rootPackageJson, null, 2) + '\n');
console.log(`✅ 根目录 package.json: ${oldRootVersion} → ${newVersion}`);

// 2. 更新 desktop/package.json
const desktopPackageJsonPath = path.join(__dirname, '..', 'desktop', 'package.json');
if (fs.existsSync(desktopPackageJsonPath)) {
  const desktopPackageJson = JSON.parse(fs.readFileSync(desktopPackageJsonPath, 'utf8'));
  const oldDesktopVersion = desktopPackageJson.version;
  desktopPackageJson.version = newVersion;
  fs.writeFileSync(desktopPackageJsonPath, JSON.stringify(desktopPackageJson, null, 2) + '\n');
  console.log(`✅ desktop/package.json: ${oldDesktopVersion} → ${newVersion}`);
}

// 3. 更新 desktop/src-tauri/Cargo.toml
const cargoTomlPath = path.join(__dirname, '..', 'desktop', 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  const cargoVersionMatch = cargoToml.match(/version = "([^"]+)"/);
  const oldCargoVersion = cargoVersionMatch ? cargoVersionMatch[1] : '未知';
  cargoToml = cargoToml.replace(
    /version = "[^"]+"/,
    `version = "${newVersion}"`
  );
  fs.writeFileSync(cargoTomlPath, cargoToml);
  console.log(`✅ desktop/src-tauri/Cargo.toml: ${oldCargoVersion} → ${newVersion}`);
}

// 4. 更新 desktop/src-tauri/tauri.conf.json
const tauriConfPath = path.join(__dirname, '..', 'desktop', 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  const oldTauriVersion = tauriConf.version;
  tauriConf.version = newVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`✅ desktop/src-tauri/tauri.conf.json: ${oldTauriVersion} → ${newVersion}`);
}

// 5. 更新 frontend/package.json
const frontendPackageJsonPath = path.join(__dirname, '..', 'frontend', 'package.json');
if (fs.existsSync(frontendPackageJsonPath)) {
  const frontendPackageJson = JSON.parse(fs.readFileSync(frontendPackageJsonPath, 'utf8'));
  const oldFrontendVersion = frontendPackageJson.version;
  frontendPackageJson.version = newVersion;
  fs.writeFileSync(frontendPackageJsonPath, JSON.stringify(frontendPackageJson, null, 2) + '\n');
  console.log(`✅ frontend/package.json: ${oldFrontendVersion} → ${newVersion}`);
}

console.log(`\n🎉 版本号已全部更新为 ${newVersion}！`);
console.log('\n💡 下一步操作：');
console.log('   1. 运行 pnpm install 更新 pnpm-lock.yaml');
console.log('   2. 提交更改: git add . && git commit -m "chore: bump version to ' + newVersion + '"');
console.log('   3. 创建标签: git tag v' + newVersion);
console.log('   4. 推送更改: git push && git push --tags');
