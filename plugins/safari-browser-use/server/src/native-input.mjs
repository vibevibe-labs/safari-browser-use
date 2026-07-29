function finiteNumber(value, error) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(error);
  }

  return number;
}

export function viewportPointToScreen(
  point,
  viewport,
  windowBounds
) {
  const x = finiteNumber(point.x, "invalid_coordinates");
  const y = finiteNumber(point.y, "invalid_coordinates");
  const innerWidth = finiteNumber(
    viewport.innerWidth,
    "native_click_invalid_viewport"
  );
  const innerHeight = finiteNumber(
    viewport.innerHeight,
    "native_click_invalid_viewport"
  );
  const outerWidth = finiteNumber(
    viewport.outerWidth,
    "native_click_invalid_viewport"
  );
  const outerHeight = finiteNumber(
    viewport.outerHeight,
    "native_click_invalid_viewport"
  );
  const visualScale = finiteNumber(
    viewport.visualScale,
    "native_click_invalid_viewport"
  );
  const visualOffsetLeft = finiteNumber(
    viewport.visualOffsetLeft,
    "native_click_invalid_viewport"
  );
  const visualOffsetTop = finiteNumber(
    viewport.visualOffsetTop,
    "native_click_invalid_viewport"
  );

  if (
    visualScale !== 1 ||
    visualOffsetLeft !== 0 ||
    visualOffsetTop !== 0
  ) {
    throw new Error(
      "native_click_unsupported_viewport_transform"
    );
  }

  if (
    innerWidth <= 0 ||
    innerHeight <= 0 ||
    outerWidth < innerWidth ||
    outerHeight < innerHeight
  ) {
    throw new Error("native_click_invalid_viewport");
  }

  if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) {
    throw new Error("native_click_outside_viewport");
  }

  const boundsWidth = finiteNumber(
    windowBounds.width,
    "native_click_window_not_visible"
  );
  const boundsHeight = finiteNumber(
    windowBounds.height,
    "native_click_window_not_visible"
  );
  const boundsX = finiteNumber(
    windowBounds.x,
    "native_click_window_not_visible"
  );
  const boundsY = finiteNumber(
    windowBounds.y,
    "native_click_window_not_visible"
  );
  const scaleX = boundsWidth / outerWidth;
  const scaleY = boundsHeight / outerHeight;

  if (
    boundsWidth <= 0 ||
    boundsHeight <= 0 ||
    Math.abs(scaleX - scaleY) > 0.02
  ) {
    throw new Error("native_click_window_scale_mismatch");
  }

  return {
    x: Math.round(
      boundsX + (outerWidth - innerWidth + x) * scaleX
    ),
    y: Math.round(
      boundsY + (outerHeight - innerHeight + y) * scaleY
    )
  };
}

export function createNativeInput({
  focus,
  readViewport,
  readWindowBounds,
  postClick
}) {
  return {
    clickAt(tabId, x, y) {
      const viewportPoint = {
        x: finiteNumber(x, "invalid_coordinates"),
        y: finiteNumber(y, "invalid_coordinates")
      };

      focus(tabId);

      const screenPoint = viewportPointToScreen(
        viewportPoint,
        readViewport(tabId),
        readWindowBounds(tabId)
      );

      postClick(screenPoint);

      return {
        clicked: true,
        screen: screenPoint,
        viewport: viewportPoint
      };
    }
  };
}
