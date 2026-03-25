---
title: "如何避免写出await await"
date: 2019-01-05
tags:
  - 其他

---


小伙伴们应该对C#中的await/async模式都很熟悉了，对于一个Task或者Task\&lt;T&gt;对象，使用await进行异步任务的等待



那么对于一些方法的返回值是Task类型的异步方法呢？

比如说

```C#
        private Task<int> Foo()
        {
            return Task.Run(() => 1);
        }

        private async void Boo()
        {
            int i = await await Foo().ContinueWith(task => Foo());
            Console.WriteLine(i);
        }
```

这样会看到一个很丑陋的两个await await。

在一些情况下可以使用如下方式进行避免

```C#
		private async void Boo()
        {
            await Foo();
            int i = await Foo();
            Console.WriteLine(i);
        }
```

当然也可以使用

```c#
		private async void Boo()
        {
            int i = await Foo().ContinueWith(task => Foo()).Unwrap();
            Console.WriteLine(i);
        }
```

进行一个更加优雅的方式替代

参考链接：

- [How to: Unwrap a Nested Task - Microsoft Docs](https://docs.microsoft.com/en-us/dotnet/standard/parallel-programming/how-to-unwrap-a-nested-task?view=netframework-4.7.2)







