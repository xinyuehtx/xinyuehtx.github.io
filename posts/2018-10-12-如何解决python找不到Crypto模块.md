---
layout: post
title: "2018-10-12-如何解决python找不到Crypto模块"
date: 2018-10-12 09:15:15
date_modified: 2018-10-12 09:15:20
categories: windows python pip
tags: windows python pip crypto
description: 
---

涉及加密算法的python代码，尤其是git上down下来的“老代码”经常会遇到神奇的`报错 ImportError: No module named Crypto.Cipher ` , 这个问题谷歌上也是哀鸿遍野，简单描述下可能遇到的坑，以及解决方案

-----

首先一般正常人想到的是没有使用pip安装一个

```python
pip install Crypto
```

于是你得到了一个叫做`crypto 1.4.1`的package，它的github是这样的

![1539329784501](../media/1539329784501.png)

而真正的所需的项目叫做`pycrypto 2.6.1`,它的github是这样的

![1539329911422](../media/1539329911422.png)

注：这里没有对`crypto`项目有任何的 不敬，只是目前`pypi`中两个项目的名称对大量开发者造成困扰

然而坑还没有结束，使用pip安装`pycrypto`依然会报错（至少在windows上如此）

```python
pip install pycrypto
```

原因是编译环境缺少`#include < stdint.h >`，需要手动设置vc编译器的环境变量

（以下步骤需要你安装了visual studio）

1. 管理员权限开启cmd
2. 运行visual studio中的vsvars.bat（找不到？试试wox，我的是"D:\Program Files (x86)\Microsoft Visual Studio\2017\Enterprise\Common7\Tools\vsdevcmd\ext\vcvars.bat"）
3. 运行` CL=-FI"stdint.h所在地址"`（我的是"D:\Program Files (x86)\Microsoft Visual Studio\2017\Enterprise\SDK\ScopeCppSDK\VC\include\stdint.h"）
4. 最后再运行`pip install pycrypto`

然后终于不再报错了。。

![1539331127087](../media/1539331127087.png)

参考链接：

[crypto · PyPI](https://pypi.org/project/crypto/#description)

[chrissimpkins/crypto: Simple symmetric GPG file encryption and decryption](https://github.com/chrissimpkins/crypto)

[pycrypto · PyPI](https://pypi.org/project/pycrypto/#description)

[dlitz/pycrypto: The Python Cryptography Toolkit](https://github.com/dlitz/pycrypto)

[visual studio - Microsoft Windows Python-3.6 PyCrypto installation error - Stack Overflow](https://stackoverflow.com/questions/41843266/microsoft-windows-python-3-6-pycrypto-installation-error)





