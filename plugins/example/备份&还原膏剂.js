//作者：860563585
//修改：玖、TRAE（kimi）、Gemini (专属定制最终版)、devil
import plugin from '../../lib/plugins/plugin.js'
import common from "../../lib/common/common.js"
import path from 'path'
import fs from 'fs'
import YAML from 'yaml'
import { execSync } from 'child_process'

// ================= 配置区域 =================

// 1. 【插件Data白名单】
const DATA_BACKUP_PLUGINS = []

// 2. 【自定义备份列表】
const CUSTOM_BACKUP_LIST = [
    'plugins/Atlas/Genshin-Atlas/othername',
    'plugins/Atlas/star-rail-atlas/othername',
    'plugins/Atlas/zzz-atlas/othername'
]

// 3. 【忽略名单】
const IGNORE_DIR_NAMES = ['.git', 'node_modules', '.idea', '.vscode', '.DS_Store']

// ===========================================

const bfPath = path.join(process.cwd(), '/resources/bf/')
const pluginsPath = path.join(process.cwd(), '/plugins/')
const mapPath = path.join(bfPath, 'restore_map.json') 

export class Backup_Restore extends plugin {
    constructor(e) {
        super({
            name: '[备份|还原]',
            dsc: '备份',
            event: 'message',
            priority: 10,
            rule: [
                {
                    reg: '^#?(配置文件)?备份$',
                    fnc: 'bf'
                },
                {
                    reg: '^#?(配置文件)?还原$',
                    fnc: 'hy'
                },
            ]
        })
    }

