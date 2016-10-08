/**
 * Sea.js 2.3.0 | seajs.org/LICENSE.md
 */
  // 传入 global 用来兼容 node 环境，传入 undefined 防止 undefined 被 覆盖（chrome 的 undefined 被保护哦）
(function(global, undefined) {

// 阻止多个 seajs 被加载
if (global.seajs) {
  return
}

var seajs = global.seajs = {
  version: "2.3.0"
}

// 将 data 放到全局变量 seajs 下，使其在全局环境可以被访问，下面的写法也是如此。
var data = seajs.data = {}


/**
 * util-lang.js - The minimal language enhancement
 */

// 用 Object.prototype.toString 来进行类型判断，原理不多说了。 
function isType(type) {
  return function(obj) {
    return {}.toString.call(obj) == "[object " + type + "]"
  }
}

var isObject = isType("Object")
var isString = isType("String")
var isArray = Array.isArray || isType("Array")
var isFunction = isType("Function")

// client id 只在客户端使用没有必要是用 uid 或是 uuid
// 主要是对于匿名模块的
var _cid = 0
function cid() {
  return _cid++
}


/**
 * util-events.js - The minimal events support
 */
// 事件的绑定需由插件或用户来做，seajs 内部只会触发相应的事件，而不会进行绑定。
var events = data.events = {}

// 绑定事件
seajs.on = function(name, callback) {
  // 如果已经存在该事件的回调函数列表则直接加入回调函数，否则初始化回调函数列表并加入回调函数。
  var list = events[name] || (events[name] = [])
  list.push(callback)
  return seajs
}

// 移除事件
seajs.off = function(name, callback) {
  // 如果 name 和 callback 都是 undefined 则移除所有的事件
  if (!(name || callback)) {
    events = data.events = {}
    return seajs
  }

  var list = events[name]
  // 如果 callback 不为 undefined 且事件存在绑定的回调列表则删除，
  // 否则遍历回调列表，移除对应的 callback
  if (list) {
    if (callback) {
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i] === callback) {
          list.splice(i, 1)
        }
      }
    }
    else {
      delete events[name]
    }
  }

  return seajs
}

// 触发某个事件，并执行所有绑定的回调函数，传入的参数都是 data
var emit = seajs.emit = function(name, data) {
  var list = events[name], fn

  if (list) {
    // slice 返回一个相同的新数组，防止执行过程中被修改
    //（mdn 上说道省略第一个参数，默认为 0）
    list = list.slice()

    // 执行 callbacks，用下标因为更快
    for(var i = 0, len = list.length; i < len; i++) {
      list[i](data)
    }
  }

  return seajs
}


/**
 * util-path.js - The utilities for operating path such as id, uri
 */

// 匹配斜杠结尾的字符串，直到出现 # 或 ？
var DIRNAME_RE = /[^?#]*\//

// 匹配 /./
var DOT_RE = /\/\.\//
// 匹配 /**/../
var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//
// 匹配多个重复斜杠 ////，排除://
var MULTI_SLASH_RE = /([^:/])\/+\//g

// 从路径中取出目录的部分
// dirname("http://example.com/a/b/c.js?t=123#xx/zz") ==> "http://example.com/a/b/"
// ref: http://jsperf.com/regex-vs-split/2
function dirname(path) {
  return path.match(DIRNAME_RE)[0]
}

// 规范化一个路径
// realpath("http://test.com/a//./b/../c") ==> "http://test.com/a/c"
function realpath(path) {
  // 去掉多余的 /./
  // /a/b/./c/./d ==> /a/b/c/d
  path = path.replace(DOT_RE, "/")

  /*
    @author wh1100717
    a//b/c ==> a/b/c
    a///b/////c ==> a/b/c
    DOUBLE_DOT_RE matches a/b/c//../d path correctly only if replace // with / first
  */
  path = path.replace(MULTI_SLASH_RE, "$1/")

  // 将 /**/../ 替换成 /
  // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
  while (path.match(DOUBLE_DOT_RE)) {
    path = path.replace(DOUBLE_DOT_RE, "/")
  }

  return path
}

// 标准化一个路径，添加文件后缀
// 如果以#结尾则不会进行任何操作
// 如果以.js结尾或者存在？或者以/结尾都不添加.js，其他情况下都会添加
// normalize("path/to/a") ==> "path/to/a.js"
// NOTICE: substring is faster than negative slice and RegExp
function normalize(path) {
  var last = path.length - 1
  var lastC = path.charAt(last)

  // If the uri ends with `#`, just return it without '#'
  if (lastC === "#") {
    return path.substring(0, last)
  }

  return (path.substring(last - 2) === ".js" ||
      path.indexOf("?") > 0 ||
      lastC === "/") ? path : path + ".js"
}

// 将第一个 / 分割的两个串捕获分组
var PATHS_RE = /^([^/:]+)(\/.+)$/
// 匹配 {}, 并将括号内的分组捕获进行替换
var VARS_RE = /{([^{]+)}/g

// 根据 id 返回 alias[id]
// alias 不存在则直接返回 alias，
// alias[id] 不是字符串则返回 id
function parseAlias(id) {
  var alias = data.alias
  return alias && isString(alias[id]) ? alias[id] : id
}

// 利用正则将 id 根据第一个 / 拆分为两部分
// 如果第一个捕获分组存在于 paths 的规则中，则进行替换
function parsePaths(id) {
  var paths = data.paths
  var m

  if (paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]])) {
    id = paths[m[1]] + m[2]
  }

  return id
}

