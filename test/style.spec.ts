import cssesc from 'cssesc'
import {
  mockBundleAndRun,
  genId,
  normalizeNewline,
  DEFAULT_VUE_USE,
} from './utils'

test('scoped style', async () => {
  const { window, instance, componentModule } = await mockBundleAndRun({
    entry: 'scoped-css.vue',
  })

  const shortId = genId('scoped-css.vue')
  const scopeId = 'data-v-' + shortId
  expect(componentModule.__scopeId).toBe(scopeId)

  // <div>
  //   <div><h1>hi</h1></div>
  //   <p class="abc def">hi</p>
  //   <template v-if="ok"><p class="test">yo</p></template>
  //   <svg><template><p></p></template></svg>
  // </div>
  expect(instance.$el.children[0].tagName).toBe('DIV')
  expect(instance.$el.children[1].tagName).toBe('P')
  expect(instance.$el.children[1].className).toBe('abc def')
  expect(instance.$el.children[2].tagName).toBe('P')
  expect(instance.$el.children[2].className).toBe('test')

  const style = normalizeNewline(
    window.document.querySelector('style')!.textContent!
  )

  expect(style).toContain(`.test[${scopeId}] {\n  color: yellow;\n}`)
  expect(style).toContain(`.test[${scopeId}]:after {\n  content: \'bye!\';\n}`)
  expect(style).toContain(`h1[${scopeId}] {\n  color: green;\n}`)
  // scoped keyframes
  // note: vue 3 uses short ids for keyframes
  // see https://github.com/vuejs/vue-next/commit/5f271515cf17e541a2a085d23854dac7e45e074e
  expect(style).toContain(
    `.anim[${scopeId}] {\n  animation: color-${shortId} 5s infinite, other 5s;`
  )
  expect(style).toContain(
    `.anim-2[${scopeId}] {\n  animation-name: color-${shortId}`
  )
  expect(style).toContain(
    `.anim-3[${scopeId}] {\n  animation: 5s color-${shortId} infinite, 5s other;`
  )
  expect(style).toContain(`@keyframes color-${shortId} {`)
  expect(style).toContain(`@-webkit-keyframes color-${shortId} {`)

  expect(style).toContain(
    `.anim-multiple[${scopeId}] {\n  animation: color-${shortId} 5s infinite,opacity-${shortId} 2s;`
  )
  expect(style).toContain(
    `.anim-multiple-2[${scopeId}] {\n  animation-name: color-${shortId},opacity-${shortId};`
  )
  expect(style).toContain(`@keyframes opacity-${shortId} {`)
  expect(style).toContain(`@-webkit-keyframes opacity-${shortId} {`)
  // >>> combinator
  expect(style).toContain(`.foo p[${scopeId}] .bar {\n  color: red;\n}`)
})

test('postcss', async () => {
  const { window } = await mockBundleAndRun({
    entry: 'postcss.vue',
    module: {
      rules: [
        {
          test: /\.postcss$/,
          type: 'css',
          use: [
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  parser: require('sugarss'),
                },
              },
            },
          ],
        },
      ],
    },
  })

  const id = 'data-v-' + genId('postcss.vue')
  const style = normalizeNewline(
    window.document.querySelector('style')!.textContent!
  )
  expect(style).toContain(`h1[${id}] {\n  color: red;\n  font-size: 14px\n}`)
})

