---
layout: post
title: "2019-12-1-实现一种异步版本的AutoResetEvent"
date: 2019-12-1 19:15:14
date_modified: 2019-12-1 19:15:21
categories: C# 多线程 
tags: C# 多线程 信号量 同步 异步 AutoResetEvent
description:
---

我们在[2019-12-1-实现一种异步版本的ManualResetEvent - huangtengxiao](https://xinyuehtx.github.io/post/%E5%AE%9E%E7%8E%B0%E4%B8%80%E7%A7%8D%E5%BC%82%E6%AD%A5%E7%89%88%E6%9C%AC%E7%9A%84ManualResetEvent.html)给大家介绍了异步版本的ManualResetEvent。这里我们自己实现一个异步版本的AutoResetEvent

-----

这里是我们创建的异步版本的AutoResetEvent。

实现方式和之前的异步版本ManualResetEvent基本相同，也是使用了一个TaskCompletionSource。



```C# 
    public class AutoResetEventAsync
    {
        /// <summary>
        /// 提供一个信号初始值，确定是否有信号
        /// </summary>
        /// <param name="initialState">true为有信号，所有等待可以直接通过</param>
        public AutoResetEventAsync(bool initialState)
        {
            _isSignaled = initialState;
        }

        /// <summary>
        /// 异步等待一个信号，需要await
        /// </summary>
        /// <returns></returns>
        public Task WaitOneAsync()
        {
            lock (_locker)
            {
                if (_isSignaled)
                {
                    _isSignaled = false;
                    return CompletedSourceTask;
                }

                var source = new TaskCompletionSource<bool>();
                _waitQueue.Enqueue(source);
                return source.Task;
            }
        }

        /// <summary>
        /// 设置一个信号量，让一个waitone获得信号
        /// </summary>
        public void Set()
        {
            TaskCompletionSource<bool> releaseSource = null;
            lock (_locker)
            {
                if (_waitQueue.Any())
                {
                    releaseSource = _waitQueue.Dequeue();
                }

                if (releaseSource is null)
                {
                    if (!_isSignaled)
                    {
                        _isSignaled = true;
                    }
                }
            }

            releaseSource?.SetResult(true);
        }

        private static readonly Task CompletedSourceTask = Task.FromResult(true);

        private readonly Queue<TaskCompletionSource<bool>> _waitQueue =
            new Queue<TaskCompletionSource<bool>>();

        private bool _isSignaled;

        private readonly object _locker = new object();
```

分析下上述代码。首先AutoResetEvent一次只能有一个对象获得信号量。信号量被获取后马上会被reset。

那么我们就不能一直使用同一个TaskCompletionSource进行等待。所以我们添加了一个队列维持TaskCompletionSource对象。每次调用WaitOneAsync的时候就返回一个TaskCompletionSource的新实例。

当然在Signal的情况下可以使用Task.FromResult直接返回一个被标记完成的task，避免等待。

而每次调用set的时候，依次从队列里面出列，然后调用SetResult将其标记为完成。此时对应的task可以继续执行。

## 分析

不过可以注意到上面的代码都是先调用WaitOneAsync的方法先得到返回。而AutoResetEvent在set时，获得同步锁的线程是随机的。

这里实际上无伤大雅，因为顺序也是随机的一种情况，在使用AutoResetEvent本身就不应该依赖顺序。当然，如果你觉得不妥，可以将队列改为List，并且在set方法中通过随机数，选择一个实例进行标记，以达到模拟随机的效果。

另外，我们在[2019-12-1-使用SemaphoreSlim实现异步等待 - huangtengxiao](https://xinyuehtx.github.io/post/%E4%BD%BF%E7%94%A8SemaphoreSlim%E5%AE%9E%E7%8E%B0%E5%BC%82%E6%AD%A5%E7%AD%89%E5%BE%85.html)中提到的SemaphoreSlim对象将最大并发数设置为1时，完全可以实现异步版本的AutoResetEvent效果。而且在长期等待的情况下性能会更好（因为SemaphoreSlim可以进入内核态等待）

实现代码如下：

```c#
    public class AutoResetEventAsync2
    {
        /// <summary>
        /// 提供一个信号初始值，确定是否有信号
        /// </summary>
        /// <param name="initialState">true为有信号，所有等待可以直接通过</param>
        public AutoResetEventAsync2(bool initialState)
        {
            var state = initialState?1:0;
            _semaphoreSlim = new SemaphoreSlim(state,1);
        }

        /// <summary>
        /// 异步等待一个信号，需要await
        /// </summary>
        /// <returns></returns>
        public async Task WaitOneAsync()
        {
            await _semaphoreSlim.WaitAsync();
        }

        /// <summary>
        /// 设置一个信号量，让一个waitone获得信号
        /// </summary>
        public void Set()
        {
            _semaphoreSlim.Release(1);
        }
    

        private SemaphoreSlim _semaphoreSlim;


```



---

参考文档：

- [2019-12-1-使用SemaphoreSlim实现异步等待 - huangtengxiao](https://xinyuehtx.github.io/post/%E4%BD%BF%E7%94%A8SemaphoreSlim%E5%AE%9E%E7%8E%B0%E5%BC%82%E6%AD%A5%E7%AD%89%E5%BE%85.html)
- [2019-12-1-实现一种异步版本的ManualResetEvent - huangtengxiao](https://xinyuehtx.github.io/post/%E5%AE%9E%E7%8E%B0%E4%B8%80%E7%A7%8D%E5%BC%82%E6%AD%A5%E7%89%88%E6%9C%AC%E7%9A%84ManualResetEvent.html)
- [AutoResetEvent Class (System.Threading) - Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.threading.autoresetevent?view=netframework-4.8)
- [TaskCompletionSource<TResult> Class (System.Threading.Tasks) - Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/api/system.threading.tasks.taskcompletionsource-1?view=netframework-4.8)