// 匹配 id 中的 {}，然后将其内容进行替换
/* 例子
seajs.config({
  vars: {
    'locale': 'zh-cn'
  }
});
define(function(require, exports, module) {

  var lang = require('./i18n/{locale}.js');
     //=> 加载的是 path/to/i18n/zh-cn.js

});
*/
function parseVars(id) {
  var vars = data.vars

  if (vars && id.indexOf("{") > -1) {
    id = id.replace(VARS_RE, function(m, key) {
      return isString(vars[key]) ? vars[key] : m
    })
  }

  return id
}

// 该配置可对模块路径进行映射修改，可用于路径转换、在线调试等。
/*例子
seajs.config({
  map: [
    [ '.js', '-debug.js' ]
  ]
});
define(function(require, exports, module) {

  var a = require('./a');
     //=> 加载的是 path/to/a-debug.js

});
*/
function parseMap(uri) {
  var map = data.map
  var ret = uri

  if (map) {
    for (var i = 0, len = map.length; i < len; i++) {
      var rule = map[i]

      ret = isFunction(rule) ?
          (rule(uri) || uri) :
          uri.replace(rule[0], rule[1])

      // Only apply the first matched rule
      if (ret !== uri) break
    }
  }

  return ret
}

// 匹配 // 或 :/
var ABSOLUTE_RE = /^\/\/.|:\//
// 匹配 path//to/
var ROOT_DIR_RE = /^.*?\/\/.*?\//

// addBase函数实际上是对处理路径id到一定阶段后的分流，判断路径类型，得出一个阶段性的路径结果（这个步骤结束就只剩最后一步map的替换了）
function addBase(id, refUri) {
  var ret
  var first = id.charAt(0)

  // 绝对路径
  if (ABSOLUTE_RE.test(id)) {
    ret = id
  }
  // require 和 require.async 中的相对路径相对当前模块路径来解析。
  // seajs.use 中的相对路径始终相对当前页面来解析。
  else if (first === ".") {
    ret = realpath((refUri ? dirname(refUri) : data.cwd) + id)
  }
  // 根路径始终相对当前页面解析。
  else if (first === "/") {
    var m = data.cwd.match(ROOT_DIR_RE)
    ret = m ? m[0] + id.substring(1) : id
  }
  // 顶级标识始终相对 base 基础路径解析。
  else {
    ret = data.base + id
  }

  // 如果以 // 开头，则添加和当前协议一样的协议
  if (ret.indexOf("//") === 0) {
    ret = location.protocol + ret
  }

  return ret
}

function id2Uri(id, refUri) {
  if (!id) return ""

  // 替换别名
  id = parseAlias(id)
  // 替换 path
  id = parsePaths(id)
  // 替换变量
  id = parseVars(id)
  // 加后缀
  id = normalize(id)

  var uri = addBase(id, refUri)
  // 应用规则
  uri = parseMap(uri)

  return uri
}


var doc = document
// 当前工作目录，忽略 about:xxx。
var cwd = (!location.href || location.href.indexOf('about:') === 0) ? '' : dirname(location.href)
var scripts = doc.scripts

