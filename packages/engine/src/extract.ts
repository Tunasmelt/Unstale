import MarkdownIt from 'markdown-it'

export interface ExtractedClaim {
  file: string
  line: number
  source: 'inlineCode' | 'link' | 'import' | 'command'
  text: string
}

const MAX_BYTES = 1_048_576
const SHELLS = new Set(['sh', 'bash', 'shell', 'zsh', 'console'])
const CAPTURE_RULES = ['backticks', 'link', 'image'].map((name) => {
  const parser = new MarkdownIt()
  parser.inline.ruler.enableOnly(name)
  const rule = parser.inline.ruler.getRules('')[0]
  if (!rule) throw new Error(`Missing markdown-it rule: ${name}`)
  return { name, rule }
})

/** Extract candidates only. These are not verified findings and never cause I/O. */
export function extractClaims(markdown: string, file: string): ExtractedClaim[] {
  if (markdown.length > MAX_BYTES || new TextEncoder().encode(markdown).length > MAX_BYTES) {
    throw new RangeError('Markdown exceeds the 1 MB UTF-8 limit')
  }
  const md = new MarkdownIt({ html: true, linkify: false, maxNesting: 20 })
  // Parse blocks first so reference definitions are available to every inline parse.
  md.core.ruler.disable('inline')
  const env = {}
  const blocks = md.parse(markdown, env)
  const claims: ExtractedClaim[] = []
  let inlineSource = ''
  let baseLine = 0
  let newlineOffsets: number[] = []
  let candidates: { offset: number; claim: ExtractedClaim }[] = []

  const add = (offset: number, source: ExtractedClaim['source'], text: string) => {
    // Binary search avoids rescanning the paragraph for each candidate.
    let low = 0
    let high = newlineOffsets.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if ((newlineOffsets[middle] ?? Infinity) < offset) low = middle + 1
      else high = middle
    }
    candidates.push({ offset, claim: { file, line: baseLine + low + 1, source, text } })
  }

  // Wrap the pinned parser's existing rules to capture their original source offsets.
  // Token.map covers blocks only; searching rendered text loses escapes and repeated lines.
  md.inline.ruler.before('text', 'unstale_import', (state, silent) => {
    if (state.src[state.pos] !== '@' || (state.pos > 0 && !/\s/.test(state.src[state.pos - 1] ?? ''))) return false
    const match = /^@([^\s<>"'`()[\]@]+)/.exec(state.src.slice(state.pos, state.posMax))
    const text = match?.[1]?.replace(/[.,;:!?]+$/, '')
    if (!match || !text || !/[/.]/.test(text) || /:/.test(text)) return false
    if (!silent) {
      if (state.src === inlineSource) add(state.pos, 'import', text)
      state.pending += match[0]
    }
    state.pos += match[0].length
    return true
  })
  for (const { name, rule: original } of CAPTURE_RULES) {
    md.inline.ruler.at(name, (state, silent) => {
      const start = state.pos
      const count = state.tokens.length
      const matched = original(state, silent)
      // Image alt text is parsed in a separate source string and is not a doc claim.
      if (!matched || silent || state.src !== inlineSource) return matched
      const type = name === 'backticks' ? 'code_inline' : name === 'link' ? 'link_open' : 'image'
      const token = state.tokens.slice(count).find((item) => item.type === type)
      if (token) {
        const text = name === 'backticks' ? token.content : token.attrGet(name === 'link' ? 'href' : 'src')
        if (typeof text === 'string' && text && (name === 'backticks' || !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(text))) {
          add(start, name === 'backticks' ? 'inlineCode' : 'link', text)
        }
      }
      return matched
    })
  }

  for (const block of blocks) {
    if (!block.map) continue
    if (block.type === 'fence' && SHELLS.has(block.info.trim().split(/\s/)[0] ?? '')) {
      for (const [index, line] of block.content.split('\n').entries()) {
        const text = line.trim().replace(/^\$\s+/, '')
        if (text && !text.startsWith('#')) claims.push({ file, line: block.map[0] + index + 2, source: 'command', text })
      }
    } else if (block.type === 'inline') {
      inlineSource = block.content
      baseLine = block.map[0]
      newlineOffsets = []
      for (let i = 0; i < inlineSource.length; i++) if (inlineSource[i] === '\n') newlineOffsets.push(i)
      candidates = []
      md.inline.parse(inlineSource, md, env, [])
      candidates.sort((a, b) => a.offset - b.offset)
      claims.push(...candidates.map(({ claim }) => claim))
    }
  }
  return claims
}
