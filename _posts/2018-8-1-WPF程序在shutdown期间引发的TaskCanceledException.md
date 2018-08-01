---
layout: post
title: "WPF程序在shutdown期间引发的TaskCanceledException"
date: 2018-8-1 11:39:54
date_modified: 2018-8-1 11:40:02
categories: windows Wpf
tags: wpf taskCanceledException WeakEventTable ShutDownListener
description: 
---

先上堆栈

```csharp
TaskCanceledException at System.Runtime.CompilerServices.TaskAwaiter.ThrowForNonSuccess(Task task) at 
System.Runtime.CompilerServices.TaskAwaiter.ThrowForNonSuccess(Task task) at System.Runtime.CompilerServices.TaskAwaiter.HandleNonSuccessAndDebuggerNotification(Task task) at 
System.Windows.Threading.DispatcherOperation.Wait(TimeSpan timeout) at System.Windows.Threading.Dispatcher.InvokeImpl(DispatcherOperation operation, CancellationToken cancellationToken, TimeSpan timeout) at 
System.Windows.Threading.Dispatcher.Invoke(Action callback, DispatcherPriority priority, CancellationToken cancellationToken, TimeSpan timeout) at MS.Internal.WeakEventTable.OnShutDown() at 
MS.Internal.ShutDownListener.HandleShutDown(Object sender, EventArgs e) 
```

-----

##背景

问题是这样的，从5月份开始，陆续有公司发现自己的WPF软件收到大量用户报告`TaskCanceledException `异常，

就是上面堆栈中的信息，有的公司一个月内达到了惊人的150k的异常数据。我们的软件也在当月报了15k的异常。

## 诱因

原因来自于`微软的18年6月预览版质量汇总补丁`（KB 4229726），所以就是微软更新更炸了。

官方描述如下：

```
In certain .NET applications, timing issues in the finalizer thread could potentially cause exceptions during AppDomain or process shutdown.  This is generally seen in applications that do not correctly shut down Dispatchers running on worker threads prior to process or AppDomain shutdown.  Such applications should take care to properly manage the lifetime of Dispatchers. 
```

翻译过来就是

```
对于某些特定的.NET应用程序（注：目前仅影响WPF）,在AppDomain或者进程关闭时，Finalizer线程的计时问题可能会引发异常。这个问题通常出现在关闭期间，这些应用程序未能够正常关闭工作线程的Dispatcher。因此这些应用需要合理的管理Dispatcher的生命周期。
```

## 根因

时机问题来源：`WeakEventTable`在`OnShutDown（）`方法中，指定了300ms的超时（注：部分开发评论这个时间是`arbitrary ` 武断的）

代码如下：

```csharp
private void OnShutDown()
{
    if (CheckAccess())
    {
        Purge(true);
 
        // remove the table from thread storage
        _currentTable = null;
    }
    else
    {
        // if we're on the wrong thread, try asking the right thread
        // to do the job.  (DomainUnload arrives on finalizer thread - DDVSO 543980)
        bool succeeded = false;
        try
        {
            Dispatcher.Invoke((Action)OnShutDown, DispatcherPriority.Send, CancellationToken.None, TimeSpan.FromMilliseconds(300));
            succeeded = true;
        }
        catch (TimeoutException)
        {
        }
 
        // if that didn't work (because Dispatcher was busy or not pumping),
        // do the work on the wrong thread, but don't touch thread-statics.
        // This won't do everything, but it will do enough to support
        // some useful scenarios (such as DevDiv Bugs 121070).
        if (!succeeded)
        {
            Purge(true);
        }
    }
}
```

可以看到，在错误线程调用该方法时，进入`else`，然后触发超时。源代码中针对`TimeoutException`进行了catch，但是没有处理`TaskCanceledException `。而从堆栈信息上看，很可能这次更新将内部实现改为了异步任务。

## 影响范围

按官方文档解释，目前仅影响4.7.2上运行的部分WPF程序

## 解决方案

### 直接方案

这个补丁上线时，提供了一个开关。只要在`app.config`里面添加

```xaml
<configuration>
    <runtime>
        <AppContextSwitchOverrides value="Switch.MS.Internal.DoNotInvokeInWeakEventTableShutdownListener=true"/>
    </runtime>
</configuration>
```

该方案能够有助于`缓解（alleviate）`该问题， 而并不能`消除(eliminate) `

### 根本方案

1、清理代码中跨线程调用`OnShutDown（）`方法

2、减少关闭期间`Dispatcher`的调用



参考链接：

- https://stackoverflow.com/questions/50906813/taskcanceledexception-in-shutdownlistener
- https://referencesource.microsoft.com/#WindowsBase/Base/MS/Internal/WeakEventTable.cs
- https://developercommunity.visualstudio.com/content/problem/284294/taskcanceledexception-during-application-shutdown.html
- https://support.microsoft.com/en-gb/help/4229726/description-of-preview-of-quality-rollup-for-net-framework-4-6-4-6-1-4
- https://github.com/Microsoft/dotnet/blob/master/Documentation/compatibility/wpf-AppDomain-shutdown-handling-may-now-call-Dispatcher.Invoke-in-cleanup-of-WeakEvents.md
- https://github.com/Microsoft/dotnet/blob/master/Documentation/compatibility/wpf-AppDomain-shutdown-handling-may-now-call-Dispatcher.Invoke-in-cleanup-of-WeakEvents.md