// 建议为 sea.js 的 script 元素加上 id "seajsnode"
var loaderScript = doc.getElementById("seajsnode") ||
    scripts[scripts.length - 1]

// 当 sea.js 内联的时候，loadDir 取当前的工作目录
var loaderDir = dirname(getScriptAbsoluteSrc(loaderScript) || cwd)

function getScriptAbsoluteSrc(node) {
  return node.hasAttribute ? // non-IE6/7
      node.src :
    // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
      node.getAttribute("src", 4)
}


// 开发者接口
seajs.resolve = id2Uri


/**
 * util-request.js - The utilities for requesting script and style files
 * ref: tests/research/load-js-css/test.html
 */

// 取head元素的方式中doc.headie在9开始支持。doc.documentElement 这个考虑应该是在页面中不存在head标签时，则选择插入到body标签中。
var head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement
var baseElement = head.getElementsByTagName("base")[0]

var currentlyAddingScript
var interactiveScript

// 创建 script 发出异步请求
function request(url, callback, charset) {
  var node = doc.createElement("script")

  if (charset) {
    var cs = isFunction(charset) ? charset(url) : charset
    if (cs) {
      node.charset = cs
    }
  }

  addOnload(node, callback, url)

  node.async = true
  node.src = url

  // For some cache cases in IE 6-8, the script executes IMMEDIATELY after
  // the end of the insert execution, so use `currentlyAddingScript` to
  // hold current node, for deriving url in `define` call
  currentlyAddingScript = node

  // 后加载的 js 被插在了 head 的最前边，这样会导致 X-UA-Compatible 失效
  // 所以不存在 base 时使用 appendChild
  // ref: #185 & http://dev.jquery.com/ticket/2709
  baseElement ?
      head.insertBefore(node, baseElement) :
      head.appendChild(node)

  currentlyAddingScript = null
}

// 检测是否支持 onload
// 不支持使用 onreadystatechange 代替
function addOnload(node, callback, url) {
  var supportOnload = "onload" in node

  if (supportOnload) {
    node.onload = onload
    node.onerror = function() {
      emit("error", { uri: url, node: node })
      onload()
    }
  }
  else {
    node.onreadystatechange = function() {
      if (/loaded|complete/.test(node.readyState)) {
        onload()
      }
    }
  }

  function onload() {
    // 确保只执行一次，处理 IE 的内存泄漏
    node.onload = node.onerror = node.onreadystatechange = null

    // 移除 script 减少内存泄露
    if (!data.debug) {
      head.removeChild(node)
    }

    // 删除 node 引用
    node = null

    callback()
  }
}

function getCurrentScript() {
  if (currentlyAddingScript) {
    return currentlyAddingScript
  }

  // For IE6-9 browsers, the script onload event may not fire right
  // after the script is evaluated. Kris Zyp found that it
  // could query the script nodes and the one that is in "interactive"
  // mode indicates the current script
  // ref: http://goo.gl/JHfFW
  if (interactiveScript && interactiveScript.readyState === "interactive") {
    return interactiveScript
  }

  var scripts = head.getElementsByTagName("script")

  for (var i = scripts.length - 1; i >= 0; i--) {
    var script = scripts[i]
    if (script.readyState === "interactive") {
      interactiveScript = script
      return interactiveScript
    }
  }
}


// 开发者接口
seajs.request = request


/**
 * util-deps.js - The parser for dependencies
 * ref: tests/research/parse-dependencies/test.html
 */

// 从 factory 中提取出 require 的依赖
var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g
var SLASH_RE = /\\\\/g

function parseDependencies(code) {
  var ret = []

  code.replace(SLASH_RE, "")
      .replace(REQUIRE_RE, function(m, m1, m2) {
        if (m2) {
          ret.push(m2)
        }
      })

  return ret
}


/**
 * module.js - The core of module loader
 */

// cachedMods，模块缓存。在seajs中，所有加载的模块都会通过Module()构造并push到cahedMods中进行管理。
var cachedMods = seajs.cache = {}
// anonymouseMeta，这个变量的看英文的意思是“匿名元数据”，其实作用是在定义模块的时候，如果是匿名模块的话，会对还未加载的匿名模块做信息缓存。
var anonymousMeta

// fechingList、fechedList,这两个变量的作用是seajs在加载依赖模块时，对模块所正在拉取的依赖和完成拉取的依赖的管理。
var fetchingList = {}
var fetchedList = {}
// callbackList,这个变量与fechingList、fechedList相关联，是对加载的依赖完成之后，会去调用加载完成依赖的模块的回调函数，这里可以实现对多层依赖、相互依赖的管理。
var callbackList = {}

