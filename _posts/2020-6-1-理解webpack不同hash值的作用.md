---
layout: post
title: "2020-6-1-理解webpack的hash，contenthash，chunkhash"
date: 2020-6-1 08:47:10
date_modified: 2020-6-1 08:47:15
categories: webpack 前端
tags: webpack 前端
description:
---

今天和大家聊一聊webpack中不同hash值的作用。

-----

## 问题来源

对于浏览器来说，一方面期望每次请求页面资源时，获得的都是最新的资源；一方面期望在资源没有发生变化时，能够复用缓存对象。

这个时候，使用文件名+文件哈希值的方式，就可以实现只要通过文件名，就可以区分资源是否有更新。

而webpack就内置了hash计算方法，对生成文件的可以在输出文件中添加hash字段。

## 区分hash，contenthash，chunkhash

webpack内置的hash有三种：

- hash：每次构建会生成一个hash。和整个项目有关，只要有项目文件更改，就会改变hash
- contenthash：和单个文件的内容相关。指定文件的内容发生改变，就会改变hash。
- chunkhash：和webpack打包生成的chunk相关。每一个entry，都会有不同的hash。

那么我们该怎么使用这些不同的hash值呢？

### chunkhash用法

一般来说，针对于输出文件，我们使用chunkhash。

因为webpack打包后，最终每个entry文件及其依赖会生成单独的一个js文件。

此时使用chunkhash，能够保证整个打包内容的更新准确性。

### contenthash用法

对于css文件来说，一般会使用MiniCssExtractPlugin将其抽取为一个单独的css文件。

此时可以使用contenthash进行标记，确保css文件内容变化时，可以更新hash。

### hash用法

一般来说，没有什么机会直接使用hash。

hash会更据每次工程的内容进行计算，很容易造成不必要的hash变更，不利于版本管理。

## file-loader的hash

可能有同学会表示有以下疑问。

明明经常看到在处理一些图片，字体的file-loader的打包时，使用的是[name]_[hash:8].[ext]

但是如果改了其他工程文件，比如index.js，生成的图片hash并没有变化。

这里需要注意的是，file-loader的hash字段，这个loader自己定义的占位符，和webpack的内置hash字段并不一致。

这里的hash是使用md4等hash算法，对文件内容进行hash。

所以只要文件内容不变，hash还是会保持一致。

---

参考文档：

-  [Hash vs chunkhash vs ContentHash - John Doe - Medium](https://medium.com/@sahilkkrazy/hash-vs-chunkhash-vs-contenthash-e94d38a32208)
-  [Webpack 4: hash and contenthash and chunkhash, when to use which? - Stack Overflow](https://stackoverflow.com/questions/59194365/webpack-4-hash-and-contenthash-and-chunkhash-when-to-use-which)
-  [javascript - What is the purpose of webpack [hash] and [chunkhash]? - Stack Overflow](https://stackoverflow.com/questions/35176489/what-is-the-purpose-of-webpack-hash-and-chunkhash)
-  [Caching - webpack](https://webpack.js.org/guides/caching/)
-  [file-loader -  webpack](https://webpack.js.org/loaders/file-loader/#hash)
-  [MiniCssExtractPlugin | webpack](https://webpack.js.org/plugins/mini-css-extract-plugin/)

