import { AnimatedTrail } from "../animated-trail";
import type { AnimationFrameHandler } from "../animation-frame-handler";
import type App from "../components/App";
import { getLassoSelectedElementIds } from "./utils";

export class LassoTrail extends AnimatedTrail {
  private _app: App;

  constructor(animationFrameHandler: AnimationFrameHandler, app: App) {
    super(animationFrameHandler, app, {
      fill: () => "rgba(105,101,219,0.05)",
      stroke: () => "rgba(105,101,219)",
      streamline: 0.4,
    });
    this._app = app;
  }

  startPath(x: number, y: number): void {
    super.startPath(x, y);
  }

  addPointToPath(x: number, y: number): void {
    super.addPointToPath(x, y);
  }

  endPath(): void {
    super.endPath();
  }
}