// STATUS，从可枚举的字段值可以看出，这个变量目的是为实现对模块各个状态的标志维护。
var STATUS = Module.STATUS = {
  // 1 - The `module.uri` is being fetched
  FETCHING: 1,
  // 2 - The meta data has been saved to cachedMods
  SAVED: 2,
  // 3 - The `module.dependencies` are being loaded
  LOADING: 3,
  // 4 - The module are ready to execute
  LOADED: 4,
  // 5 - The module is being executed
  EXECUTING: 5,
  // 6 - The `module.exports` is available
  EXECUTED: 6
}


function Module(uri, deps) {
  this.uri = uri                 // 模块路径
  this.dependencies = deps || [] // 模块依赖
  this.exports = null            // 模块导出对象
  this.status = 0                // 模块状态

  // 该模块依赖的模块
  this._waitings = {}

  // 还未加载的依赖
  this._remain = 0
}

// 将模块的依赖数组处理成对应的 uri 数组
Module.prototype.resolve = function() {
  var mod = this
  var ids = mod.dependencies
  var uris = []

  for (var i = 0, len = ids.length; i < len; i++) {
    // mod.uri 传给 id2Uri 的 refUri
    // 在 addBase 中如果id是相对标识相对于当前模块路径来解析 Module.resolve(ids[i], mod.uri)
    uris[i] = Module.resolve(ids[i], mod.uri)
  }
  return uris
}

// 加载依赖的模块并在所有加载完以后触发 onload 事件
Module.prototype.load = function() {
  var mod = this

  // If the module is being loaded, just wait it onload call
  // 如果模块正在加载或已经加载完或，return
  if (mod.status >= STATUS.LOADING) {
    return
  }

  // 设置状态正在加载
  mod.status = STATUS.LOADING

  // Emit `load` event for plugins such as combo plugin
  // 得到依赖模块的真实路径
  var uris = mod.resolve()
  emit("load", uris)

  // 设置 _remain（未加载依赖）为所有依赖个数
  var len = mod._remain = uris.length
  var m

  // Initialize modules and register waitings
  // 初始化模块并将当前模块注册到依赖它的模块的 waitings
  for (var i = 0; i < len; i++) {
    m = Module.get(uris[i])

    // 如果加载成功则 _remain--，否则加入 waitings 中
    // 说明 mod 在等待 m 的加载完毕
    if (m.status < STATUS.LOADED) {
      // 可能重复依赖：如果有多个依赖那么会是依赖的数量而不是 1
      m._waitings[mod.uri] = (m._waitings[mod.uri] || 0) + 1
    }
    else {
      mod._remain--
    }
  }

  // 所有依赖都已经加载完毕，则调用 onload
  if (mod._remain === 0) {
    mod.onload()
    return
  }

  // 开始并行地加载
  // requestCache 保存了请求的函数
  var requestCache = {}

  for (i = 0; i < len; i++) {
    m = cachedMods[uris[i]]

    // 如果模块还未开始抓取，则进行抓取
    // 如果模块依赖已经抓取并保存到 cachedMods 中则开始加载模块
    if (m.status < STATUS.FETCHING) {
      m.fetch(requestCache)
    }
    else if (m.status === STATUS.SAVED) {
      m.load()
    }
  }

  // Send all requests at last to avoid cache bug in IE6-9. Issues#808
  // 在这里统一调用 requestCache 中的请求
  for (var requestUri in requestCache) {
    if (requestCache.hasOwnProperty(requestUri)) {
      requestCache[requestUri]()
    }
  }
}

// Call this method when module is loaded
// 模块加载完毕调用这个方法
Module.prototype.onload = function() {
  var mod = this
  // 加载完毕回调修改模块的状态
  mod.status = STATUS.LOADED

  if (mod.callback) {
    mod.callback()
  }

  // Notify waiting modules to fire onload
  var waitings = mod._waitings
  var uri, m

  // 一个模块加载完毕之后，需要在依赖它的模块减去它被依赖的次数
  // 如果等待它的 _remain 也被加载完了，那么也就要调用这个模块的 onload
  for (uri in waitings) {
    if (waitings.hasOwnProperty(uri)) {
      m = cachedMods[uri]
      m._remain -= waitings[uri]
      if (m._remain === 0) {
        m.onload()
      }
    }
  }

  // 减少内存占用
  delete mod._waitings
  delete mod._remain
}

