---
layout: post
title: "如何将文字转换为对应的PathGeometry"
date: 2018-7-5 16:39:02 +0800
date_modified: 2018-7-5 16:39:07 +0800
categories: windows VisualStudio Git
tags: VisualStudio Git cherry-pick
description: 
---

有些时候你期望用Path画出一些文本的形状

-----

比如说你会期望做出如下效果

![Text with image brush applied to stroke](../media/IC34839.jpeg) 

什么让UI给个图？

恩，有道理，可惜我不是UI，我不会咋办呢？

其实我们可以使用`FormattedText`的`BuildGeometry`将字符串转成对应的`Geometry`

首先我们要构造一个`FormattedText`对象

![1530780542113](../media/1530780542113.png)

例子中的参数分别为：要渲染的字符串，CultureInfo，文字布局方向，字体信息，字号，Brush，以及`PixelsPerDip`就是每个WPF单位代表的像素值

当然还有其他构造方法，可以自主调整

接下来调用`BuildGeometry`方法，该方法会传入一个起始位置

![1530780893236](../media/1530780893236.png)

这样就可以得到对应的`Geometry`了

此外，还可以通过下面这个方法从`Geometry`获得对应的`Path`

![1530781102178](../media/1530781102178.png)

最后的效果如下：

![1530781156403](../media/1530781156403.png)

附录：仓库地址：https://github.com/xinyuehtx/TextGeometry

参考链接：https://msdn.microsoft.com/en-us/library/system.windows.media.formattedtext.buildgeometry(v=vs.110).aspx