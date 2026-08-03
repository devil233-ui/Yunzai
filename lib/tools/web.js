import express from "express"
import template from "express-art-template"
import fs from "node:fs/promises"
import path from "node:path"
import lodash from "lodash"

/*
 * npm run app web-debug开启Bot后
 * 可另外通过 npm run web 开启浏览器调试
 * 访问 http://localhost:8000/ 即可看到对应页面
 * 页面内的资源需使用 {{_res_path}}来作为resources目录的根目录
 * 可编辑模板与页面查看效果
 * todo: 预览页面的热更
 *
 * */

let app = express()

let _path = process.cwd()

app.engine("html", template)
app.set("views", _path + "/resources/")
app.set("view engine", "art")
app.use(express.static(_path + "/resources"))
app.use("/plugins", express.static("plugins"))

const viewDataRoot = path.resolve(_path, "temp/ViewData")

function safeSegment(segment) {
  return (
    typeof segment === "string" &&
    segment.length > 0 &&
    !/[/\\]/.test(segment) &&
    segment !== "." &&
    segment !== ".."
  )
}

app.get("/", async function(req, res) {
  let html = [
    "在npm run web-dev模式下触发截图消息后，可在下方选择页面进行调试",
    "如果页面内资源路径不正确请使用{{_res_path}}作为根路径，对应之前的../../../../",
    "可直接修改模板html或css刷新查看效果",
  ]
  let li = {}

  try {
    const pluginList = await fs.readdir(viewDataRoot, { withFileTypes: true })
    for (const pluginEntry of pluginList) {
      const plugin = pluginEntry.name
      if (!pluginEntry.isDirectory() || !safeSegment(plugin)) continue

      const fileList = await fs.readdir(path.join(viewDataRoot, plugin), { withFileTypes: true })
      for (const fileEntry of fileList) {
        if (!fileEntry.isFile()) continue
        const ret = /(.+)\.json$/.exec(fileEntry.name)
        if (ret && ret[1]) {
          let text = [ plugin, ...ret[1].split("_") ]
          li[text.join("")] =
            `<li style="font-size:18px; line-height:30px;"><a href="/${plugin}_${ret[1]}">${text.join(" / ")}</a></li>`
        }
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(err)
      return res.status(500).send("读取调试数据失败")
    }
  }

  res.send(html.join("</br>") + "<ul>" + lodash.values(li).join("") + "</ul>")
})

app.get("/:page", async function(req, res) {
  let [ plugin, app, ...page ] = req.params.page.split("_")
  page = page.join("_")
  if (plugin == "favicon.ico") {
    return res.send("")
  }

  if (!safeSegment(plugin) || !safeSegment(app) || !safeSegment(page)) {
    return res.status(404).send("页面不存在")
  }

  const dataPath = path.resolve(viewDataRoot, plugin, `${app}_${page}.json`)
  if (!dataPath.startsWith(viewDataRoot + path.sep)) {
    return res.status(404).send("页面不存在")
  }

  let data
  try {
    data = JSON.parse(await fs.readFile(dataPath, "utf8"))
  } catch (err) {
    console.error(`读取页面数据失败: ${dataPath}`, err)
    return res.status(404).send("页面数据不存在或格式错误")
  }
  data = data || {}
  data._res_path = ""
  data._sys_res_path = data._res_path

  if (data._plugin) {
    data._res_path = `/plugins/${data._plugin}/resources/`
    data.pluResPath = data._res_path
  }
  let htmlPath = ""
  let tplPath = `${app}/${htmlPath}${page}/${page}.html`
  if (data._plugin) {
    tplPath = `../plugins/${data._plugin}/resources/${htmlPath}/${app}/${page.split("_").join("/")}.html`
  } else if (data._no_type_path) {
    tplPath = `${app}/${page}.html`
  }
  res.render(tplPath, data, (err, html) => {
    if (err) {
      console.error(err)
      return res.status(404).send(`模板渲染失败：${tplPath}`)
    }
    res.send(html)
  })
})

const port = Number.parseInt(process.env.YZ_WEB_PORT, 10) || 8000
app.listen(port)
console.log(`页面服务已启动，触发消息图片后访问 http://localhost:${port}/ 调试页面`)