// 抓取一个模块
Module.prototype.fetch = function(requestCache) {
  var mod = this
  var uri = mod.uri

  // mod 开始抓取前将其的状态设置为抓取中
  mod.status = STATUS.FETCHING

  // Emit `fetch` event for plugins such as combo plugin
  var emitData = { uri: uri }
  emit("fetch", emitData)
  var requestUri = emitData.requestUri || uri

  // Empty uri or a non-CMD module
  // 这里如果uri为空，则说明是调用seajs.use()函数加载的模块或者是匿名模块，
  // 这两种情况，模块都是抓取完成了的。
  if (!requestUri || fetchedList[requestUri]) {
    mod.load()
    return
  }

  // 然后函数会去检测抓取的模块是否在fetchingList里面，
  // 如果存在的话，则说明模块正处在fetching的状态,则会将模块加载到callbackList里面，
  // 目的是在完成模块物理加载后，完成对加载模块的回调load()处理。
  // 这里实际上应该是对于在调用本身uri加载模块自身之后，其他非模块本身的uri（例如插件）也需要加载此模块，则需要加入这个模块mod到callbackList中.
  if (fetchingList[requestUri]) {
    callbackList[requestUri].push(mod)
    return
  }

  // 通过上面两个 if，已经过滤掉了正在抓取、已经抓取、匿名模块
  // 剩下的就要进行抓取了
  fetchingList[requestUri] = true
  callbackList[requestUri] = [mod]

  // Emit `request` event for plugins such as text plugin
  emit("request", emitData = {
    uri: uri,
    requestUri: requestUri,
    onRequest: onRequest,
    charset: data.charset
  })

  if (!emitData.requested) {
    requestCache ?
        requestCache[emitData.requestUri] = sendRequest :
        sendRequest()
  }

  function sendRequest() {
    seajs.request(emitData.requestUri, emitData.onRequest, emitData.charset)
  }

  // 加载完的回调
  function onRequest() {
    // 从加载列表中移除
    delete fetchingList[requestUri]
    // 在加载完毕列表中设置为true
    fetchedList[requestUri] = true

    // Save meta data of anonymous module
    // 如果是匿名模块，则保存信息到 cachedMods
    if (anonymousMeta) {
      Module.save(uri, anonymousMeta)
      anonymousMeta = null
    }

    // 完成物理加载后取出需要回调的模块，调用 load 方法。
    var m, mods = callbackList[requestUri]
    delete callbackList[requestUri]
    while ((m = mods.shift())) m.load()
  }
}

// 执行模块
Module.prototype.exec = function () {
  var mod = this

  // When module is executed, DO NOT execute it again. When module
  // is being executed, just return `module.exports` too, for avoiding
  // circularly calling
  if (mod.status >= STATUS.EXECUTING) {
    return mod.exports
  }

  mod.status = STATUS.EXECUTING

  // Create require
  var uri = mod.uri

  function require(id) {
    return Module.get(require.resolve(id)).exec()
  }

  require.resolve = function(id) {
    return Module.resolve(id, uri)
  }

  require.async = function(ids, callback) {
    Module.use(ids, callback, uri + "_async_" + cid())
    return require
  }

  // Exec factory
  var factory = mod.factory

  var exports = isFunction(factory) ?
      factory(require, mod.exports = {}, mod) :
      factory

  if (exports === undefined) {
    exports = mod.exports
  }

  // Reduce memory leak
  delete mod.factory

  mod.exports = exports
  mod.status = STATUS.EXECUTED

  // Emit `exec` event
  emit("exec", mod)

  return exports
}

// 本质是调用 id2Uri 来将 id 转成 uri
Module.resolve = function(id, refUri) {
  // Emit `resolve` event for plugins such as text plugin
  var emitData = { id: id, refUri: refUri }
  emit("resolve", emitData)

  return emitData.uri || seajs.resolve(emitData.id, refUri)
}

