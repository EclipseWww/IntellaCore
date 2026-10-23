module.exports = {
  devServer: {
    hot: false,
    client: {
      webSocketURL: false
    }
  },
  ignoreWarnings: [
    {
      module: /node_modules\/@antv\/util/,
      message: /Failed to parse source map/,
    },
    // 忽略所有源码映射解析失败的警告
    {
      message: /Failed to parse source map/,
    }
  ]
};
