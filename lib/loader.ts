import { existsSync } from 'fs'
import { join } from 'path'
import _ from 'lodash'
import matter from 'gray-matter'
import { loader } from 'webpack'
import { getOptions, OptionObject } from 'loader-utils'
import { Nuxtent } from '../types'
import MarkdownIt from 'markdown-it'
import { logger } from './utils'

type ContentOptions = Array<[string, Nuxtent.Config.Content]>

function getDirOpts(contentOptions: ContentOptions, section: string) {
  // configuration options can be for root files ('/') but regex for section also
  // captures closest subsection, so we first check that since you can't configure
  // both root files and nested sections
  const [, content = null] =
    contentOptions.find(([folder]) => {
      return folder === '/' || folder === section
    }) || []
  return content
}

function getSection(dirPath: string): string {
  // capture '/content/closestSubsection' or  '/content'
  const match = dirPath.match(/[/\\]content[/\\]([\w\-_\s]+|$)/)
  if (match) {
    return match[1] === '' ? '/' : match[1]
  }
  return '/'
}

const insertCodePlugin = (md: MarkdownIt) => {
  const RE = /\s*{([^}]+)}/

  const parseOptions = (str: string) => {
    if (!RE.test(str)) {
      return {}
    }
    const [, options] = RE.exec(str) || ['', '']
    const fn = new Function(`return {${options}}`) // eslint-disable-line no-new-func
    return fn()
  }

  const { fence } = md.renderer.rules
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const info = parseOptions(token.info)
    if (!info.insert) {
      return self.renderToken([token], idx, options)
    }
    const res = fence(tokens, idx, options, env, self)
    if (info.insert === 'above') {
      return `${token.content}${res}`
    }
    if (info.insert === 'below') {
      return `${res}${token.content}`
    }
    return res
  }
}

const extractPlugin = (md: MarkdownIt) => {
  const RE = /^<(script|style)(?=(\s|>|$))/i

  md.renderer.rules.html_block = (tokens, idx, options, env) => {
    const content = tokens[idx].content
    const hoistedTags = env.hoistedTags || (env.hoistedTags = [])
    if (RE.test(content.trim())) {
      hoistedTags.push(content)
      return ''
    }
    return content
  }
}
export default function nuxtentLoader(
  this: loader.LoaderContext,
  source: string
) {
  const moduleOpts = getOptions(this)
  const content: ContentOptions = moduleOpts.content

  const section = getSection(this.context)
  const dirOpts = getDirOpts(content, section)
  if (!dirOpts) {
    logger.debug(
      `The folder ${section} is not configured in nuxtent and therefore ignored`
    )
    return
  }

  const [, fileName = ''] =
    this.resourcePath.match(/[/\\]content([/\\\w\-_]*)(\.comp\.md$)?|$/) || []
  if (!fileName) {
    this.emitError(new Error('The resource is not a markdown file'))
  }

  if (!dirOpts.markdown.parser) {
    return this.emitError(new Error('Could not found markdown parser'))
  }

  const frontmatter = matter(source)
  const env = {
    hoistedTags: []
  }
  const md = dirOpts.markdown.parser
  // We do need html
  md.set({ html: true })
  md.use(extractPlugin)
  md.use(insertCodePlugin)
  const html = md.render(frontmatter.content, env)
  const component = `<template><div class="nuxtent-content">${html}</div></template>
${env.hoistedTags ? env.hoistedTags.join('\n\n') : ''}`
  return component
}
