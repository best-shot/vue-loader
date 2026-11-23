import { SourceMapConsumer } from 'source-map'
import { fs as mfs } from 'memfs'
import cssesc from 'cssesc'
import {
  bundle,
  mockBundleAndRun,
  normalizeNewline,
  genId,
  DEFAULT_VUE_USE,
} from './utils'


test('support chaining with other loaders', async () => {
  const { componentModule } = await mockBundleAndRun({
    entry: 'basic.vue',
    modify: (config) => {
      config!.module!.rules![0] = {
        test: /\.vue$/,
        use: [DEFAULT_VUE_USE, require.resolve('./mock-loaders/js')],
      }
    },
  })

  expect(componentModule.data().msg).toBe('Changed!')
})

test.skip('inherit queries on files', async () => {
  const { componentModule } = await mockBundleAndRun({
    entry: 'basic.vue?change',
    modify: (config) => {
      config!.module!.rules![0] = {
        test: /\.vue$/,
        use: [DEFAULT_VUE_USE, require.resolve('./mock-loaders/query')],
      }
    },
  })

  expect(componentModule.data().msg).toBe('Changed!')
})

test('expose file path as __file outside production', async () => {
  const { componentModule } = await mockBundleAndRun({
    entry: 'basic.vue',
  })

  expect(componentModule.__file).toBe('test/fixtures/basic.vue')
})

test('no __file in production when exposeFilename disabled', async () => {
  const { componentModule } = await mockBundleAndRun({
    mode: 'production',
    entry: 'basic.vue',
  })

  expect(componentModule.__file).toBe(undefined)
})

test('expose file basename as __file in production when exposeFilename enabled', async () => {
  const { componentModule } = await mockBundleAndRun({
    mode: 'production',
    entry: 'basic.vue',
    vue: {
      exposeFilename: true,
    },
  })
  expect(componentModule.__file).toBe('basic.vue')
})

test.skip('source map', async () => {
  const { code } = await bundle({
    entry: 'basic.vue',
    devtool: 'source-map',
  })
  const map = mfs.readFileSync('/test.build.js.map', 'utf-8')
  const smc = new SourceMapConsumer(JSON.parse(map as string))
  let line = 0
  let col = 0
  const targetRE = /^\s+msg: 'Hello from Component A!'/
  code.split(/\r?\n/g).some((l, i) => {
    if (targetRE.test(l)) {
      line = i + 1
      col = 0
      return true
    }
  })
  const pos = smc.originalPositionFor({
    line: line,
    column: col,
  })
  expect(pos.source.indexOf('basic.vue') > -1)
  expect(pos.line).toBe(9)
})

test('extract CSS', async () => {
  const { stats } = await bundle({
    entry: 'extract-css.vue',
    experiments: { css: true },
    modify: (config: any) => {
      config.module.rules = [
        {
          test: /\.vue$/,
          use: [
            {
              ...DEFAULT_VUE_USE,
              options: { experimentalInlineMatchResource: true },
            },
          ],
        },
        {
          test: /\.css$/,
          type: 'css',
        },
        {
          test: /\.stylus$/,
          type: 'css',
          use: ['stylus-loader'],
        },
      ]
    },
  })

  const cssAsset = Object.keys(stats.compilation.assets).find((asset) =>
    asset.endsWith('.css')
  )
  expect(cssAsset).toBeDefined()

  const css = normalizeNewline(mfs.readFileSync('/' + cssAsset).toString())
  const id = `data-v-${genId('extract-css.vue')}`
  expect(css).toContain(`h1 {\n  color: #f00;\n}`)
  // extract + scoped
  expect(css).toContain(`h2[${id}] {\n  color: green;\n}`)
})

// #1464
test('native CSS Modules', async () => {
  const { window } = await mockBundleAndRun({
    entry: './test/fixtures/duplicate-cssm.js',
    experiments: { css: true },
    modify: (config: any) => {
      config.module.rules = [
        {
          test: /\.vue$/,
          use: [
            {
              ...DEFAULT_VUE_USE,
              options: { experimentalInlineMatchResource: true },
            },
          ],
        },
        {
          test: /\.css$/,
          type: 'css/module',
          parser: {
            namedExports: true,
          },
        },
      ]
    },
  })

  expect(window.exports).toBeTruthy()
  expect(window.exports.color).toBe('red')
})

test('extract CSS with code spliting', async () => {
  const { stats } = await bundle({
    entry: 'extract-css-chunks.vue',
    experiments: { css: true },
    modify: (config: any) => {
      config.module.rules = [
        {
          test: /\.vue$/,
          use: [
            {
              ...DEFAULT_VUE_USE,
              options: { experimentalInlineMatchResource: true },
            },
          ],
        },
        {
          test: /\.css$/,
          type: 'css',
        },
      ]
    },
  })

  const cssAssets = Object.keys(stats.compilation.assets).filter((asset) =>
    asset.endsWith('.css')
  )
  expect(cssAssets.length).toBeGreaterThan(0)

  const css = cssAssets
    .map((asset) => normalizeNewline(mfs.readFileSync('/' + asset).toString()))
    .join('\n')
  expect(css).toContain(`h1 {\n  color: red;\n}`)
})

test('support rules with oneOf', async () => {
  const { window } = await mockBundleAndRun({
    entry: 'basic.vue',
    modify: (config: any) => {
      config!.module!.rules = [
        {
          test: /\.vue$/,
          use: [DEFAULT_VUE_USE],
        },
        {
          test: /\.css$/,
          oneOf: [
            {
              resourceQuery: /no-match/,
              type: 'css',
            },
            {
              type: 'css',
            },
          ],
        },
      ]
    },
  })

  const style = normalizeNewline(
    window.document.querySelector('style')!.textContent!
  )
  expect(style).toContain('comp-a h2 {\n  color: #f00;\n}')
})

test.todo('should work with eslint loader')

test.todo('multiple rule definitions')
