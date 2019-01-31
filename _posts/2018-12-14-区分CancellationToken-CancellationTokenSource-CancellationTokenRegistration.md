---
layout: post
title: "2018-12-14-区分CancellationToken-CancellationTokenSource-CancellationTokenRegistration"
date: 2018-12-14 17:21:39
date_modified: 2018-12-14 17:21:42
categories: windows wpf C#
tags: windows wpf C#
description: 
---

发现一些小伙伴的代码中`CancellationToken`-`CancellationTokenSource`-`CancellationTokenRegistration`傻傻分不清楚，今天就对这三个类的使用进行下区分。

-----

```c#
var source = new  CancellationTokenSource();
DoAsync(source);

...
    
public async void DoAsync(CancellationTokenSource source)
{
    if(!source.IsCancellationRequested)
    {
        //do something
    }
}
```

一些小伙伴经常会在一些耗时操作里面添加如上所示的取消判定代码。

然而这种写法实际是不推荐的。

对比下微软官方程序集提供的取消API，要求的参数都是`CancellationToken`

实际上`CancellationTokenSource`翻译过来就是`用作取消的Token(代币)源`，而`CancellationToken`则是那个用于取消的代币。

执行任务前，`CancellationTokenSource`将自己的Token（`CancellationToken`）分发给各个任务。

当用户需要进行取消操作时，只要调用`CancellationTokenSource`的Cancel方法，就可以在Token中触发取消操作（具体按照业务写法，可以有异常，轮训状态，注册回调等等）

实际上更推荐的写法应该是

```c#
using(var source = new  CancellationTokenSource())
{
    DoAsync(source.Token);
}


...
    
public async void DoAsync(CancellationToken token)
{
    if(!token.IsCancellationRequested)
    {
        //do something
    }
}
```

这样取消的控制权就不会交到底层业务

划重点，`CancellationTokenSource`是`IDisposable`的

那么`CancellationTokenRegistration `是什么呢？

他是`CancellationToken`的回调注册方法的返回值

```C#
using (CancellationTokenRegistration ctr = token.Register(() => //do cancel))
{
      //do something
}
```

划重点，`CancellationTokenRegistration` 是`IDisposable`的

当调用其Dispose方法时，注册的回调事件将会被释放，从而避免了内存泄漏

参考链接：

- [CancellationTokenSource Class (System.Threading) - Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.threading.cancellationtokensource?view=netframework-4.7.2)
- [CancellationTokenRegistration Struct (System.Threading) - Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.threading.cancellationtokenregistration?view=netframework-4.7.2)
- [CancellationToken Struct (System.Threading) - Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.threading.cancellationtoken?view=netframework-4.7.2)







