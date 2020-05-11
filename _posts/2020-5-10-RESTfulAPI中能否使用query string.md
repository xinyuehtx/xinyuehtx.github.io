---
layout: post
title: "2020-5-10-RESTfulAPI中能否使用query string"
date: 2020-5-11 20:03:49
date_modified: 2020-5-11 20:03:53
categories: 架构
tags: 架构 RESTful
description:
---

之前[2020-5-6-restful理解 - huangtengxiao](https://xinyuehtx.github.io/post/restful%E7%90%86%E8%A7%A3.html)和大家介绍了对RESTful的理解。然后就有小伙伴问了我灵魂问题，对于RESTfulAPI设计，是不是不能使用query string？

关于这个问题，网上观点两派纷争不断，为此我特意去拜读了[Roy Thomas Fielding](http://www.ics.uci.edu/~fielding/)的博士论文，以及结合自己的理解来和大家谈谈RESTfulAPI能否使用query string。

-----

## 问题来源

对于RESTfulAPI，大家都有一个基本的认识，网上一切皆资源，用URI来定位唯一的资源。

而对于领域模型的实体对象来说，RESTfulAPI的设计大家都没有什么疑问。

比如一个人的名字可以用这样的API

```
/people/1/name
```

但是，如果这个资源时一个服务，那么处理方式就存在争议了

比如有一个姓名生成服务，可以根据传入的性别，生成一个随机的人名。

不同的同学可能会使用下面两种不同的API设计方式。

```
/namegenerator?gender=male
/namegenerator/male
```

出现这种情况的一个可能的原因来自于Roy Thomas Fielding博士论文中的[6.5.2 HTTP is not RPC](https://www.ics.uci.edu/~fielding/pubs/dissertation/evaluation.htm#sec_6_5_2)这一小节。

文中不建议大家使用RPC风格的设计（即`类似`第一种使用query string 的方法）。

那么这一节真的是让大家不要使用query string 么？

## HTTP is not RPC

论文里面最重要的一段话如下，翻译过来大意是，HTTP和RPC的区别不在于语法，而是提供了一个带标准语义统一的接口，能让中间层获取和源服务几乎相同的解析能力。这导致应用获得了独立于信息源的转换层和间接层，有利于构建网络缩放，多组织，可松散缩放的信息系统。而RPC机制只是定义了API术语，而不是基于网络的应用。

```
What distinguishes HTTP from RPC isn't the syntax. It isn't even the different characteristics gained from using a stream as a parameter, though that helps to explain why existing RPC mechanisms were not usable for the Web. What makes HTTP significantly different from RPC is that the requests are directed to resources using a generic interface with standard semantics that can be interpreted by intermediaries almost as well as by the machines that originate services. The result is an application that allows for layers of transformation and indirection that are independent of the information origin, which is very useful for an Internet-scale, multi-organization, anarchically scalable information system. RPC mechanisms, in contrast, are defined in terms of language APIs, not network-based applications.
```

这段话有几个关键点：

- 统一接口
- 中间层解析
- 可缩放

我们来分析一下，使用RESTfulAPI的好处在于统一的语义化API，让各个中间节点，可以识别请求信息。于是我们可以在网络中间层，添加对应的转换服务，比如缓存服务。

许多的浏览器节点和中间服务器节点（代理服务器，CDN服务器）等，都不支持对query string的缓存。详见：[Revving Filenames: don’t use querystring | High Performance Web Sites](https://www.stevesouders.com/blog/2008/08/23/revving-filenames-dont-use-querystring/)



另外的一点，是模型的扩展。例如对于之前的人名API可以做如下扩展，而且这些扩展都可以是按需添加的。而RPC风格的API设计几乎只有不停的添加参数，才能实现。

```
/people/1/name/firstname
/people/1/name/lastname
/people/1/age
```



还有一点是content negotiation。RESTfulAPI可以通过http的控制信息来确定返回内容的类型，比如是json还是xml。这里的好处是可以保证URI的稳定，和长生命周期。而这也是某些RPC风格写法（例如type=xml）很难做到的。

## 服务是叶节点

上面聊了都是不使用RPC风格API的好处，但是对于服务来说，情况会有一些不一样。

首先服务对于领域模型来说，大多数是不属于实体的方法。

因此很难直接将其转换为对于实体的增删改查操作。

第二点，服务的返回值往往都是需要进行运算获得，所以生命周期往往比较短。

第三点，服务作为模型的叶节点，几乎不会再有层次性的扩展。



那么对应于上一小节的限制，几乎不会存在。

1. 没有层次扩展要求，所以不存在扩展性问题
2. 现在很多服务也能利用中间层的content negotiation，确定返回值类型。前提只要不写出，类似type=xml的API即可
3. 及时运算结果和短生命周期，对缓存要求变低。另外目前越来越多的浏览器和服务器开始支持带query string的请求内容的缓存，也能满足长时间缓存的要求。

## 服务使用query string类型的优劣

上面解释了为什么服务使用query string不存在实体类型使用query string的常见坏处。

这里解释下服务使用query string风格的实际优势和劣势。

### 语义化优先

实际上Roy Thomas Fielding博士论文一直在强调语义性。

而服务使用query string也是语义优先的。

对于`/namegenerator?gender=male`我们很清楚male的语义是gender。

而`/namegenerator/male`则相反，male不具有语义，甚至整个uri不对应任何实体，这和RESTful的思想是背道而驰的。

### 模型优先

假如我们强行将服务转换成实体，用来同时符合RESTful和避免query string的要求。

我们可能会得到如下的API设计

```
/namegenerator/malenamegenerator/generatednames
/namegenerator/malenamegenerator/generatednames/huangtengxiao
```

这种设计会使得实现决定模型，让软件脱离模型原有设计，导致软件更加难以理解和维护

## RESTfulAPI是否应该使用query string

关于这个问题，我阅读了Roy Thomas Fielding的博士论文。

全文没有一处强调是否对RESTful采用如何的实现。

在我看来RESTful实际上是guide，而不是best practice。

我们应该选择符合RESTful的约束思想的实现，而不是被实现约束。

### 个人推荐做饭

纯属个人推荐。

- 对于领域模型中的实体类型，使用层次化的名字形式API
- 对于领域模型中的服务类型，推荐使用query string，表示参数

## 其他方案

当然除了query string，也有其他大神推荐的方案。

比如阮一峰在[理解RESTful架构 - 阮一峰的网络日志](http://www.ruanyifeng.com/blog/2011/09/restful.html)中就推荐对于服务，使用post方法，然后在http头中带对应的参数。

个人认为这也是一个很好的RESTful实现

---

参考文档：

-  [javascript - Cache invalidation using the query-string, bad practice? - Stack Overflow](https://stackoverflow.com/questions/37204296/cache-invalidation-using-the-query-string-bad-practice)
-  [Strategies for Cache-Busting CSS - CSS-Tricks](https://css-tricks.com/strategies-for-cache-busting-css/)
-  [Revving Filenames: don’t use querystring | High Performance Web Sites](https://www.stevesouders.com/blog/2008/08/23/revving-filenames-dont-use-querystring/)
-  [javascript - File Caching: Query string vs Last-Modified? - Stack Overflow](https://stackoverflow.com/questions/23603023/file-caching-query-string-vs-last-modified)
-  [internet explorer - Caching from URLs with a query string - Stack Overflow](https://stackoverflow.com/questions/850187/caching-from-urls-with-a-query-string)
-  [php - HTTP Caching URLs with Query String - Stack Overflow](https://stackoverflow.com/questions/31060319/http-caching-urls-with-query-string)
-  [Fielding Dissertation: CHAPTER 5: Representational State Transfer (REST)](https://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm)
-  [Fielding Dissertation: CHAPTER 6: Experience and Evaluation](https://www.ics.uci.edu/~fielding/pubs/dissertation/evaluation.htm#sec_6_5)
-  [Architectural Styles and the Design of Network-based Software Architectures](https://www.ics.uci.edu/~fielding/pubs/dissertation/top.htm)
-  [2020-5-6-restful理解 - huangtengxiao](https://xinyuehtx.github.io/post/restful%E7%90%86%E8%A7%A3.html)
-  [理解RESTful架构 - 阮一峰的网络日志](http://www.ruanyifeng.com/blog/2011/09/restful.html)


