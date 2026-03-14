import path from "node:path"
import fs from "node:fs/promises"
import { Sequelize, DataTypes, Model } from "sequelize"
import cfg from "../../../../lib/config/config.js"

if (cfg.db.dialect === "sqlite") await fs.mkdir(path.dirname(cfg.db.storage), { recursive: true })
const sequelize = new Sequelize(cfg.db)

await sequelize.authenticate()

export default class BaseModel extends Model {
  static Types = DataTypes

  static initDB(model, columns) {
    let name = model.name
    name = name.replace(/DB$/, "s")
    model.init(columns, { sequelize, tableName: name })
    model.COLUMNS = columns
  }
}
export { sequelize }
