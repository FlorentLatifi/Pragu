package dev.pragu.agent

import android.app.Activity
import android.app.Instrumentation
import android.app.UiAutomation
import android.os.Bundle
import android.util.Log

const val TAG = "PraguAgent"

/**
 * Entry point. The CLI starts it with
 *   adb shell am instrument -w -e socket <name> dev.pragu.agent/.PraguInstrumentation
 * Instrumentation grants UiAutomation, which can read any foreground app's
 * accessibility tree and take a screenshot, with no setup on the device and no
 * code in the app under test (docs/adr/001-android-capture-method.md).
 */
class PraguInstrumentation : Instrumentation() {
    private var socketName = DEFAULT_SOCKET

    override fun onCreate(arguments: Bundle?) {
        super.onCreate(arguments)
        socketName = arguments?.getString("socket") ?: DEFAULT_SOCKET
        start()
    }

    override fun onStart() {
        super.onStart()
        val results = Bundle()
        try {
            // Keep TalkBack and other accessibility services running while Pragu reads the screen.
            val uiAutomation = getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES)
            val handler = RequestHandler(UiAutomationCapturer(uiAutomation, context), agentVersion())
            AgentServer(socketName, handler).serve()
            results.putString("pragu", "stopped")
            finish(Activity.RESULT_OK, results)
        } catch (t: Throwable) {
            Log.e(TAG, "The Pragu agent failed", t)
            results.putString("error", t.toString())
            finish(Activity.RESULT_CANCELED, results)
        }
    }

    @Suppress("DEPRECATION") // The flags overload needs API 33; this one works on every supported version.
    private fun agentVersion(): String =
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "unknown"

    private companion object {
        const val DEFAULT_SOCKET = "pragu"
    }
}
