const HtmlWebpackPlugin = require("html-webpack-plugin");
const globImporter = require('node-sass-glob-importer');
const extract = require("mini-css-extract-plugin");
const path = require("path");

module.exports = {
  module: {
    rules: [
      {
        test:/\.(sa|sc|c)ss$/,
        use: [extract.loader, "css-loader", {loader: "sass-loader", options: {sassOptions: {importer: globImporter()}}}]
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ["babel-loader"]
      },
      {
      	test: /\.(png|jpe?g|gif|svg|ttf|ico)$/,
  	  	use: [{
  	      //using file-loader
  	      loader: 'file-loader',
  	      options: {
  	        outputPath: "assets"
  	      }
  	    }],
      },
    ]
  },
  optimization: {
    splitChunks: { chunks: "all" }
  },
  plugins: [
    new extract({
        filename: 'style.css'
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src", "index.html"),
      favicon: "./src/assets/icons/favicon.ico"
    })
  ],
  output: {
  },
  devServer: {
    contentBase: "./src",
  },
  devtool: 'source-map'
};