test('CSS Modules', async () => {
  const testWithIdent = async (
    localIdentName: string | undefined,
    regexToMatch: RegExp
  ) => {
    const { window, instance } = await mockBundleAndRun({
      entry: 'css-modules-simple.vue',
      experiments: { css: true },
      modify: (config: any) => {
        config.module.rules = [
          { test: /\.vue$/, use: [DEFAULT_VUE_USE] },
          {
            test: /\.css$/,
            type: 'css/module',
            generator: localIdentName ? { localIdentName } : undefined,
          },
        ]
      },
    })

    const className = instance.$style.red
    expect(className).toMatch(regexToMatch)

    const escapedClassName = cssesc(className, { isIdentifier: true })
    let style = normalizeNewline(
      [].slice
        .call(window.document.querySelectorAll('style'))
        .map((style: any) => style.textContent)
        .join('\n')
    )
    expect(style).toContain('.' + escapedClassName + ' {\n  color: red;\n}')

    const match = style.match(/@keyframes\s+(\S+)\s+{/)
    expect(match).toHaveLength(2)
    expect(match![1]).not.toBe('fade')
    expect(style).toContain('animation: ' + match![1] + ' 1s;')
  }

  await testWithIdent(undefined, /^vue-loader.*-red$/)
  await testWithIdent(
    '[path][name]---[local]---[hash:base64:5]',
    /css-modules-simple\.vue---red---\w{5}/
  )
})

test('CSS Modules namedExport', async () => {
  const testWithIdent = async (
    localIdentName: string | undefined,
    regexToMatch: RegExp
  ) => {
    const { window, instance } = await mockBundleAndRun({
      entry: 'css-modules-simple.vue',
      experiments: { css: true },
      modify: (config: any) => {
        config.module.rules = [
          { test: /\.vue$/, use: [DEFAULT_VUE_USE] },
          {
            test: /\.css$/,
            type: 'css/module',
            parser: { namedExports: true },
            generator: localIdentName ? { localIdentName } : undefined,
          },
        ]
      },
    })

    const className = instance.$style.red
    expect(className).toMatch(regexToMatch)

    const style = normalizeNewline(
      [].slice
        .call(window.document.querySelectorAll('style'))
        .map((style: any) => style.textContent)
        .join('\n')
    )
    const escapedClassName = cssesc(className, { isIdentifier: true })
    expect(style).toContain('.' + escapedClassName + ' {\n  color: red;\n}')

    const match = style.match(/@keyframes\s+(\S+)\s+{/)
    expect(match).toHaveLength(2)
    expect(match![1]).not.toBe('fade')
    expect(style).toContain('animation: ' + match![1] + ' 1s;')
  }

  await testWithIdent(undefined, /^vue-loader.*-red$/)
  await testWithIdent(
    '[path][name]---[local]---[hash:base64:5]',
    /css-modules-simple\.vue---red---\w{5}/
  )
})

test('CSS Modules Extend', async () => {
  const { window, instance } = await mockBundleAndRun({
    entry: 'css-modules-extend.vue',
    experiments: { css: true },
    modify: (config: any) => {
      config.module.rules = [
        { test: /\.vue$/, use: [DEFAULT_VUE_USE] },
        { test: /\.css$/, type: 'css/module' },
      ]
    },
  })

  expect(instance.$el.className).toBe(instance.$style.red)
  const escapedClassName = cssesc(instance.$style.red, { isIdentifier: true })
  const styles = [].slice.call(window.document.querySelectorAll('style'))
  expect(styles.some((style: any) =>
    normalizeNewline(style.textContent).includes(`.${escapedClassName}`)
  )).toBe(true)
})

test('v-bind() in CSS', async () => {
  const { window, instance, code } = await mockBundleAndRun({
    entry: 'style-v-bind.vue',
  })

  const shortId = genId('style-v-bind.vue')
  const style = normalizeNewline(
    window.document.querySelector('style')!.textContent!
  )

  expect(style).toMatch(`color: var(--${shortId}-color);`)
  expect(style).toMatch(`font-size: var(--${shortId}-font\\.size);`)

  const computedStyle = window.getComputedStyle(instance.$el)
  // Because the tests run in JSDOM, we can't directly get the computed `color` value.
  // To get around this, we test the corresponding CSS variable instead.
  expect(computedStyle.getPropertyValue(`--${shortId}-color`)).toBe('red')
  expect(computedStyle.getPropertyValue(`--${shortId}-font.size`)).toBe('2em')
})
