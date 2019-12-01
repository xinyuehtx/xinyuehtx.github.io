---
layout: post
title: "2019-12-1-实现一种异步版本的ManualResetEvent"
date: 2019-12-1 18:43:44
date_modified: 2019-12-1 18:43:49
categories: C# 多线程 
tags: C# 多线程 信号量 同步 异步 ManualResetEvent
description:
---

我们在[2019-12-1-使用SemaphoreSlim实现异步等待 - huangtengxiao](https://xinyuehtx.github.io/post/%E4%BD%BF%E7%94%A8SemaphoreSlim%E5%AE%9E%E7%8E%B0%E5%BC%82%E6%AD%A5%E7%AD%89%E5%BE%85.html)给大家介绍了信号量的异步等待使用方法。可惜的是.NET的ManualResetEvent和ManualResetEventSlim目前都没有提供异步的等待方法。所以我们自己实现一个

-----

这里是我们创建的异步版本的ManualResetEvent。

实际上这里的本质就是使用了一个TaskCompletionSource。

TaskCompletionSource是一个task的封装源，代表了一个完成的task。可以通过SetResult方法标识task的完成情况。

```C# 
    public class ManualResetEventAsync
    {
        /// <summary>
        /// 提供一个信号初始值，确定是否有信号
        /// </summary>
        /// <param name="initialState">true为有信号，所有等待可以直接通过</param>
        public ManualResetEventAsync(bool initialState)
        {
            _source = new TaskCompletionSource<bool>();

            if (initialState)
            {
                _source.SetResult(true);
            }
        }

        /// <summary>
        /// 异步等待一个信号，需要await
        /// </summary>
        /// <returns></returns>
        public Task WaitOneAsync()
        {
            lock (_locker)
            {
                return _source.Task;
            }
        }

        /// <summary>
        /// 设置一个信号量，所有等待获得信号
        /// </summary>
        public void Set()
        {
            lock (_locker)
            {
                _source.SetResult(true);
            }
        }

        /// <summary>
        /// 设置一个信号量，所有wait等待
        /// </summary>
        public void Reset()
        {
            lock (_locker)
            {
                if (!_source.Task.IsCompleted)
                {
                    return;
                }

                _source = new TaskCompletionSource<bool>();
            }
        }

        private TaskCompletionSource<bool> _source;
        private readonly object _locker = new object();
    }
```

分析下上述代码。ManualResetEventAsync最重要的三个方法就是Set，Reset，和WaitOneAsync

WaitOneAsync很简单就是等待TaskCompletionSource.Task。如果TaskCompletionSource未标记完成则会等待，如果标记完成，则会继续执行

Set也很简单就是调用TaskCompletionSource.SetResult方法将其标记为完成，这样所有正在等待的task可以继续执行。

最复杂的Reset方法。由于每个TaskCompletionSource的实例只能标识一次已完成，所以我们在每次重置时，需要重新实例化一个对象，进行替换。

当然还有很重要的一点是这里涉及多线程的判断，赋值操作，所以所有的这些方法必须放置在同步区进行。

---

参考文档：

- [2019-12-1-使用SemaphoreSlim实现异步等待 - huangtengxiao](https://xinyuehtx.github.io/post/%E4%BD%BF%E7%94%A8SemaphoreSlim%E5%AE%9E%E7%8E%B0%E5%BC%82%E6%AD%A5%E7%AD%89%E5%BE%85.html)
- [ManualResetEvent Class (System.Threading)- Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.threading.manualresetevent?view=netframework-4.8)
- [ManualResetEventSlim Class (System.Threading)- Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.threading.manualreseteventslim?view=netframework-4.8)
- [TaskCompletionSource<TResult> Class (System.Threading.Tasks) - Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.threading.tasks.taskcompletionsource-1?view=netframework-4.8)


