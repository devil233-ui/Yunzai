// 插件作者 xiaotian2333
// 开源地址 https://github.com/xiaotian2333/yunzai-plugins-Single-file
// README功能移植自https://github.com/cscs181/QQ-GitHub-Bot

import fetch from 'node-fetch'
import fs from 'fs'
import puppeteer from 'puppeteer'

const baseurl = 'https://opengraph.githubassets.com/xiaotian'
const readmeSelector = 'article.markdown-body'
const repoTagCache = globalThis.ghRepoTagCache ||= new Map()
const repoTagExpire = 24 * 60 * 60 * 1000
const repoTagLimit = 1000
let readmeBrowser
let browserLaunching
let browserIdleTimer

function chromiumPath() {
  return ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']
    .find(path => fs.existsSync(path)) || puppeteer.executablePath()
}

function delayBrowserClose() {
  clearTimeout(browserIdleTimer)
  browserIdleTimer = setTimeout(async () => {
    const browser = readmeBrowser
    readmeBrowser = null
    if (browser) await browser.close().catch(() => {})
  }, 180000)
  browserIdleTimer.unref?.()
}

async function getBrowser() {
  if (readmeBrowser?.isConnected()) {
    delayBrowserClose()
    return readmeBrowser
  }
  if (!browserLaunching) {
    browserLaunching = puppeteer.launch({
      headless: true,
      executablePath: chromiumPath(),
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--mute-audio']
    }).then(browser => {
      readmeBrowser = browser
      browser.on('disconnected', () => {
        if (readmeBrowser === browser) readmeBrowser = null
      })
      return browser
    }).finally(() => { browserLaunching = null })
  }
  return browserLaunching
}

function parseRepository(input) {
  const value = input.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git\/?$/i, '')
  const match = value.match(/^([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)\/([a-z\d._-]{1,100})\/?$/i)
  return match ? { owner: match[1], repo: match[2] } : null
}

function rememberRepoTag(messageId, repository) {
  if (!messageId || !repository) return
  repoTagCache.set(String(messageId), { ...repository, expiresAt: Date.now() + repoTagExpire })
  while (repoTagCache.size > repoTagLimit) repoTagCache.delete(repoTagCache.keys().next().value)
}

function getRepoTag(messageId) {
  if (!messageId) return null
  const tag = repoTagCache.get(String(messageId))
  if (!tag) return null
  if (tag.expiresAt < Date.now()) {
    repoTagCache.delete(String(messageId))
    return null
  }
  return { owner: tag.owner, repo: tag.repo }
}

function getReplyId(e) {
  return e.source?.message_id || e.source?.id || e.reply_id || e.message?.find(item => item.type === 'reply')?.id || e.message?.find(item => item.type === 'reply')?.data?.id
}

async function getRepliedMessage(e) {
  if (typeof e.getReply === 'function') {
    try {
      const message = await e.getReply()
      if (message) return message
    } catch {}
  }
  const messageId = getReplyId(e)
  if (!messageId) return null
  try {
    const result = await e.bot?.getMsg?.(messageId) || await e.bot?.sendApi?.('get_msg', { message_id: messageId }) || await e.bot?.callApi?.('get_msg', { message_id: messageId })
    return result?.data || result
  } catch {
    return null
  }
}

