# Toast 通知组件使用说明

## 概述

Toast 组件提供了一种友好的方式来显示通知消息，替代了原生的 `alert()` 弹窗。

## 特性

- 🎨 美观的 UI 设计，带动画效果
- 📍 固定在页面右上角
- ⏱️ 自动消失（可配置时长）
- 🎯 支持多种消息类型：成功、错误、警告、信息
- ⌨️ ESC 键快速关闭所有通知
- 📱 响应式设计

## 使用方法

### 1. 引入 hook

在任何组件中，使用 `useToast` hook：

```tsx
import { useToast } from '../components/Toast'

function MyComponent() {
  const toast = useToast()

  // ...
}
```

### 2. 调用方法

```tsx
// 成功消息（绿色，默认 3 秒）
toast.success('操作成功！')

// 错误消息（红色）
toast.error('操作失败，请重试')

// 警告消息（黄色）
toast.warning('请注意检查输入')

// 信息消息（蓝色）
toast.info('正在处理中...')

// 自定义显示时长（毫秒）
toast.success('保存成功', 5000) // 5 秒后消失

// 不自动消失（需要手动关闭）
toast.warning('重要提示', 0)
```

## 消息类型

| 类型 | 方法 | 颜色 | 图标 | 适用场景 |
|------|------|------|------|----------|
| 成功 | `toast.success()` | 绿色 | ✓ | 操作成功、保存完成 |
| 错误 | `toast.error()` | 红色 | ✕ | 操作失败、网络错误 |
| 警告 | `toast.warning()` | 黄色 | ⚠ | 表单验证、注意事项 |
| 信息 | `toast.info()` | 蓝色 | ℹ | 一般提示、状态更新 |

## 最佳实践

### ✅ 推荐用法

```tsx
// 表单验证
if (!form.title) {
  toast.warning('请填写标题')
  return
}

// API 调用成功
try {
  await api.save()
  toast.success('保存成功')
} catch (err) {
  toast.error(err.message || '保存失败')
}

// 重要操作
toast.success('语音生成成功，可点击播放试听。', 5000)
```

### ❌ 避免用法

```tsx
// 不要过度使用
toast.success('第一步完成')
toast.success('第二步完成')
toast.success('第三步完成') // 太多了！

// 不要用错误类型显示警告
toast.error('请填写标题') // 应该用 warning
```

## 替换 alert()

所有原有的 `alert()` 调用都应该替换为 Toast：

| 原来 | 现在 |
|------|------|
| `alert('保存成功')` | `toast.success('保存成功')` |
| `alert('创建失败')` | `toast.error('创建失败')` |
| `alert('请填写完整信息')` | `toast.warning('请填写完整信息')` |

## 技术细节

- 位置：`src/components/Toast.tsx`
- Provider：在 `App.tsx` 中全局注册
- 样式：内联样式 + CSS 动画（`src/index.css`）
- 依赖：React Context API
