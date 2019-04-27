---
layout: post
title: "2019-3-20-grid是怎么计算布局的"
date: 2019-3-20 14:32:55
date_modified: 2019-3-20 14:33:01
categories: windows wpf C#
tags: windows wpf C#
description: 
published: false
---

Grid是我们使用最多的一个WPF容器，可是它的实际布局方式却并没有这么简单。

比较遗憾的是我没有在里面找到`Task.Yield`的合适的应用场景。关于`Task.Yield`的应用场景也是争论纷纷，可见这个东西必然很鸡肋。本文尝试了`Task.Yield`的几种使用场景，看看是否能够将代码变得更加优雅。

坐在MVP旁边狗尾续貂，诚惶诚恐。。

-----

如果你还不知道Grid有什么样神奇的用法，可以先看看毅仔的[WPF/UWP 的 Grid 布局竟然有 Bug，还不止一个！了解 Grid 中那些未定义的布局规则 - walterlv](https://blog.walterlv.com/post/the-bugs-of-grid.html)，刷新一下WPF观

### FrameworkElement布局

FrameworkElement的布局分为2部`MeasureOverride`和`ArrangeOverride`。

`MearsureOverride`用于测量所有元素需要多少空间，而`ArrangeOverride`则是确定这些元素应该怎么摆放

`MearsureOverride`的过程是一个深度优先的遍历过程。在一定的可用空间下，父元素根据自身的布局规则，向其子元素传入指定大小的可用空间，获得子元素的测量尺寸后，将其结合其布局规则，返回自身的测量尺寸。

*所以想要获得 一个元素的测量尺寸，必须向测量子元素的尺寸*

此外还需要注意的是FrameworkElement定义了对齐方式`HorizontalAlignment`和`VerticalAlignment`

如果他们的值是`Stretch`，在布局时，会使用`slot size`而不是自己`MeasureOverride`获得的`DesiredSize`

### Grid布局

那么Grid是如何布局的呢？

布局Grid关键是如何获取各个GridCell的尺寸

对于Grid，它的行宽和列高可以设置3种值：绝对值，Auto和*

绝对值就是直接按数值传入可用空间的约束，

Auto是指以现有约束传入,按照子元素大小布局

*是指以剩余空间按\*等分作为约束传入



参考链接：

- [WPF/UWP 的 Grid 布局竟然有 Bug，还不止一个！了解 Grid 中那些未定义的布局规则 - walterlv](https://blog.walterlv.com/post/the-bugs-of-grid.html)
- [Grid 布局算法！自己动手实现一个 Grid - walterlv](https://blog.walterlv.com/post/grid-layout-algorithm.html)
- [Grid](https://referencesource.microsoft.com/#PresentationFramework/src/Framework/System/Windows/Controls/Grid.cs,f9ce1d6be154348a)
- 







