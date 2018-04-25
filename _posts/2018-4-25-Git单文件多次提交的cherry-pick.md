---
layout: post
title: "Git单文件多次提交的cherry-pick"
date: 2018-4-25 16:00:50 +0800
date_modified: 2018-4-25 16:00:57 +0800
categories: windows VisualStudio Git
tags: VisualStudio Git cherry-pick
description: 
---

曾几何时，你发现你做的项目经常有甲方爸爸需要xxx定制版

-----

“一堆定制版，你让我们怎么维护。我们是有骨气的程序员，安能摧眉折腰事权贵。”

“这个项目据说有2000万”

“明天给你验收包”

于是你的仓库里面就充满了各式各样的定制版分支。从此一个新功能要和n多个分支。

### 那么问题来了

你的定制版分支`custom`中测出了一个bug，而这个bug你在`master`分支已经修改了.

但是这个修改涉及了好几个`commit`和`mergeRequest`。cherry-pick可能会引入一些不必要的修改。

**如果这个bug只影响了你的某一个文件**（假设为`Sample.cs`）那么我们可以用下面这个命令来解救

`git rev-list [-num] --reverse master -- Sample.cs | git cherry-pick --stdin`

这个是一个管道命令，实际上执行了2条git命令

我们看第一条

`git rev-list [-num] --reverse master -- Sample.cs `

他是说将`Sample.cs`在`master`上的相关提交，选取最近的（num）个提交，

`| git cherry-pick --stdin`

说的是从标准输入设备中读取上一条命名输出的git提交号，进行`cherry-pick`

这样所有需要的提交就cherry-pick过来了



