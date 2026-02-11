const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const { InjectManifest } = require("workbox-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

const isProd = process.env.NODE_ENV === "production";

module.exports = {
  mode: isProd ? "production" : "development",
  entry: "./src/main.jsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: isProd ? "assets/[name].[contenthash:8].js" : "assets/[name].js",
    publicPath: "/",
    clean: false,
  },
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
    // package.json has "type": "module"; disable webpack's strict extension
    // enforcement so extensionless imports (e.g. './store') keep working.
    fullySpecified: false,
  },
  module: {
    rules: [
      {
        test: /\.m?js/,
        resolve: { fullySpecified: false },
      },
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              ["@babel/preset-env", { targets: "defaults, not ie 11" }],
              ["@babel/preset-react", { runtime: "automatic" }],
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico|webp)$/,
        type: "asset/resource",
        generator: {
          filename: "assets/[name].[hash:8][ext]",
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      favicon: "./public/vite.svg",
    }),
    new webpack.DefinePlugin({
      "process.env.REACT_APP_PARSE_URL": JSON.stringify(
        process.env.REACT_APP_PARSE_URL || (isProd ? "/parse" : "")
      ),
      "process.env.REACT_APP_PARSE_APP_ID": JSON.stringify(
        process.env.REACT_APP_PARSE_APP_ID || ""
      ),
      "process.env.REACT_APP_PARSE_REST_API_KEY": JSON.stringify(
        process.env.REACT_APP_PARSE_REST_API_KEY || ""
      ),
      "process.env.REACT_APP_PARSE_LIVEQUERY_URL": JSON.stringify(
        process.env.REACT_APP_PARSE_LIVEQUERY_URL || ""
      ),
      "process.env.REACT_APP_PROJECT_TOKEN": JSON.stringify(
        process.env.REACT_APP_PROJECT_TOKEN || ""
      ),
    }),
    new CopyPlugin({
      patterns: [
        {
          from: "public",
          to: ".",
          globOptions: { ignore: ["**/index.html"] },
        },
      ],
    }),
    ...(isProd
      ? [
          new InjectManifest({
            swSrc: "./src/sw.js",
            swDest: "sw.js",
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          }),
        ]
      : []),
  ],
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    proxy: [
      {
        context: ["/parse"],
        target: "http://localhost:1337",
        changeOrigin: true,
      },
    ],
  },
  devtool: isProd ? "source-map" : "eval-source-map",
};
