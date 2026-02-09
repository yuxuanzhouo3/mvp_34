# 腾讯云云托管部署指南

## 构建问题已解决 ✅

**问题：** Windows符号链接权限错误 `EPERM: operation not permitted, symlink`

**解决方案：** 启用Windows开发者模式（设置 → 隐私和安全性 → 开发者选项）

## 快速部署

### 1. 登录腾讯云云托管

访问：https://console.cloud.tencent.com/tcb/service

### 2. 创建服务

- 选择"代码托管"部署方式
- 关联GitHub/GitLab仓库
- Dockerfile路径：`./Dockerfile`
- 端口：`3000`

### 3. 配置环境变量（必需）