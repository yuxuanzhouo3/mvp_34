import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(0x0000, 'MornClient', 'Ability onCreate');
  }

  onDestroy(): void {
    hilog.info(0x0000, 'MornClient', 'Ability onDestroy');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    hilog.info(0x0000, 'MornClient', 'Ability onWindowStageCreate');

    // Set full screen
    windowStage.getMainWindow().then((mainWindow: window.Window) => {
      mainWindow.setWindowLayoutFullScreen(true);

      // Set status bar properties
      const systemBarProperties: window.SystemBarProperties = {
        statusBarColor: '#FFFFFF',
        statusBarContentColor: '#000000',
        navigationBarColor: '#FFFFFF',
        navigationBarContentColor: '#000000'
      };
      mainWindow.setWindowSystemBarProperties(systemBarProperties);
    });

    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(0x0000, 'MornClient', 'Failed to load content: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(0x0000, 'MornClient', 'Content loaded successfully');
    });
  }

  onWindowStageDestroy(): void {
    hilog.info(0x0000, 'MornClient', 'Ability onWindowStageDestroy');
  }

  onForeground(): void {
    hilog.info(0x0000, 'MornClient', 'Ability onForeground');
  }

  onBackground(): void {
    hilog.info(0x0000, 'MornClient', 'Ability onBackground');
  }
}
