---
layout: post
title: "关于git pull或fetch失败"
date: 2017-11-9 00:14:07 +0800
date_modified: 2017-11-9 09:00:45 +0800
categories: git
tags: git
description: 
---


git 出现错误error: cannot lock ref

-----
出现原因多样，简单说你的仓库远端和本地的ref出现差异

可能来自于另一个人在本地变基后，在远端使用了`git push -f   `  

低概率在本地分支有提交的情况下，在vs工程目录`git pull`时出现



解决方式，粗暴点`git pull -p`强拉远端