// 定义一个模块
Module.define = function (id, deps, factory) {
  var argsLen = arguments.length

  // 只有一个参数，那么是以 define(factory) 形式调用，把 factory 设置为 id 的值 
  if (argsLen === 1) {
    factory = id
    id = undefined
  }
  // 两个参数把第二个参数给 factory
  // 第一个参数根据参数类型判断是哪种形式的调用
  else if (argsLen === 2) {
    factory = deps

    // define(deps, factory)
    if (isArray(id)) {
      deps = id
      id = undefined
    }
    // define(id, factory)
    else {
      deps = undefined
    }
  }

  // Parse dependencies according to the module factory code
  if (!isArray(deps) && isFunction(factory)) {
    deps = parseDependencies(factory.toString())
  }

  var meta = {
    id: id,
    uri: Module.resolve(id),
    deps: deps,
    factory: factory
  }

  // Try to derive uri in IE6-9 for anonymous modules
  if (!meta.uri && doc.attachEvent) {
    var script = getCurrentScript()

    if (script) {
      meta.uri = script.src
    }

    // NOTE: If the id-deriving methods above is failed, then falls back
    // to use onload event to get the uri
  }

  // Emit `define` event, used in nocache plugin, seajs node version etc
  emit("define", meta)

  meta.uri ? Module.save(meta.uri, meta) :
      // Save information for "saving" work in the script onload event
      anonymousMeta = meta
}

// Save meta data to cachedMods
// 保存 meta 信息到 cachedMods
Module.save = function(uri, meta) {
  var mod = Module.get(uri)

  // Do NOT override already saved modules
  // 不覆盖已经保存的模块信息
  if (mod.status < STATUS.SAVED) {
    mod.id = meta.id || uri
    mod.dependencies = meta.deps || []
    mod.factory = meta.factory
    mod.status = STATUS.SAVED

    emit("save", mod)
  }
}

// 从模块缓存中获取模块，不存在则新建模块并加入缓存中
Module.get = function(uri, deps) {
  return cachedMods[uri] || (cachedMods[uri] = new Module(uri, deps))
}

// Use function is equal to load a anonymous module
// 加载一个匿名模块
Module.use = function (ids, callback, uri) {
  // 从缓存取中或新建加入缓存
  var mod = Module.get(uri, isArray(ids) ? ids : [ids])

  // 这个 callback 会在 Module.onload 中调用
  mod.callback = function() {
    var exports = []
    var uris = mod.resolve()

    for (var i = 0, len = uris.length; i < len; i++) {
      exports[i] = cachedMods[uris[i]].exec()
    }

    if (callback) {
      callback.apply(global, exports)
    }

    delete mod.callback
  }

  // 无需物理抓取直接加载这个模块
  mod.load()
}


// Public API
// 用来在页面中加载一个或多个模块作为入口。
// 这些模块会作为 data.cwd + "_use_" + cid() 这个模块的依赖 被抓取。  
seajs.use = function(ids, callback) {
  Module.use(ids, callback, data.cwd + "_use_" + cid())
  return seajs
}

Module.define.cmd = {}
global.define = Module.define


// For Developers

seajs.Module = Module
data.fetchedList = fetchedList
data.cid = cid

seajs.require = function(id) {
  var mod = Module.get(Module.resolve(id))
  if (mod.status < STATUS.EXECUTING) {
    mod.onload()
    mod.exec()
  }
  return mod.exports
}


/**
 * config.js - The configuration for the loader
 */

// The root path to use for id2uri parsing
data.base = loaderDir

// The loader directory
data.dir = loaderDir

// The current working directory
data.cwd = cwd

// The charset for requesting files
data.charset = "utf-8"

// data.alias - An object containing shorthands of module id
// data.paths - An object containing path shorthands in module id
// data.vars - The {xxx} variables in module id
// data.map - An array containing rules to map module uri
// data.debug - Debug mode. The default value is false

seajs.config = function(configData) {

  for (var key in configData) {
    var curr = configData[key]
    var prev = data[key]

    // Merge object config such as alias, vars
    if (prev && isObject(prev)) {
      for (var k in curr) {
        prev[k] = curr[k]
      }
    }
    else {
      // Concat array config such as map
      if (isArray(prev)) {
        curr = prev.concat(curr)
      }
      // Make sure that `data.base` is an absolute path
      else if (key === "base") {
        // Make sure end with "/"
        if (curr.slice(-1) !== "/") {
          curr += "/"
        }
        curr = addBase(curr)
      }

      // Set config
      data[key] = curr
    }
  }

  emit("config", configData)
  return seajs
}

})(this);
