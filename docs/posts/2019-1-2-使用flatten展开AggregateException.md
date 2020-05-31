---
layout: post
title: "2019-1-2-使用flatten展开AggregateException"
date: 2019-1-5 16:34:28
date_modified: 2019-1-5 16:34:32
categories: windows wpf C#
tags: windows wpf C#
description: 
---

在一些并行操作或者任务列表执行的过程中，会需要用到`AggregateException`进行聚合异常的处理

-----

对于不同类型的异常我们可能期望不同的处理方式，或者简单的对每个内部异常进行日志输出

一般来说我们可能会想使用InnerException属性对内部异常进行迭代处理。

但是如果`AggregateException`的内部也嵌套了`AggregateException`那么就很尴尬了

我们必须使用while循环进行处理

不过`AggregateException`提供了一个简单的解决方案，就是Flatten方法

Flatten方法可以将`AggregateException`以迭代的方式展开，所有的InnerException,以列表的形式进行单独处理哦(如微软的例子所示)

```C#
public class Example
{
   public static void Main()
   {
      var task1 = Task.Factory.StartNew(() => {
                     var child1 = Task.Factory.StartNew(() => {
                        var child2 = Task.Factory.StartNew(() => {
                            // This exception is nested inside three AggregateExceptions.
                            throw new CustomException("Attached child2 faulted.");
                        }, TaskCreationOptions.AttachedToParent);

                        // This exception is nested inside two AggregateExceptions.
                        throw new CustomException("Attached child1 faulted.");
                     }, TaskCreationOptions.AttachedToParent);
      });

      try {
         task1.Wait();
      }
      catch (AggregateException ae) {
         foreach (var e in ae.Flatten().InnerExceptions) {
            if (e is CustomException) {
               Console.WriteLine(e.Message);
            }
            else {
               throw;
            }
         }
      }
   }
}

```



参考链接：

- [AggregateException.Flatten Method (System) - Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.aggregateexception.flatten?view=netframework-4.7.2)
- 







