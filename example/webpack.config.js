const path = require('path')
const webpack = require('webpack')
const VueLoaderPlugin = require('../dist/plugin').default

module.exports = (env = {}) => {
  const isProd = env.prod
  const isSSR = env.ssr

  /**
   * Some notes regarding config for the server build of an SSR app:
   * 1. target: 'node'
   * 2. output.libraryTarget: 'commonjs' (so the exported app can be required)
   * 3. externals: this is mostly for faster builds.
   *    - externalize @vue/* deps via commonjs require()
   *    - externalize client side deps that are never used on the server, e.g.
   *      ones that are only used in onMounted() to empty modules
   */
  const genConfig = (isServerBuild = false) => {
    const minimize = isProd && !isServerBuild && !env.noMinimize

    return {
      mode: isProd ? 'production' : 'development',
      entry: isServerBuild
        ? path.resolve(__dirname, './main.js')
        : path.resolve(__dirname, './index.html'),
      target: isServerBuild ? 'node' : 'web',
      devtool: 'source-map',
      resolve: {
        extensions: ['.js', '.ts'],
      },
      output: {
        path: path.resolve(
          __dirname,
          isSSR ? (isServerBuild ? 'dist-ssr/server' : 'dist-ssr/dist') : 'dist'
        ),
        filename: '[name].js',
        publicPath: '/dist/',
        cssFilename: '[name].css',
        libraryTarget: isServerBuild ? 'commonjs' : undefined,
      },
      externals: isServerBuild
        ? [
            (ctx, request, cb) => {
              if (/^@vue/.test(request)) {
                return cb(null, 'commonjs ' + request)
              }
              cb()
            },
          ]
        : undefined,
      module: {
        rules: [
          {
            test: /\.vue$/,
            loader: 'vue-loader',
            options: {
              experimentalInlineMatchResource: true,
              // reactivityTransform: true,
              compilerOptions: {
                isCustomElement: (tag) => tag.startsWith('custom-'),
              },
            },
          },
          {
            test: /\.png$/,
            type: 'asset/resource',
          },
          {
            test: /\.css$/,
            type: 'css',
          },
          {
            test: /\.ts$/,
            use: [
              {
                loader: require.resolve('ts-loader'),
                options: {
                  transpileOnly: true,
                  appendTsSuffixTo: [/\.vue$/],
                },
              },
            ],
          },
          // target <docs> custom blocks
          {
            resourceQuery: /blockType=docs/,
            loader: require.resolve('./docs-loader'),
          },
        ],
      },
      plugins: [
        new VueLoaderPlugin(),
        new webpack.DefinePlugin({
          __IS_SSR__: !!isSSR,
          __VUE_OPTIONS_API__: true,
          __VUE_PROD_DEVTOOLS__: false,
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        }),
      ],
      optimization: {
        minimize,
      },
      experiments: {
        css: true,
        html: true,
      },
      devServer: {
        hot: true,
        stats: 'minimal',
        static: {
          directory: __dirname,
        },
        client: {
          overlay: true,
        },
      },
      resolveLoader: {
        alias: {
          'vue-loader': require.resolve('../'),
        },
      },
    }
  }

  if (!isSSR) {
    return genConfig()
  } else {
    return [genConfig(), genConfig(true)]
  }
}
