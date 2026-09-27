#!/usr/bin/env node
/**
 * 把 questions/*.yaml 编译成 src/generated/questions.json。
 *
 * YAML 是唯一事实源（方便社区提 PR 加题），JSON 是构建产物、不入库。
 * 校验在这里做，坏题会让构建直接失败，而不是发给用户。
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { validateBank } from '../src/lib/validate.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const questionsDir = join(root, 'questions');
const outFile = join(root, 'src', 'generated', 'questions.json');

const files = readdirSync(questionsDir)
  .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
  .sort();

if (files.length === 0) {
  console.error('[questions] questions/ 下没有找到任何题库文件');
  process.exit(1);
}

const banks = {};
for (const file of files) {
  let raw;
  try {
    raw = yaml.load(readFileSync(join(questionsDir, file), 'utf8'));
  } catch (err) {
    console.error(`[questions] ${file} YAML 解析失败：${err.message}`);
    process.exit(1);
  }
  let bank;
  try {
    bank = validateBank(raw);
  } catch (err) {
    console.error(`[questions] ${file} 校验失败：${err.message}`);
    process.exit(1);
  }
  if (banks[bank.locale]) {
    console.error(`[questions] locale "${bank.locale}" 在多个文件中重复定义`);
    process.exit(1);
  }
  banks[bank.locale] = bank;
  console.log(
    `[questions] ${file} → ${bank.locale}：${bank.questions.length} 道题 / ${bank.categories.length} 个分类`,
  );
}

if (!banks['zh-CN']) {
  console.error('[questions] 缺少基准题库 questions/zh-CN.yaml');
  process.exit(1);
}

mkdirSync(join(root, 'src', 'generated'), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(banks, null, 2)}\n`);
console.log(`[questions] 已写出 ${outFile}`);
