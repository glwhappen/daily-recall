import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { validateBank } from '../src/lib/validate';
import type { QuestionBank } from '../src/lib/types';

const questionsDir = fileURLToPath(new URL('../questions', import.meta.url));
const files = readdirSync(questionsDir).filter((f) => f.endsWith('.yaml'));

/** 题库是社区贡献的主要入口，所以这些约束在 CI 里必须挡住坏题。 */
describe('题库', () => {
  it('至少有中文基准题库', () => {
    expect(files).toContain('zh-CN.yaml');
  });

  for (const file of files) {
    describe(file, () => {
      const bank = validateBank(yaml.load(readFileSync(join(questionsDir, file), 'utf8'))) as QuestionBank;

      it('通过完整校验', () => {
        expect(bank.questions.length).toBeGreaterThan(0);
      });

      it('id 全局唯一', () => {
        const ids = bank.questions.map((q) => q.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('每个分类下都至少有一道题（不留空分类）', () => {
        const used = new Set(bank.questions.map((q) => q.category));
        for (const category of bank.categories) {
          expect(used.has(category.id), `分类 ${category.id} 没有题目`).toBe(true);
        }
      });

      it('每题都给出「不记得」或「记得/想不起来」这样的出口', () => {
        for (const question of bank.questions) {
          const kinds = new Set(question.options.map((o) => o.kind));
          expect(
            kinds.has('forgot'),
            `${question.id} 没有 forgot 选项，用户只能瞎猜`,
          ).toBe(true);
        }
      });

      it('每道题都能在「昨天」被问到', () => {
        for (const question of bank.questions) {
          expect(question.offsets, `${question.id} 的 offsets 不含 1`).toContain(1);
        }
      });

      it('选项文字都做了 trim，不留首尾空格', () => {
        for (const question of bank.questions) {
          for (const option of question.options) {
            expect(option.value).toBe(option.value.trim());
          }
        }
      });

      it('题干以「？」或「?」结尾，保持一致的提问语气', () => {
        for (const question of bank.questions) {
          expect(/[？?]$/.test(question.text), `${question.id} 的题干结尾不规范`).toBe(true);
        }
      });
    });
  }
});
