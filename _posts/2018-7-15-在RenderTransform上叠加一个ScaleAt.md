---
layout: post
title: "在RenderTransform上叠加一个ScaleAt"
date: 2018-7-15 20:55:49
date_modified: 2018-7-15 20:55:55
categories: windows VisualStudio Wpf
tags: wpf transform
description: 
---

试着想有这么一个场景，当你滚动滚轮时，图像会以你的鼠标中心为缩放中心进行缩放

-----

代码很简单，就是在缩放时，获取鼠标对元素的相对坐标，调用`ScaleAt`,然后添加到它现有的`RenderTransform`中

```csharp
var position = e.GetPosition(TestGrid);
var scale = 1 + e.Delta / (double)Math.Abs(e.Delta) * 0.1;     
var matrix = TestGrid.RenderTransform.Value;
matrix.ScaleAt(scale, scale, position.X, position.Y);
TestGrid.RenderTransform = new MatrixTransform(matrix);
```

然而结果却出现了偏差，除了开始的几次正常之外，后续的行为都不正常。

意外的，只要将`matrix.ScaleAt(scale, scale, position.X, position.Y);`改为

`matrix.ScaleAtPrepend(scale, scale, position.X, position.Y);`就能正常使用。

我们都知道`ScaleAtPrepend`意味着矩阵左乘。

那为什么**叠加**不是右乘而是左乘呢？

再仔细看实际上，错误原因出在`ScaleAtPrepend`和`ScaleAt`都是以`RenderTransform`之前的位置坐标进行的缩放，而我们期望的`GetPosition(TestGrid)`却是以`RenderTransform`之后的坐标。

了解了原因，我们只需要将`position`乘以现有的矩阵就可以了

```csharp
var position = e.GetPosition(TestGrid);
var scale = 1 + e.Delta / (double)Math.Abs(e.Delta) * 0.1;     
var matrix = TestGrid.RenderTransform.Value;
var position2 = position * matrix;
matrix.ScaleAt(scale, scale, position2.X, position2.Y);
TestGrid.RenderTransform = new MatrixTransform(matrix);
```

现在也符合期望了。

但是我们还有一个问题，为什么以原来"错误"的坐标进行左乘也能得到正确的结果呢？

我做一个推导，假设$M$为原有的变化矩阵，$P_0$为变化前的点，$P_1$为变化后的点，

那么有$P_1=P_0M$

令$S_{p_0}$表示以$P_0$为中心的缩放矩阵，$S_{p_1}$表示以$P_1$为中心的缩放矩阵

那么对于任意点$P_n$

有$\begin{array}{lr} P_nMS_{P_1}=(P_nM+P_1)S-P_1\\=(P_nM+P_0M)S-P_0M\\=((P_n+P_0)S-P_0)M\\=P_nS_{P_0}M\end{array} $

得证两种方式的结果是一致的。



参考项目仓库 https://github.com/xinyuehtx/ScaleWithPointer