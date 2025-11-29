# EchoValley Admin

EchoValley 管理系统前端项目

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型系统
- **Vite** - 构建工具
- **React Router** - 路由管理
- **Axios** - HTTP 请求库

## 项目结构

```
echovalley-admin/
├── src/
│   ├── layouts/       # 布局组件
│   ├── pages/         # 页面组件
│   ├── components/    # 公共组件
│   ├── utils/         # 工具函数
│   ├── types/         # TypeScript 类型定义
│   ├── constants/     # 常量配置
│   ├── App.tsx        # 应用入口组件
│   ├── main.tsx       # 应用启动文件
│   └── index.css      # 全局样式
├── index.html         # HTML 模板
├── vite.config.ts     # Vite 配置
├── tsconfig.json      # TypeScript 配置
└── package.json       # 项目依赖

```

## 开发

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

开发服务器会在 `http://localhost:3000` 启动

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

### 类型检查

```bash
npm run type-check
```

## 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```
VITE_API_BASE_URL=http://localhost:8080
VITE_APP_TITLE=EchoValley Admin
```

## License

MIT License
