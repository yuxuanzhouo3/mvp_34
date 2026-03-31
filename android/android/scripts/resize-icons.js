/**
 * Android 图标批量生成脚本
 * 使用 sharp 库从一张高清图生成所有需要的尺寸
 *
 * 安装依赖: npm install sharp
 * 使用方法: node resize-icons.js <输入图片路径>
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Android 资源目录（相对于脚本位置）
const RES_DIR = path.join(__dirname, '../app/src/main/res');

// 应用图标配置
const LAUNCHER_ICONS = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
];

// 启动页图标配置
const SPLASH_ICONS = [
    { dir: 'drawable-mdpi', size: 180 },
    { dir: 'drawable-hdpi', size: 270 },
    { dir: 'drawable-xhdpi', size: 360 },
    { dir: 'drawable-xxhdpi', size: 540 },
    { dir: 'drawable-xxxhdpi', size: 720 },
];

// 夜间模式启动页图标配置
const SPLASH_NIGHT_ICONS = [
    { dir: 'drawable-night-mdpi', size: 180 },
    { dir: 'drawable-night-hdpi', size: 270 },
    { dir: 'drawable-night-xhdpi', size: 360 },
    { dir: 'drawable-night-xxhdpi', size: 540 },
    { dir: 'drawable-night-xxxhdpi', size: 720 },
];

/**
 * 生成指定尺寸的图标
 */
async function generateIcon(inputPath, outputPath, size) {
    await sharp(inputPath)
        .resize(size, size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
    console.log(`✓ 生成: ${outputPath} (${size}x${size})`);
}

/**
 * 批量生成所有图标
 */
async function generateAllIcons(inputPath, options = {}) {
    const {
        generateLauncher = true,
        generateSplash = true,
        generateNightSplash = true
    } = options;

    if (!fs.existsSync(inputPath)) {
        throw new Error(`输入文件不存在: ${inputPath}`);
    }

    console.log(`\n📱 开始生成 Android 图标...`);
    console.log(`输入图片: ${inputPath}\n`);

    // 生成应用图标
    if (generateLauncher) {
        console.log('--- 应用图标 (ic_launcher.png) ---');
        for (const config of LAUNCHER_ICONS) {
            const outputPath = path.join(RES_DIR, config.dir, 'ic_launcher.png');
            await generateIcon(inputPath, outputPath, config.size);
        }
    }

    // 生成启动页图标
    if (generateSplash) {
        console.log('\n--- 启动页图标 (splash.png) ---');
        for (const config of SPLASH_ICONS) {
            const outputPath = path.join(RES_DIR, config.dir, 'splash.png');
            await generateIcon(inputPath, outputPath, config.size);
        }
    }

    // 生成夜间模式启动页图标
    if (generateNightSplash) {
        console.log('\n--- 夜间模式启动页图标 (splash.png) ---');
        for (const config of SPLASH_NIGHT_ICONS) {
            const outputPath = path.join(RES_DIR, config.dir, 'splash.png');
            await generateIcon(inputPath, outputPath, config.size);
        }
    }

    console.log('\n✅ 所有图标生成完成！');
}

// 导出供 Next.js 使用
module.exports = { generateAllIcons, generateIcon, LAUNCHER_ICONS, SPLASH_ICONS, SPLASH_NIGHT_ICONS };

// 命令行使用
if (require.main === module) {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.log('使用方法: node resize-icons.js <输入图片路径>');
        console.log('示例: node resize-icons.js ./my-icon.png');
        process.exit(1);
    }

    generateAllIcons(inputPath).catch(err => {
        console.error('错误:', err.message);
        process.exit(1);
    });
}
