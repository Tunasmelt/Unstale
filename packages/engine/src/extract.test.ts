import { describe, expect, it } from 'vitest'

import { extractClaims } from './index.js'

const file = 'docs/guide.md'

describe('REQ-003 markdown claim extraction', () => {
  it('extracts inline code with exact file and one-based lines', () => {
    expect(extractClaims('# Guide\n\nUse `src/main.ts`.\nThen `src/main.ts`.', file)).toEqual([
      { file, line: 3, source: 'inlineCode', text: 'src/main.ts' },
      { file, line: 4, source: 'inlineCode', text: 'src/main.ts' },
    ])
  })

  it('handles multi-backtick spans and normalises multiline code content', () => {
    expect(extractClaims('Use ``a`b`` and `first\nsecond`.', file)).toEqual([
      { file, line: 1, source: 'inlineCode', text: 'a`b' },
      { file, line: 1, source: 'inlineCode', text: 'first second' },
    ])
  })

  it('extracts relative links, anchors, reference links and image destinations', () => {
    const markdown = '[Guide](./guide.md)\n[Section](#install)\n[API][api]\n![Diagram](../diagram.png)\n\n[api]: ../API.md#routes'
    expect(extractClaims(markdown, file)).toEqual([
      { file, line: 1, source: 'link', text: './guide.md' },
      { file, line: 2, source: 'link', text: '#install' },
      { file, line: 3, source: 'link', text: '../API.md#routes' },
      { file, line: 4, source: 'link', text: '../diagram.png' },
    ])
  })

  it('extracts explicit @path imports but not emails', () => {
    expect(extractClaims('@./CLAUDE.md\nSee @../RULES.md and @docs/SETUP.md\nmail@example.com', file)).toEqual([
      { file, line: 1, source: 'import', text: './CLAUDE.md' },
      { file, line: 2, source: 'import', text: '../RULES.md' },
      { file, line: 2, source: 'import', text: 'docs/SETUP.md' },
    ])
  })

  it.each(['sh', 'bash', 'shell', 'zsh', 'console'])('extracts commands in %s fences, skipping comments and blank lines', (language) => {
    const markdown = ['# Install', '```' + language, '# prerequisite', '', '$ pnpm install', 'pnpm test', '```'].join('\n')
    expect(extractClaims(markdown, file)).toEqual([
      { file, line: 5, source: 'command', text: 'pnpm install' },
      { file, line: 6, source: 'command', text: 'pnpm test' },
    ])
  })

  it.each(['\n', '\r\n'])('preserves source lines in nested markdown with %j endings', (eol) => {
    const markdown = ['# Guide', '', '> - Use `src/a.ts`', '>   then `src/b.ts`', '', '- [Read](./README.md)'].join(eol)
    expect(extractClaims(markdown, file)).toEqual([
      { file, line: 3, source: 'inlineCode', text: 'src/a.ts' },
      { file, line: 4, source: 'inlineCode', text: 'src/b.ts' },
      { file, line: 6, source: 'link', text: './README.md' },
    ])
  })

  it('does not extract ordinary prose, remote links, emails, HTML or non-shell code', () => {
    const markdown = [
      'The route is src/main.ts and the command is pnpm test.',
      '[Remote](https://example.com/guide) [Email](mailto:person@example.com)',
      '<https://example.com> mail@example.com',
      '<div data-file="src/main.ts">plain</div>',
      '```ts',
      'const x = `src/main.ts`',
      '@docs/guide.md',
      '```',
    ].join('\n')
    expect(extractClaims(markdown, file)).toEqual([])
  })

  it('returns no candidates for an empty document', () => {
    expect(extractClaims('', file)).toEqual([])
  })

  it('keeps escaped imports, HTML attributes and code-fenced imports out of prose extraction', () => {
    expect(extractClaims('\\@docs/no.md <span title="@docs/no.md">ok</span> `@docs/code.md` @file.md', file)).toEqual([
      { file, line: 1, source: 'inlineCode', text: '@docs/code.md' },
      { file, line: 1, source: 'import', text: 'file.md' },
    ])
  })

  it('SEC-031 rejects markdown exceeding 1 MB measured in UTF-8 bytes', () => {
    expect(() => extractClaims('x'.repeat(1_048_577), file)).toThrow(RangeError)
    expect(() => extractClaims('é'.repeat(524_289), file)).toThrow(RangeError)
  })

  it('SEC-034 finishes bounded malformed markdown without extracting prose', () => {
    const markdown = '['.repeat(20_000) + ' ordinary prose ' + ']'.repeat(20_000)
    expect(extractClaims(markdown, file)).toEqual([])
    expect(extractClaims('@'.repeat(40_000), file)).toEqual([])
  }, 2_000)
})
