package expo.modules.widgetbridge

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WidgetBridgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WidgetBridge")

    Function("setConfig") { json: String ->
      appContext.reactContext?.let { context ->
        val previous = WidgetStore.config(context)?.teamIds
        WidgetStore.saveConfig(context, json)
        // The cached feed belongs to the old team list; drop it so the widget never shows unfollowed teams.
        if (previous != WidgetStore.config(context)?.teamIds) WidgetStore.clearFeed(context)
      }
      Unit
    }

    Function("reload") {
      appContext.reactContext?.let { context ->
        val stored = WidgetStore.config(context)
        val hasScope = !stored?.teamIds.isNullOrEmpty() || !stored?.favoriteIds.isNullOrEmpty()
        if (hasScope || WidgetRenderer.widgetIds(context).isNotEmpty()) {
          WidgetScheduler.ensurePeriodic(context)
          WidgetScheduler.refreshNow(context)
        } else {
          WidgetScheduler.cancelAll(context)
          LiveNotifier.update(context, null, null)
        }
      }
      Unit
    }
  }
}
