import BaseModel from "./BaseModel.js"

const { Types } = BaseModel

const COLUMNS = {
  // 用户ID，qq为数字
  ltuid: {
    type: Types.INTEGER,
    primaryKey: true
  },

  // MysUser类型，mys / hoyolab
  type: {
    type: Types.STRING,
    defaultValue: "fp",
    notNull: true
  },

  device_fp: Types.JSON
}

class MysFp extends BaseModel {
  static async find(ltuid = "", create = false) {
    // DB查询
    let mys = await MysFp.findByPk(ltuid)
    if (!mys && create) {
      mys = await MysFp.build({
        ltuid
      })
    }
    return mys || false
  }

  async saveDB(mys) {
    if (!mys.device_fp) {
      return false
    }
    let db = this
    this.type = "fp"
    this.device_fp = mys.device_fp
    await db.save()
  }
}

BaseModel.initDB(MysFp, COLUMNS)
await MysFp.sync()

export default MysFp
