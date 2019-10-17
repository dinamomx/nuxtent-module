// @ts-nocheck
import Vue from 'vue'

import {
  interopDefault
} from './utils'

const mdComps = {
  <% options.components.forEach(([relativePath, filePath]) => {
  print(`
    '${relativePath}': () => interopDefault(import('${filePath}')),`
  )})
%>
}


Vue.component('nuxtent-body', {
  name: 'NuxtentBody',
  functional: true,
  props: {
    tag: {
      type: String,
      default: 'div',
    },
    body: {
      type: [Object, String],
      required: true,
    },
  },
  render(h, ctx) {
    const body = ctx.props.body || ''
    const tag = ctx.props.tag
    if (typeof body === 'object') {
      if (body.relativePath) {
        const MarkdownComponent = mdComps[body.relativePath]
        return h(MarkdownComponent, ctx.data)
      }
      return h(tag, {
        ...ctx.data,
        domProps: { innerHTML: JSON.stringify(body), ...ctx.data.domProps },
      })
    } else {
      return h(tag, {
        ...ctx.data,
        domProps: { innerHTML: body, ...ctx.data.domProps },
      })
    }
  },
})
