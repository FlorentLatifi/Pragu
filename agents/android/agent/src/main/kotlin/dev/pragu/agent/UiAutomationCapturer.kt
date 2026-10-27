package dev.pragu.agent

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.UiAutomation
import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.util.concurrent.TimeoutException

/** Where AndroidX AccessibilityNodeInfoCompat (used by React Native and Compose) keeps a role description. */
private const val ROLE_DESCRIPTION_KEY = "AccessibilityNodeInfo.roleDescription"
private const val SETTLE_POLL_MS = 400L
private const val IDLE_QUIET_MS = 300L
private const val IDLE_TIMEOUT_MS = 3_000L

/** Reads the foreground app's accessibility tree and a screenshot through UiAutomation. */
class UiAutomationCapturer(private val ui: UiAutomation, private val context: Context) : ScreenCapturer {
    init {
        val info = ui.serviceInfo
        // Not-important views too, so rules can see interactive elements hidden from TalkBack.
        info.flags = info.flags or
            AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS or
            AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
            AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
        ui.serviceInfo = info
    }

    override fun deviceInfo(): DeviceInfo {
        val configuration = context.resources.configuration
        return DeviceInfo(
            manufacturer = Build.MANUFACTURER,
            model = Build.MODEL,
            sdkInt = Build.VERSION.SDK_INT,
            release = Build.VERSION.RELEASE,
            densityDpi = context.resources.displayMetrics.densityDpi,
            fontScale = configuration.fontScale,
            locale = configuration.locales[0].toLanguageTag(),
            nightMode = (configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES,
        )
    }

    /**
     * Polls until the app is in the foreground and its tree is the same twice in a
     * row with real content in it. React Native shows an empty root while the JS
     * bundle loads, so "idle" alone would capture a blank screen.
     */
    override fun capture(packageName: String?, timeoutMs: Long): Capture {
        val deadline = SystemClock.uptimeMillis() + timeoutMs
        var latest: Pair<AccessibilityNodeInfo, NodeSnapshot>? = null
        var previousSignature: Int? = null
        while (true) {
            waitForIdle()
            val root = ui.rootInActiveWindow
            if (root != null && (packageName == null || root.packageName?.toString() == packageName)) {
                val snapshot = snapshotOf(root)
                val signature = snapshot.signature()
                latest = root to snapshot
                if (signature == previousSignature && snapshot.hasContent()) break
                previousSignature = signature
            }
            if (SystemClock.uptimeMillis() >= deadline) {
                if (latest != null) Log.w(TAG, "The screen did not settle within $timeoutMs ms; capturing it anyway")
                break
            }
            SystemClock.sleep(SETTLE_POLL_MS)
        }
        val (root, snapshot) = latest ?: throw CaptureException(
            if (packageName == null) {
                "No app window is in the foreground."
            } else {
                "$packageName did not reach the foreground within ${timeoutMs / 1000} s."
            },
        )
        val bitmap = ui.takeScreenshot()
            ?: throw CaptureException("Android refused the screenshot. A secure window (FLAG_SECURE) may be showing.")
        val width = bitmap.width
        val height = bitmap.height
        val png = ByteArrayOutputStream().use { out ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            out.toByteArray()
        }
        bitmap.recycle()
        return Capture(
            packageName = root.packageName?.toString() ?: "unknown",
            windowTitle = ui.windows.firstOrNull { it.isActive }?.title?.toString(),
            capturedAt = Instant.now().toString(),
            screenWidthPx = width,
            screenHeightPx = height,
            root = snapshot,
            png = png,
        )
    }

    private fun waitForIdle() {
        try {
            ui.waitForIdle(IDLE_QUIET_MS, IDLE_TIMEOUT_MS)
        } catch (_: TimeoutException) {
            // Animations keep some screens busy for good; capture anyway.
        }
    }

    private fun snapshotOf(node: AccessibilityNodeInfo): NodeSnapshot {
        val bounds = Rect()
        node.getBoundsInScreen(bounds)
        val children = (0 until node.childCount).mapNotNull { node.getChild(it) }.map { snapshotOf(it) }
        return NodeSnapshot(
            className = node.className?.toString(),
            packageName = node.packageName?.toString(),
            resourceId = node.viewIdResourceName,
            text = node.text?.toString(),
            contentDescription = node.contentDescription?.toString(),
            hintText = node.hintText?.toString(),
            stateDescription = if (Build.VERSION.SDK_INT >= 30) node.stateDescription?.toString() else null,
            roleDescription = node.extras?.getCharSequence(ROLE_DESCRIPTION_KEY)?.toString(),
            left = bounds.left,
            top = bounds.top,
            right = bounds.right,
            bottom = bounds.bottom,
            clickable = node.isClickable,
            longClickable = node.isLongClickable,
            focusable = node.isFocusable,
            checkable = node.isCheckable,
            checked = isChecked(node),
            enabled = node.isEnabled,
            editable = node.isEditable,
            visibleToUser = node.isVisibleToUser,
            importantForAccessibility = node.isImportantForAccessibility,
            heading = Build.VERSION.SDK_INT >= 28 && node.isHeading,
            screenReaderFocusable = Build.VERSION.SDK_INT >= 28 && node.isScreenReaderFocusable,
            actions = node.actionList.map { it.id },
            textSizePx = textSizePx(node),
            children = children,
        )
    }

    // isChecked is deprecated on API 36 in favour of a tri-state getChecked(); the boolean is all protocol 1 needs.
    @Suppress("DEPRECATION")
    private fun isChecked(node: AccessibilityNodeInfo): Boolean = node.isChecked

    /** Rendered text size (API 30+), which decides between WCAG's normal and large text thresholds. */
    private fun textSizePx(node: AccessibilityNodeInfo): Float? {
        if (Build.VERSION.SDK_INT < 30 || node.text.isNullOrEmpty()) return null
        if (AccessibilityNodeInfo.EXTRA_DATA_RENDERING_INFO_KEY !in node.availableExtraData) return null
        if (!node.refreshWithExtraData(AccessibilityNodeInfo.EXTRA_DATA_RENDERING_INFO_KEY, Bundle())) return null
        return node.extraRenderingInfo?.textSizeInPx?.takeIf { it > 0f }
    }
}
