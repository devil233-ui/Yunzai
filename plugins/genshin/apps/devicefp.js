import MysInfo from "../model/mys/mysInfo.js"
import devicefp from "../model/devicefp.js"

export class device extends plugin {
  constructor() {
    super({
      name: "绑定设备",
      priority: 100,
      namespace: "绑定设备",
      rule: [
        {
          reg: "^#(原神|星铁|绝区零)?绑定设备([\\s\\S]*)$",
          fnc: "device"
        },
        {
          reg: "#?绑定帮助",
          fnc: "help"
        }
      ]
    })
  }

    async device(e) {
    // 【1. 优先处理取消逻辑】
    // 只要消息里包含"取消"，直接结束，不再往下走
    if (this.e.msg && this.e.msg.includes("取消")) {
      this.finish("device")
      return e.reply("已取消绑定", true)
    }

    // 【2. 鲁棒的提取逻辑】
    // 使用 match 寻找字符串中第一对大括号 {} 包裹的内容
    // [\s\S]* 意思是匹配任意字符（包括换行符），解决了多行JSON匹配不到的问题
    let jsonMatch = this.e.msg.match(/\{[\s\S]*\}/)
    let message = jsonMatch ? jsonMatch[0] : ""

    // 【3. 必要的校验逻辑】
    let uid = await MysInfo.getUid(e, false)
    if (!uid) return false
    
    let ck = await MysInfo.checkUidBing(uid, e)
    if (!ck) return e.reply([ "请先绑定ck再使用绑定设备~" ], true)

    // 【4. 判断是否提取到了有效信息】
    if (!message) {
      // 没提取到 JSON，说明用户可能只发了指令但没发内容，或者发的内容格式完全不对
      this.setContext("device")
      return e.reply([ "请发送设备信息(建议私聊发送)，或者发送“取消”取消绑定" ], true)
    }

    // 【5. 执行绑定】
    try {
      await new devicefp().bindDevice(e, message, ck)
    } catch (err) {
      // 额外的保护：防止 bindDevice 内部报错导致程序崩溃
      e.reply("绑定过程中发生错误，请检查JSON格式是否正确。")
      console.error(err)
    }
    
    this.finish("device")
    return true
  }


  async help(e) {
    const msg = [
      {
        nickname: this.e.sender.card || this.e.user_id,
        user_id: this.e.user_id,
        message: [
          "绑定设备帮助\n",
          "方法一（仅适用于安卓设备）：\n",
          "https://ghproxy.mihomo.me/https://raw.githubusercontent.com/forchannot/get_device_info/main/app/build/outputs/apk/debug/app-debug.apk\n",
          "1. 使用常用米游社手机下载以上APK，并安装\n",
          "2. 打开后点击按钮复制\n",
          "3. 注！！！！：得到的设备信息最后面oaid后面不是error才行\n",
          segment.image("./plugins/genshin/resources/img/devicefp/id.png"),
          "4. 给机器人发送\"#绑定设备\"指令\n",
          "5. 机器人会提示发送设备信息\n",
          "6. 粘贴设备信息发送\n",
          "7. 提示绑定成功"
        ]
      }, {
        nickname: this.e.sender.card || this.e.user_id,
        user_id: this.e.user_id,
        message: [
          "方法二（推荐使用这个方法，有能力的使用）：\n",
          "1. 使用抓包软件,抓取米游社APP的请求\n",
          "2. 在请求头内找到【x-rpc-device_id】和【x-rpc-device_fp】\n",
          "3. 自行构造如下格式的信息：{\"device_id\": \"x-rpc-device_id的内容\", \"device_fp\": \"x-rpc-device_fp的内容\"}\n",
          "4. 给机器人发送\"#绑定设备\"指令\n",
          "5. 机器人会提示发送设备信息\n",
          "6. 粘贴设备信息发送\n",
          "7. 提示绑定成功"
        ]
      }
    ]
    return e.reply(await Bot.makeForwardMsg(msg))
  }
}