function extractRepositoryFromMessage(message) {
  if (!message) return null
  const raw = typeof message === 'string' ? message : [message.raw_message, message.text, message.message, message.content].filter(Boolean).join(' ')
  const link = raw.match(/(?:https?:\/\/)?github\.com\/[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[a-z\d._-]{1,100}/i)
  return link ? parseRepository(link[0]) : null
}

async function resolveReadmeRepository(e, input) {
  if (input.trim()) return parseRepository(input)
  const messageId = getReplyId(e)
  const tagged = getRepoTag(messageId)
  if (tagged) return tagged
  return extractRepositoryFromMessage(await getRepliedMessage(e))
}

function replyMessageId(result) {
  return result?.message_id || result?.data?.message_id || result?.id
}

async function renderReadme(owner, repo) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 900, height: 800, deviceScaleFactor: 1 })
    await page.setRequestInterception(true)
    page.on('request', request => ['media', 'font'].includes(request.resourceType()) ? request.abort() : request.continue())
    const response = await page.goto(`https://github.com/${owner}/${repo}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    if (response?.status() === 404) throw new Error('REPOSITORY_NOT_FOUND')
    if (!response?.ok()) throw new Error(`GITHUB_HTTP_${response?.status() || 'UNKNOWN'}`)

    let readme
    try {
      readme = await page.waitForSelector(readmeSelector, { timeout: 15000 })
    } catch {
      throw new Error('README_NOT_FOUND')
    }
    await page.evaluate(async selector => {
      const root = document.querySelector(selector)
      root?.querySelectorAll('details').forEach(element => { element.open = true })
      const images = [...(root?.querySelectorAll('img') || [])]
      await Promise.race([
        Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolve => {
          image.addEventListener('load', resolve, { once: true })
          image.addEventListener('error', resolve, { once: true })
        }))),
        new Promise(resolve => setTimeout(resolve, 5000))
      ])
    }, readmeSelector)
    const box = await readme.boundingBox()
    if (!box) throw new Error('README_NOT_VISIBLE')
    await page.evaluate(selector => document.querySelector(selector)?.scrollIntoView({ block: 'start' }), readmeSelector)
    return await page.screenshot({
      type: 'jpeg',
      quality: 88,
      clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 10000) }
    })
  } finally {
    await page.close().catch(() => {})
    delayBrowserClose()
  }
}

export class example extends plugin {
  constructor() {
    super({
      name: 'GH仓库',
      dsc: '检测GitHub链接时发送仓库速览图，并支持查看仓库README',
      event: 'message',
      priority: -114514,
      rule: [
        { reg: '^[/#]?(?:readme|仓库说明)(?:\\s+.*)?$', fnc: 'readme' },
        { reg: '^(https://|http://)?github.com/[a-zA-Z0-9-]{1,39}/[a-zA-Z0-9_-]{1,100}(.git)?', fnc: 'start' }
      ]
    })
  }

  async readme(e) {
    const input = e.msg.replace(/^[/#]?(?:readme|仓库说明)\s*/i, '')
    const repository = await resolveReadmeRepository(e, input)
    if (!repository) {
      await e.reply(input.trim()
        ? `仓库名${input.trim()}错误，请使用owner/repo格式`
        : '请发送或引用要查看README的GitHub仓库，例如：/readme owner/repo')
      return true
    }
    try {
      const image = await renderReadme(repository.owner, repository.repo)
      const result = await e.reply(segment.image(image))
      rememberRepoTag(replyMessageId(result), repository)
    } catch (error) {
      if (error.message === 'REPOSITORY_NOT_FOUND') await e.reply('未找到该仓库，请确认仓库存在且可公开访问')
      else if (error.message === 'README_NOT_FOUND') await e.reply('未找到该仓库的README')
      else if (error.name === 'TimeoutError') await e.reply('获取或生成README图片超时，请稍后再试')
      else {
        logger.error(`[GH仓库]生成README图片失败：${error.stack || error.message}`)
        await e.reply('生成README图片出错，请稍后再试')
      }
    }
    return true
  }

  async start(e) {
    let msg = e.msg.replace('https://', '').replace('http://', '').replace('.git', '')
    if (!msg) return
    const name = msg.split('/')[1]
    const repo = msg.split('/')[2]
    let url = baseurl + '/' + name + '/' + repo
    let issueOrPR = msg.split('/')[3]
    if (issueOrPR == 'issues' || issueOrPR == 'pull' || issueOrPR == 'commit') {
      const Quantity = msg.split('/')[4]
      if (Quantity && (/^\d+$/.test(Quantity) || /^[a-f0-9]{40}$/.test(Quantity))) {
        try {
          const res = await fetch(`https://github.com/${name}/${repo}/${issueOrPR}/${Quantity}`, { method: 'HEAD', redirect: 'follow' })
          if (res.url.includes('/pull/')) issueOrPR = 'pull'
          else if (res.url.includes('/issues/')) issueOrPR = 'issues'
        } catch (err) {
          logger.error(`[GH仓库]真实地址检测失败：${err.message}`)
        }
        url += '/' + issueOrPR + '/' + Quantity
      }
    }
    const result = await e.reply(segment.image(url))
    rememberRepoTag(replyMessageId(result), { owner: name, repo })
    return false
  }
}
