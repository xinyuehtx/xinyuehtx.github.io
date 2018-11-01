---
layout: post
title: "Why not Dispather.CurrentDispatcher"
date: 2018-11-1 17:25:26
date_modified: 2018-11-1 17:25:32
categories: windows wpf
tags: windows wpf
description: 
---

对于WPF程序，大家绕不开的一个概念叫做`Dispatcher`

-----

- 什么是`Dispathcer`

WPF程序启动后会有两个线程：UI线程和渲染线程。UI线程会将所有的任务切成小份，放入一个队列进行依次执行，而执行这些工作的`object`就是`Dispatcher`。对于WPF来说，常见的`Dispatcher`概念有三个`Application.Current.Dispatcher`,`Dispather.CurrentDispatcher`，`DispatcherObject.Dispatcher`

- 三者的区别

对于大部分的WPF类来说，它们都继承于`DispatcherObject`。而每个`DispatcherObject`都只能被创建它的`DispatcherObject`所操作。这种行为的实现方式就是，在每个`DispatcherObject`的操作之前，会调用`VerifyAccess`方法，检测当前线程的`Dispatcher`（即`Dispather.CurrentDispatcher`）和自身的`Dispatcher`（即`DispatcherObject.Dispatcher`）是否相同。若不相同则会抛出相应的异常。



所以可以从此了解到，`Dispather.CurrentDispatcher`是和当前线程相关的`Dispathcer`，而`DispatcherObject.Dispatcher`是创建这个对象的`Dispathcer`。



那么`Application.Current.Dispatcher`呢？`Application.Current`是一个单例模式，指向的是当前WPF进程的`Application`实例。而`Application`继承于`DispatcherObject`，所以`Application.Current.Dispatcher`是一个特殊的`DispatcherObject.Dispatcher`

- Why not Dispather.CurrentDispatcher

回到主题，为什么我们不推荐使用`Dispather.CurrentDispatcher`。

事实上，大家进程使用`Dispatcher`的场合是在后台线程更新UI内容。因为所有的UI线程创建的`DispatcherObject`对象只能在UI线程操作。因此需要“告诉”UI线程的`Dispatcher`去`Invoke`一个操作。而此时（后台线程中）UI线程中创建的`Application`和`DispatcherObject`的`Dispatcher`属性都指向UI线程的`Dispatcher`对象。而`Dispather.CurrentDispatcher`并不是。所以就会出现相应的错误。



参考链接：

- [Threading Model | Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/framework/wpf/advanced/threading-model#threading_overview)
- [Dispatcher Class (System.Windows.Threading) | Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.windows.threading.dispatcher?redirectedfrom=MSDN&view=netframework-4.7.2)
- [c# - WPF/threading: Dispatcher static vs Dispatcher on a control? - Stack Overflow](https://stackoverflow.com/questions/4620818/wpf-threading-dispatcher-static-vs-dispatcher-on-a-control)
- [Application Class (System.Windows) | Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.windows.application?view=netframework-4.7.2)





