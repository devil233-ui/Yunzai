import cfg from "../../../lib/config/config.js"
import { Common, Version } from "#miao"
import { Character } from "#miao.models"
import _ from "lodash" // 引入 lodash 以防万一

export default class base {
  constructor(e = {}) {
    this.e = e
    this.userId = e?.user_id
    this.model = "genshin"
    this._path = process.cwd().replace(/\\/g, "/")
  }

  get prefix() {
    return `Yz:genshin:${this.model}:`
  }

  // 统一封装渲染
  async renderImg(tpl, data, cfg = {}) {
    return Common.render("genshin", `html/${tpl}`, data, {
      ...cfg,
      e: this.e
    })
  }

  /**
   * 截图默认数据
   * @param saveId html保存id
   * @param tplFile 模板html路径
   * @param pluResPath 插件资源路径
   */
  get screenData() {
    // 【修复1】更稳妥的版本号获取方式
    let currentVersion
    try {
        // 尝试使用 qsyhh 原版的方式读取
        let log = Version.readLogFile("root")
        currentVersion = log?.currentVersion || Version.yunzai
    } catch (err) {
        // 如果报错（TRSS可能没有这个文件），则使用通用的获取方式
        currentVersion = Version.yunzai
    }

    const layoutPath = process.cwd() + "/plugins/genshin/resources/html/layout/"
    
    // 【修复2】兼容 TRSS，不再直接 return
    let yzName = cfg.package.name
    if (yzName == "miao-yunzai") {
      yzName = "Miao-Yunzai"
    } else if (yzName == "trss-yunzai") {
      yzName = "TRSS-Yunzai" // 识别 TRSS
    } else {
      // 即使是其他改版，也给个默认名字，而不是直接 return 导致功能崩溃
      yzName = _.capitalize(yzName) || "Yunzai-Bot" 
    }

    let data = {
      saveId: this.userId,
      cwd: this._path,
      yzVersion: `${currentVersion}`,
      yzName,
      genshinLayout: layoutPath + "genshin.html",
      newdefLayout: layoutPath + "default.html"
    }
    
    // 下面保留 qsyhh 原版关于星铁和原神背景图的逻辑
    if (this.e?.isSr) {
      let char = Character.get("黑天鹅", "sr")
      return {
        ...data,
        tplFile: `./plugins/genshin/resources/StarRail/html/${this.model}/${this.model}.html`,
        /** 绝对路径 */
        pluResPath: `${this._path}/plugins/genshin/resources/StarRail/`,
        srtempFile: "StarRail/",
        headImg: char?.imgs?.banner,
        game: "sr"
      }
    }
    
    let char = Character.get("闲云", "gs")
    return {
      ...data,
      // 这里的路径结构 ./plugins/genshin/resources/html/mysNews/mysNews.html
      // 正好对应你 ls 查看到的文件结构，所以不需要改
      tplFile: `./plugins/genshin/resources/html/${this.model}/${this.model}.html`,
      /** 绝对路径 */
      pluResPath: `${this._path}/plugins/genshin/resources/`,
      headImg: char?.imgs?.banner,
      srtempFile: "",
      game: "gs"
    }
  }
}