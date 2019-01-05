---
layout: post
title: "2019-1-2-使用AggregateException的Handle过滤指定异常"
date: 2019-1-5 16:22:09
date_modified: 2019-1-5 16:22:16
categories: windows wpf C#
tags: windows wpf C#
description: 
---

在一些并行操作或者任务列表执行的过程中，会需要用到`AggregateException`进行聚合异常的处理

-----

由于是聚合异常，他可能包含许多不同类型的内部异常。

很可能其中的一部分是我们预期的，期望是被`Handle`。但是另一部分我们却期望将其重新抛出

对于这种需求有一种简单的解决方案`AggregateException`的`Handle`方法

```C#
	public async void Foo()
   {
      try {
          await Task.Run( () => { throw new CustomException("This exception is expected!"); } );
      }
      catch (AggregateException ae)
      {
         ae.Handle(ex => { if (ex is CustomException)
                             Console.WriteLine(ex.Message);
                          return ex is CustomException;
                        });
      }
   }
```

对于各个内部异常，如果返回是True，则将会被handle；如果返回是false，则将会被 rethrow。

这样就能优雅的处理不同的内部异常





参考链接：

- [AggregateException.Handle(Func) Method (System) | Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.aggregateexception.handle?view=netframework-4.7.2)





