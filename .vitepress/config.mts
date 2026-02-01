import { defineConfig } from 'vitepress'

export default defineConfig({
    base: '/mivitedoc/',
  title: "minglie",
  description: "my doc",
  // 明确指定源文件目录为 docs（和启动命令对应）
  srcDir: 'src',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },          // 对应 docs/index.md
      { text: 'Examples', link: '/markdown-examples' },  // 对应 docs/markdown-examples.md
      { text: '数学', link: '/math/' }      // 对应 docs/math/index.md
    ],
    sidebar: {
      // 根路径（/）：对应 docs/index.md
      '/': [
        {
          text: '总导航',
          items: [
            { text: 'Examples', link: '/markdown-examples' }
          ]
        }
      ],
      // /markdown-examples/ 路径：匹配 docs/markdown-examples.md
      '/markdown-examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Markdown Examples', link: '/markdown-examples' },
            { text: 'Runtime API Examples', link: '/api-examples' }
          ]
        }
      ],
      // /math/ 路径：匹配 docs/math/ 下的文件
      '/math/': [
        {
     
          items: [
            { text: '逻辑', link: '/math/逻辑对偶蕴含.md' },        // 对应 docs/math/index.md
            { text: '8位CPU设计', link: '/math/8位CPU设计m8_cpu.md' }  // 对应 docs/math/formula.md
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ],
     search: {
      provider: 'local'
    },
    
  },
   markdown: {
        math: true
    }
})