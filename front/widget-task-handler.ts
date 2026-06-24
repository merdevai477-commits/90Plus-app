import { fetchWidgetMatchesPayload } from './src/widgets/fetchWidgetMatches';
import {
  loadCachedWidgetPayload,
  saveCachedWidgetPayload,
} from './src/widgets/widgetStorage';
import { WIDGET_NAME } from './src/widgets/constants';
import { renderMatchesAndroidWidget } from './widgets/MatchesWidget.android';
import type { WidgetTaskHandler } from 'react-native-android-widget';

export const widgetTaskHandler: WidgetTaskHandler = async ({
  widgetInfo,
  widgetAction,
  renderWidget,
}) => {
  if (widgetInfo.widgetName !== WIDGET_NAME) return;
  if (widgetAction === 'WIDGET_DELETED') return;

  let payload = await loadCachedWidgetPayload();

  if (
    widgetAction === 'WIDGET_ADDED' ||
    widgetAction === 'WIDGET_UPDATE' ||
    widgetAction === 'WIDGET_RESIZED' ||
    !payload
  ) {
    payload = await fetchWidgetMatchesPayload();
    await saveCachedWidgetPayload(payload);
  }

  renderWidget(
    renderMatchesAndroidWidget(payload, widgetInfo.height),
  );
};
