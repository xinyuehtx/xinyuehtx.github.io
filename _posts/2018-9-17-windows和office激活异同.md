---
layout: post
title: "2018-9-17-windows和office激活异同"
date: 2018-9-17 11:10:22
date_modified: 2018-9-17 11:10:22
categories: windows service
tags: windows kms
description: 
---

对于我们这种修电脑、卖电脑的行业（软件工程师（大雾））。可能会遇到出货产品需要进行windows软件激活的订单。（真的就是属于卖电脑的范畴）

------

例如我们要激活windows10，我们会使用如下的命令

```
cscript "%windir%\system32\slmgr.vbs" /ipk {key}>nul
cscript "%windir%\system32\slmgr.vbs" /ato
```

而对于office，我们会使用如下命令(以office13为例)

```
cscript "C:\Program Files\Microsoft Office\Office14\ospp.vbs" /inpkey:{key}
cscript "C:\Program Files\Microsoft Office\Office14\ospp.vbs" /act
```

以上两种命令都是第一条将key写入，第二条上传至微软服务器进行激活验证。

那么如果我们先将所有的key写入，然后在统一激活会如何呢？比如

```
cscript "%windir%\system32\slmgr.vbs" /ipk {key}>nul
cscript "C:\Program Files\Microsoft Office\Office14\ospp.vbs" /inpkey:{key}
cscript "%windir%\system32\slmgr.vbs" /ato
```

或者

```
cscript "%windir%\system32\slmgr.vbs" /ipk {key}>nul
cscript "C:\Program Files\Microsoft Office\Office14\ospp.vbs" /inpkey:{key}
cscript "C:\Program Files\Microsoft Office\Office14\ospp.vbs" /act
```

实际上也能够激活成功。

那么我们就可以推测两者的激活过程中可能调用了同一种服务。

- slmr

  ```vb
  Private Sub ActivateProduct(strActivationID)
    ...
      For Each objProduct in GetProductCollection(ProductIsPrimarySkuSelectClause & ", LicenseStatus, VLActivationTypeEnabled", PartialProductKeyNonNullWhereClause)
  
          bCheckProductForCommand = CheckProductForCommand(objProduct, strActivationID)
      ...
  End Sub
  ```



  ```vb
  Function GetProductCollection(strSelect, strWhere)
     ...
      If strWhere = EmptyWhereClause Then
          Set colProducts = g_objWMIService.ExecQuery("SELECT " & strSelect & " FROM " & ProductClass)
          QuitIfError()
      Else
          Set colProducts = g_objWMIService.ExecQuery("SELECT " & strSelect & " FROM " & ProductClass & " WHERE " & strWhere)
          QuitIfError()
      End If
      ...
      set GetProductCollection = colProducts
  End Function
  ```

  以上是关键代码，说明在slmr进行激活时，会通过wmi服务查询所有待激活的产品类型，然后进行激活

- ospp

  ```vb
  Function ExecuteQuery(strSelect,strWhere,strClass)
      
  Err.Clear
      
  If strWhere = "" Then
      Set productinstances = objWMI.ExecQuery("SELECT " & strSelect & " FROM " & strClass)
  Else
      Set productinstances = objWMI.ExecQuery("SELECT " & strSelect & " FROM " & strClass & " WHERE " & strWhere)
  End If
      
  sppErrHandle ""
  
  End Function
  ```

  ```vb
  For Each instance in productinstances
          sppErrHandle ""
          If (LCase(instance.ApplicationId) = OfficeAppId) Then
              If instance.PartialProductKey <> "" Then
                  i = i + 1
              End If
              Select Case strCommand
                  Case "/act"
                      WScript.Echo MSG_ACTATTEMPT 
                      WScript.Echo MSG_SKUID & instance.ID
                      WScript.Echo MSG_LICENSENAME & instance.Name
                      WScript.Echo MSG_DESCRIPTION & instance.Description
                      WScript.Echo MSG_PARTIALKEY & instance.PartialProductKey            
                      instance.Activate
                      SppErrHandle(strCommand)
                      WScript.Echo MSG_SEPERATE
                ... 
              End Select
          End If
      Next
  ```

  以上是关键代码，可以看到在ospp进行激活时，也是会通过wmi服务查询所有待激活的产品类型，然后进行激活

所以我们可以得出结论office和windows的key写入过程不同，但是都是走同一套激活流程