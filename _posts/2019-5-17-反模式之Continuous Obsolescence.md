---
layout: post
title: "2019-5-17-反模式之Continuous Obsolescence"
date: 2019-5-17 15:14:12
date_modified: 2019-5-17 15:14:17
categories: code 反模式
tags: code 反模式
description: 
---



-----



# Continuous Obsolescence

## 介绍

Obsolescence是过时，弃用的意思。Continuous Obsolescence来自于软件技术的持续更新。有人说技术持续更新不是很好的事情么？但是持续更新的技术不兼容，就是一个大问题了。你辛辛苦苦写了一大波代码，在发布时软件的SDK进行了更新，你调用的API被弃用了。你会不会想要拿刀去砍人呀？

## 产生原因

Continuous Obsolescence产生的原因主要可以从2方面来看，一方面技术革新的需要；另一方面是原有架构存在的缺陷，导致无法支撑新特性。

## 修复建议

实际上Continuous Obsolescence拥有一个很简单的解决方案，就是通过协议或者接口，保持API的兼容。微软在经历了多次技术栈更迭之后，下定决心使用的.NET Standard就是一套.NET 技术栈的协议。他确保了之后所有的.NET 实现的更新都会对旧版本的API兼容。安卓也是一个例子，所有在安卓4.0开发的软件，在安卓5.0版本的设备上仍然可以使用。

这样就避免了持续更新导致的软件弃用

参考链接：

- [反面模式 - 维基百科，自由的百科全书](https://zh.wikipedia.org/wiki/%E5%8F%8D%E9%9D%A2%E6%A8%A1%E5%BC%8F)
- [AntiPatterns](https://sourcemaking.com/antipatterns)







