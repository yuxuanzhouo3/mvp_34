/**
 * Next.js API 路由示例
 * 文件位置: pages/api/generate-icons.js 或 app/api/generate-icons/route.js
 *
 * 安装依赖: npm install sharp formidable
 */

// ============ 方式1: Pages Router (pages/api/generate-icons.js) ============

import sharp from 'sharp';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
    api: {
        bodyParser: false, // 禁用默认的 body 解析，使用 formidable
    },
};

// Android 资源配置
const ICON_CONFIGS = {
    launcher: [
        { dir: 'mipmap-mdpi', file: 'ic_launcher.png', size: 48 },
        { dir: 'mipmap-hdpi', file: 'ic_launcher.png', size: 72 },
        { dir: 'mipmap-xhdpi', file: 'ic_launcher.png', size: 96 },
        { dir: 'mipmap-xxhdpi', file: 'ic_launcher.png', size: 144 },
        { dir: 'mipmap-xxxhdpi', file: 'ic_launcher.png', size: 192 },
    ],
    splash: [
        { dir: 'drawable-mdpi', file: 'splash.png', size: 180 },
        { dir: 'drawable-hdpi', file: 'splash.png', size: 270 },
        { dir: 'drawable-xhdpi', file: 'splash.png', size: 360 },
        { dir: 'drawable-xxhdpi', file: 'splash.png', size: 540 },
        { dir: 'drawable-xxxhdpi', file: 'splash.png', size: 720 },
    ],
    splashNight: [
        { dir: 'drawable-night-mdpi', file: 'splash.png', size: 180 },
        { dir: 'drawable-night-hdpi', file: 'splash.png', size: 270 },
        { dir: 'drawable-night-xhdpi', file: 'splash.png', size: 360 },
        { dir: 'drawable-night-xxhdpi', file: 'splash.png', size: 540 },
        { dir: 'drawable-night-xxxhdpi', file: 'splash.png', size: 720 },
    ],
};

// Android 项目资源目录（根据你的实际路径修改）
const ANDROID_RES_DIR = 'D:/Software/Code/Work/switch/android/app/src/main/res';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 解析上传的文件
        const form = formidable({ multiples: false });
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });

        const uploadedFile = files.icon?.[0] || files.icon;
        if (!uploadedFile) {
            return res.status(400).json({ error: '请上传图标文件' });
        }

        const inputBuffer = fs.readFileSync(uploadedFile.filepath);
        const results = [];

        // 生成所有尺寸的图标
        const allConfigs = [
            ...ICON_CONFIGS.launcher,
            ...ICON_CONFIGS.splash,
            ...ICON_CONFIGS.splashNight,
        ];

        for (const config of allConfigs) {
            const outputPath = path.join(ANDROID_RES_DIR, config.dir, config.file);

            // 确保目录存在
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // 生成缩放后的图标
            await sharp(inputBuffer)
                .resize(config.size, config.size, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 },
                })
                .png()
                .toFile(outputPath);

            results.push({
                path: `${config.dir}/${config.file}`,
                size: `${config.size}x${config.size}`,
            });
        }

        // 清理临时文件
        fs.unlinkSync(uploadedFile.filepath);

        return res.status(200).json({
            success: true,
            message: '图标生成完成',
            generated: results,
        });
    } catch (error) {
        console.error('生成图标失败:', error);
        return res.status(500).json({ error: error.message });
    }
}


// ============ 方式2: App Router (app/api/generate-icons/route.js) ============
/*
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ANDROID_RES_DIR = 'D:/Software/Code/Work/switch/android/app/src/main/res';

const ICON_CONFIGS = {
    launcher: [
        { dir: 'mipmap-mdpi', file: 'ic_launcher.png', size: 48 },
        { dir: 'mipmap-hdpi', file: 'ic_launcher.png', size: 72 },
        { dir: 'mipmap-xhdpi', file: 'ic_launcher.png', size: 96 },
        { dir: 'mipmap-xxhdpi', file: 'ic_launcher.png', size: 144 },
        { dir: 'mipmap-xxxhdpi', file: 'ic_launcher.png', size: 192 },
    ],
    splash: [
        { dir: 'drawable-mdpi', file: 'splash.png', size: 180 },
        { dir: 'drawable-hdpi', file: 'splash.png', size: 270 },
        { dir: 'drawable-xhdpi', file: 'splash.png', size: 360 },
        { dir: 'drawable-xxhdpi', file: 'splash.png', size: 540 },
        { dir: 'drawable-xxxhdpi', file: 'splash.png', size: 720 },
    ],
    splashNight: [
        { dir: 'drawable-night-mdpi', file: 'splash.png', size: 180 },
        { dir: 'drawable-night-hdpi', file: 'splash.png', size: 270 },
        { dir: 'drawable-night-xhdpi', file: 'splash.png', size: 360 },
        { dir: 'drawable-night-xxhdpi', file: 'splash.png', size: 540 },
        { dir: 'drawable-night-xxxhdpi', file: 'splash.png', size: 720 },
    ],
};

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('icon') as File;

        if (!file) {
            return NextResponse.json({ error: '请上传图标文件' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const results = [];

        const allConfigs = [
            ...ICON_CONFIGS.launcher,
            ...ICON_CONFIGS.splash,
            ...ICON_CONFIGS.splashNight,
        ];

        for (const config of allConfigs) {
            const outputPath = path.join(ANDROID_RES_DIR, config.dir, config.file);
            const outputDir = path.dirname(outputPath);

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            await sharp(buffer)
                .resize(config.size, config.size, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 },
                })
                .png()
                .toFile(outputPath);

            results.push({
                path: `${config.dir}/${config.file}`,
                size: `${config.size}x${config.size}`,
            });
        }

        return NextResponse.json({
            success: true,
            message: '图标生成完成',
            generated: results,
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
*/
