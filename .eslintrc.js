module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    debugLevel: true,
    project: './tsconfig.json',
    sourceType: 'module',
  },
  globals: {
    __DEV__: 'readonly',
    window: true,
  },
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  ignorePatterns: [
    'gulpfile.js',
    'src/utils/hack.js',
    'rn-cli.config.js',
    'scripts',
    '.eslintrc.js',
    'src/.tpl',
    'babel.config.js',
  ],
  extends: [
    'plugin:promise/recommended',
    'plugin:react/recommended',
    '@react-native-community',
    'plugin:@typescript-eslint/recommended',
    // airbnb是很严格的配置, 在此基础上适当放宽限制
    'airbnb-typescript',
    'prettier',
    'prettier/@typescript-eslint',
    'prettier/react',
  ],
  settings: {
    'import/resolver': {
      node: {
        paths: ['.'],
      },
    },
  },
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: false,
        optionalDependencies: false,
        peerDependencies: false,
        // 这里如果不设定, 会报错
        packageDir: './',
      },
    ],
    'promise/catch-or-return': ['error', { terminationMethod: ['catch', 'finally'] }],
    // 这里的{}用来表示空的structure, 如果禁掉, 无法表现出框架要表现的, 这里需要一个Data Structure但是需要使用框架的人去填
    '@typescript-eslint/ban-types': [
      'error',
      {
        types: {
          '{}': false,
        },
        extendDefaults: true,
      },
    ],
    // 对于动态的property, 这样语义上不对
    'eslint/dot-notation': 'off',
    '@typescript-eslint/dot-notation': 'off',
    'react-native/no-unused-styles': 'warn',
    // 框架代码有用到, 比如需要对Class声明框架提供的接口时
    '@typescript-eslint/no-empty-interface': 'off',
    // 不知道什么地方把这个禁掉了, 这个应该要处理
    '@typescript-eslint/no-floating-promises': ['error'],
    // 对于ReactNative的Platform Specific(.ios.ts/.android.ts)没办法支持
    'import/extensions': 'off',
    // 貌似判断有问题类似这种也会报错 navigator && (AppNavigator.navigator = navigator)
    '@typescript-eslint/no-unused-expressions': 'off',
    // 虽然spread不是一个好的Pattern, 但是在框架代码还是经常用, 并且有TypeCheck帮忙提示是否有错误
    'react/jsx-props-no-spreading': 'off',
    // 对于类型丰富的返回值, 无法容易的显式的声明返回类型, 另外TypeScript的编译时提示已经可以发现所有的问题了
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // state在class initializer使用也是常见的pattern, 没必要强制
    'react/state-in-constructor': 'off',
    // 这个有点强制了, 对于快速的找到信息console还是方便的, 可以在release模式下用hack的方式把console.log禁用
    'no-console': 'off',
    // const {destruction} = this.props 有利于命名的统一性, 但是对于快速代码提示还是this.props方便,
    // 对于少量的props, 可以使用this.props而不是强制用destruction
    'react/destructuring-assignment': 'off',
    'prefer-destructuring': 'off',
    // 这也有点Aggressive了, 在instance的方法里面调用instance的helper method也是一种consistant的习惯,没必要强制改成static的
    'class-methods-use-this': 'off',
    // 语法可以保证正确, 有时候可以把相关代码放到一起提高代码阅读的流畅性
    'react/sort-comp': 'off',
    // 语法可以保证正确, 有时候可以把不是很重要的代码放到后面不影响代码阅读的流畅性
    '@typescript-eslint/no-use-before-define': 'off',
    // 在框架代码或者跟网络请求有关的地方经常用到any, 这里Rule太Aggressive了
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    // typescript-eslint/indent这个Rule实现有bug
    '@typescript-eslint/indent': 'off',
    // 试了一下 after好像有问题, 还是禁用掉吧, 推荐使用after, 因为对于去掉尾部的分号的情况下, 在运算符后面换行会更安全
    'operator-linebreak': 'off',
    // 一般情况下去掉尾部的分号
    '@typescript-eslint/semi': ['warn', 'never'],
    // 编译器会提示忘记逗号的情况, 所以不需要如此严格
    'comma-dangle': 'off',
    // 跟代码统一适用单引号
    'jsx-quotes': ['warn', 'prefer-single'],
    // 放宽限制, 不需要如此严格
    'arrow-parens': ['warn', 'as-needed'],
    // if return的话else 不一定需要去掉, 当分支的权重一样的话, else逻辑更清晰
    'no-else-return': 'off',
    // 对于简单的拼接, 用+号其实更方便
    'prefer-template': 'off',
    // 算法类的用的比较多
    'no-bitwise': 'off',
    // TODO: 好的Practice是不要在Reject里面放入条件判断信息, 条件判断应该放在Resolve结果里面, Reject只用来传错误信息.
    // 不然如果Promise里面抛出别的错误, 在处理Reject的时候还要判断抛出错误的类型, 不然会引起运行时错误
    // 等重写差不多之后再开启
    'prefer-promise-reject-errors': 'off',
    '@typescript-eslint/no-throw-literal': 'off',
    // TODO: 循环依赖的确是个问题, 要尽量避免, 有空之后开启
    'import/no-cycle': 'off',
    // FIXME: 改回来
    'react/no-string-refs': 'off',
    // 第三方的Component无法保证是PureComponent
    'react/prefer-stateless-function': 'off',
    // TODO: 暂时放宽限制
    'promise/no-promise-in-callback': 'off',
    // 以下的rule都不影响代码逻辑, 放宽限制
    'react/require-default-props': 'off',
    'no-lonely-if': 'off',
    'promise/no-callback-in-promise': 'off',
    'react/static-property-placement': 'off',
    'eslint-comments/no-unlimited-disable': 'off',
    'promise/always-return': 'off',
    'promise/no-nesting': 'off',
    'react/no-array-index-key': 'off',
    'react-native/no-inline-styles': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    'no-param-reassign': 'off',
    '@typescript-eslint/typescript-eslint': 'off',
    'symbol-description': 'off',
    'no-nested-ternary': 'off',
    'import/export': 'off',
    'linebreak-style': 'off',
    'max-classes-per-file': 'off',
    'lines-between-class-members': 'off',
    '@typescript-eslint/lines-between-class-members': 'off',
    'global-require': 'off',
    'import/newline-after-import': 'off',
    'import/prefer-default-export': 'off',
    'object-curly-newline': 'off',
    'max-len': 'off',
    'react/jsx-one-expression-per-line': 'off',
    'no-underscore-dangle': 'off',
    '@typescript-eslint/naming-convention': 'off',
    'no-plusplus': 'off',
    'no-continue': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'no-restricted-globals': 'off',
    'react/prop-types': 'off',
    'no-redeclare': 'off',
    // note you must disable the base rule as it can report incorrect errors
    // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/no-shadow.md
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['error'],
  },
}
