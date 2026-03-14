import { MysFp } from "./db/index.js"

export default class devicefp {
  async bindDevice(e, message, cookie) {
    let db = await MysFp.find(cookie.ltuid, true)
    try {
      const info = JSON.parse(message)
      if (!this.validateDeviceInfo(info)) {
        if (info?.device_fp) {
          let data = info
          const parse = { data }
          await db.saveDB({ device_fp: parse })
          e.reply("绑定成功")
          return false
        }
        e.reply("设备信息格式错误", false, { at: true, recallMsg: 100 })
        return false
      }

      const { deviceName, deviceModel, oaid, deviceFingerprint, deviceBoard } = info
      const deviceBrand = deviceFingerprint.split("/")[0]

      let fpResponse = await fetch("https://public-data-api.mihoyo.com/device-fp/api/getFp", {
        method: "post",
        headers: {
          "Host": "public-data-api.mihoyo.com",
          "User-Agent": "okhttp/4.9.3"
        },
        body: JSON.stringify({
          app_name: "bbs_cn",
          bbs_device_id: `${this.getDeviceGuid()}`,
          device_fp: "38d80737ce6f3",
          device_id: `${this.getSeed_id()}`,
          ext_fields: `{"proxyStatus":1,"isRoot":0,"romCapacity":"512","deviceName":"DCO-AL00","productName":"${deviceModel}","romRemain":"434","hostname":"a11-gz02-test.i.nease.net","screenSize":"1440x2560","isTablet":0,"aaid":"${this.getDeviceGuid()}","model":"${deviceModel}","brand":"${deviceBrand}","hardware":"${deviceBrand}","deviceType":"${deviceName}","devId":"REL","serialNumber":"unknown","sdCapacity":127991,"buildTime":"1731038709000","buildUser":"builder001","simState":5,"ramRemain":"125933","appUpdateTimeDiff":1741848587885,"deviceInfo":"${deviceFingerprint}","vaid":"${this.getDeviceGuid()}","buildType":"user","sdkVersion":"32","ui_mode":"UI_MODE_TYPE_NORMAL","isMockLocation":0,"cpuType":"arm64-v8a","isAirMode":0,"ringMode":2,"chargeStatus":1,"manufacturer":"${deviceBrand}","emulatorStatus":0,"appMemory":"512","osVersion":"12","vendor":"unknown","accelerometer":"0.10001241x9.800007x0.1999938","sdRemain":119363,"buildTags":"release-keys","packageName":"com.mihoyo.hyperion","networkType":"WiFi","oaid":"${oaid}","debugStatus":0,"ramCapacity":"127991","magnetometer":"15.625x-28.25x-32.625","display":"${deviceModel}","appInstallTimeDiff":1733055335683,"packageVersion":"2.35.0","gyroscope":"0.0x0.0x0.0","batteryStatus":99,"hasKeyboard":1,"board":"${deviceBoard}"}`,
          platform: "2",
          seed_id: `${this.getDeviceGuid()}`,
          seed_time: new Date().getTime() + ""
        })
      })

      if (!fpResponse.ok) {
        throw new Error("Failed to get device fingerprint")
      }

      const device_fp = await fpResponse.json()
      logger.debug(device_fp)

      await db.saveDB({ device_fp })
      e.reply("绑定成功")
    } catch (error) {
      logger.error("Error binding device:", error)
      e.reply("设备信息格式错误")
    }
  }

  validateDeviceInfo(info) {
    // 验证设备信息逻辑
    return (
      info &&
      info.deviceName &&
      info.deviceModel &&
      info.oaid &&
      info.deviceFingerprint &&
      info.deviceProduct &&
      info.deviceBoard
    )
  }

  getDeviceGuid() {
    function S4() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
    }

    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4())
  }

  getSeed_id(length = 16) {
    const characters = "0123456789abcdef"
    let result = ""
    for (let i = 0; i < length; i++) {
      result += characters[Math.floor(Math.random() * characters.length)]
    }
    return result
  }
}
