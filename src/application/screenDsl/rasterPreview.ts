import type { ScreenInterchangeProjectV1 } from '../../screen-interchange';
import type { ScreenDslRasterPreview } from './contracts';

export function createScreenDslRasterPreview(
  before: ScreenInterchangeProjectV1,
  after: ScreenInterchangeProjectV1
): ScreenDslRasterPreview {
  const beforeScreens = new Map(before.screens.map((screen) => [screen.id, screen]));
  const changedScreens: string[] = [];
  for (const screen of after.screens) {
    const previous = beforeScreens.get(screen.id);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(screen)) {
      changedScreens.push(screen.id);
    }
  }
  return {
    beforeByteLength: byteLength(before),
    afterByteLength: byteLength(after),
    changedScreens
  };
}

function byteLength(packageV1: ScreenInterchangeProjectV1): number {
  return packageV1.screens.reduce((total, screen) => total + Math.ceil(screen.display.height / 8) * screen.display.width, 0);
}