    async bf(e) {
        if (!e.isMaster) return false
        
        let coreDetails = []
        let customDetails = []
        let pluginDetails = []
        let errorDetails = []
        let restoreMap = {} 
        
        let pluginList = []
        try {
            pluginList = fs.readdirSync(pluginsPath)
        } catch (error) {
            e.reply('读取 plugins 目录失败')
            return
        }
        
        if (!fs.existsSync(bfPath)) fs.mkdirSync(bfPath, { recursive: true })

        this.reply('开始备份...正在处理数据...')
        await common.sleep(2000)

        // --- 1. 基础备份 (Config & Data) ---
        try {
            // Config
            copyFilesSync('./config/config', path.join(bfPath, 'config/config'))
            const configDest = path.join(bfPath, 'config')
            if (!fs.existsSync(configDest)) fs.mkdirSync(configDest, { recursive: true })
            const configItems = fs.readdirSync('./config', { withFileTypes: true })
            let rootFileCount = 0
            for (let item of configItems) {
                if (item.isFile()) {
                    fs.copyFileSync(path.join('./config', item.name), path.join(configDest, item.name))
                    rootFileCount++
                }
            }
            restoreMap['config'] = 'config' 
            coreDetails.push(`Config配置(含${rootFileCount}个根文件)`)

            // Data
            copyFilesSync('./data', path.join(bfPath, 'data'))
            restoreMap['data'] = 'data'
            coreDetails.push('Data数据目录')

            // Redis
            if (fs.existsSync('dump.rdb')) {
                fs.copyFileSync('dump.rdb', path.join(bfPath, 'dump.rdb'))
                restoreMap['dump.rdb'] = 'dump.rdb'
                coreDetails.push('Redis数据库(dump.rdb)')
            }
        } catch (error) {
            console.error('[备份] 核心配置失败:', error)
            errorDetails.push('核心配置(Config/Data)')
        }

        // --- 2. 插件备份 ---
        for (let p of pluginList) {
            try {
                let parts = []
                // config
                let src = path.join(pluginsPath, p, 'config')
                if (fs.existsSync(src)) {
                    copyFilesSync(src, path.join(bfPath, p, 'config'))
                    parts.push('配置')
                }

                // data
                if (DATA_BACKUP_PLUGINS.includes(p)) {
                    let dataSrc = path.join(pluginsPath, p, 'data')
                    if (fs.existsSync(dataSrc)) {
                        copyFilesSync(dataSrc, path.join(bfPath, p, 'data'))
                        parts.push('数据')
                    }
                }

                // help
                if (p == 'miao-plugin') {
                    let helpSrc = path.join(pluginsPath, p, 'resources/help')
                    if (fs.existsSync(helpSrc)) {
                        copyFilesSync(helpSrc, path.join(bfPath, p, 'resources/help'))
                        parts.push('Help')
                    }
                }

                if (parts.length > 0 || p === 'example') {
                    if(p === 'example') {
                         copyFilesSync(path.join(pluginsPath, p), path.join(bfPath, p))
                         parts.push('全部')
                    }
                    restoreMap[p] = `plugins/${p}`
                    let desc = parts.length > 0 ? `[${parts.join('+')}]` : ''
                    pluginDetails.push(`${p}${desc}`)
                }
            } catch (error) {
                errorDetails.push(`插件: ${p}`)
            }
        }

        // --- 3. 自定义列表备份 ---
        for (let customPath of CUSTOM_BACKUP_LIST) {
            try {
                if (!fs.existsSync(customPath)) {
                    errorDetails.push(`自定义不存在: ${customPath}`)
                    continue
                }

                const safeName = customPath.replace(/[\\/]/g, '_')
                const dest = path.join(bfPath, safeName)
                
                const stat = fs.statSync(customPath)
                if(stat.isDirectory()) {
                    copyFilesSync(customPath, dest)
                } else {
                    fs.copyFileSync(customPath, dest)
                }

                restoreMap[safeName] = customPath
                customDetails.push(customPath)
            } catch (e) {
                console.error(e)
                errorDetails.push(`自定义失败: ${customPath}`)
            }
        }

        // --- 4. 收尾 (写入链接和映射) ---
        try {
            const urls = await getGitUrls()
            fs.writeFileSync(path.join(bfPath, 'pluginurl.yaml'), YAML.stringify(urls), 'utf8')
            fs.writeFileSync(mapPath, JSON.stringify(restoreMap, null, 2), 'utf8')
        } catch (e) {
            errorDetails.push('元数据生成')
        }

        // --- 5. 生成详细消息 ---
        let msg = [
            `✅ **备份完成！**`,
            `----------------`,
            `📦 **核心数据**：\n${coreDetails.join('、')}`,
            `----------------`,
            `📂 **自定义列表** (${customDetails.length}项)：\n${customDetails.length ? customDetails.join('\n') : '（无）'}`,
            `----------------`,
            `🧩 **插件数据** (${pluginDetails.length}个)：\n${pluginDetails.join('、')}`,
            `----------------`,
            `🔗 插件仓库链接已导出，还原映射表已生成。`
        ]

        if(errorDetails.length > 0) {
            msg.push(`----------------\n❌ **失败项**：\n${errorDetails.join('\n')}`)
        }

        let totalCount = coreDetails.length + customDetails.length + pluginDetails.length
        this.reply(await common.makeForwardMsg(e, msg, `备份清单：共${totalCount}项`))
    }

    async hy(e) {
        if (!e.isMaster) return false
        
        this.reply('还原中...正在解析还原映射表...')
        
        let downloadedPlugins = []
        try {
            downloadedPlugins = batchGitClone()
        } catch (err) {
            console.error('插件下载异常:', err)
        }

        let restoreMap = {}
        if (fs.existsSync(mapPath)) {
            try {
                restoreMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'))
            } catch (e) { console.error('映射表损坏') }
        }

        let ok = []
        let err = []
        if(fs.existsSync(bfPath)){
            let bfs = fs.readdirSync(bfPath)
            for (let b of bfs) {
                if (['pluginurl.yaml', 'restore_map.json'].includes(b)) continue

                try {
                    let targetPath
                    if (restoreMap[b]) {
                        targetPath = restoreMap[b]
                    } else {
                        if (['config', 'data', 'dump.rdb'].includes(b)) targetPath = b
                        else targetPath = `plugins/${b}`
                    }

                    const fullDest = path.resolve(process.cwd(), targetPath)
                    const destDir = path.dirname(fullDest)
                    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

                    const src = path.join(bfPath, b)
                    const stat = fs.statSync(src)
                    if (stat.isDirectory()) {
                        copyFilesSync(src, fullDest)
                    } else {
                        fs.copyFileSync(src, fullDest)
                    }
                    ok.push(b) 
                } catch (error) { 
                    err.push(b) 
                }
            }
        } else {
            this.reply("未找到备份目录 resources/bf")
            return
        }

        let pnpmResult = '无新增插件'
        if (downloadedPlugins.length > 0) {
            try {
                this.reply(`正在安装依赖...`)
                execSync('pnpm i', { stdio: 'inherit', timeout: 300000 })
                pnpmResult = '安装成功'
            } catch (err) {
                pnpmResult = '安装失败'
            }
        }

        let msg = [
            `✅ **还原完成！**`,
            `----------------`,
            `📥 **文件还原**：${ok.length} 个项目`,
            `⬇️ **插件下载**：${downloadedPlugins.length} 个`,
            `📦 **依赖安装**：${pnpmResult}`,
            `----------------`,
            `📜 **还原明细**：\n${ok.join('、')}`
        ]
        
        if(err.length) msg.push(`❌ **失败**：\n${err.join('、')}`)
        
        this.reply(await common.makeForwardMsg(e, msg, '还原报告'))
    }
}

// === 辅助函数 ===

async function getGitUrls() {
    const urls = {}
    
    // 只记录所有插件的 URL，去掉 Yunzai 本体逻辑
    const dirItems = fs.readdirSync(pluginsPath)
    for (let p of dirItems) {
        if(!fs.statSync(path.join(pluginsPath, p)).isDirectory()) continue;
        const gitConfig = path.join(pluginsPath, p, '.git', 'config')
        if (fs.existsSync(gitConfig)) {
            const content = fs.readFileSync(gitConfig, 'utf8')
            const match = content.match(/url\s*=\s*(.*)/)
            if (match) {
                urls[p] = match[1].trim()
            }
        }
    }
    return urls
}

// 【修改点】批量下载插件 - 采用浅克隆优化
function batchGitClone() {
    const backupUrlPath = path.join(bfPath, 'pluginurl.yaml')
    if (!fs.existsSync(backupUrlPath)) return []
    const urls = YAML.parse(fs.readFileSync(backupUrlPath, 'utf8'))
    const downloaded = []
    
    for (const [name, url] of Object.entries(urls)) {
        const target = path.join(pluginsPath, name)
        if (fs.existsSync(target)) continue
        try {
            console.log(`正在浅克隆 ${name}...`)
            // 【核心变化】添加了 --depth 1 参数
            execSync(`git clone --depth 1 "${url}" "${target}"`, { stdio: 'inherit' })
            downloaded.push(name)
        } catch (e) { 
            console.error(`[还原] 克隆 ${name} 失败: ${e.message}`) 
        }
    }
    return downloaded
}

function copyFilesSync(src, dest) {
    if (!fs.existsSync(src)) return
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
    let files
    try { files = fs.readdirSync(src, { withFileTypes: true }) } catch (e) { return }
    files.forEach(f => {
        if (IGNORE_DIR_NAMES.includes(f.name)) return
        const sPath = path.join(src, f.name)
        const dPath = path.join(dest, f.name)
        try {
            if (f.isDirectory()) copyFilesSync(sPath, dPath)
            else if (f.name != '备份.js') fs.copyFileSync(sPath, dPath)
        } catch (e) { console.error(`跳过 ${f.name}: ${e.message}`) }
    })
}