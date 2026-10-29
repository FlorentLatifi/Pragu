package dev.pragu.agent

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.UiAutomation
import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Rect
import android.graphics.RectF
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import java.io.ByteArrayOutputStream
import java.time.Instant
import java.util.concurrent.TimeoutException

/** Where AndroidX AccessibilityNodeInfoCompat (used by React Native and Compose) keeps a role description. */
private const val ROLE_DESCRIPTION_KEY = "AccessibilityNodeInfo.roleDescription"
private const val SETTLE_POLL_MS = 400L
private const val IDLE_QUIET_MS = 300L
private const val IDLE_TIMEOUT_MS = 3_000L
// Labels and paragraphs are far shorter; a long article only needs its start checked.
private const val MAX_CHARACTERS_CHECKED = 2_000

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
     * Polls until the app's topmost window is on screen and every window is the same
     * twice in a row, with real content in the app. React Native shows an empty root
     * while the JS bundle loads, so "idle" alone would capture a blank screen.
     */
    override fun capture(packageName: String?, timeoutMs: Long): Capture {
        val deadline = SystemClock.uptimeMillis() + timeoutMs
        var latest: List<WindowSnapshot>? = null
        var previousSignature: Int? = null
        while (true) {
            waitForIdle()
            val target = packageName ?: ui.rootInActiveWindow?.packageName?.toString()
            val windows = if (target == null) emptyList() else snapshotWindows(target)
            val foreground = windows.lastOrNull { it.root != null }
            if (foreground != null) {
                val signature = windows.map { it.signature() }.hashCode()
                latest = windows
                if (signature == previousSignature && foreground.root?.hasContent() == true) break
                previousSignature = signature
            }
            if (SystemClock.uptimeMillis() >= deadline) {
                if (latest != null) Log.w(TAG, "The screen did not settle within $timeoutMs ms; capturing it anyway")
                break
            }
            SystemClock.sleep(SETTLE_POLL_MS)
        }
        val windows = latest ?: throw CaptureException(
            if (packageName == null) {
                "No app window is in the foreground."
            } else {
                "$packageName did not reach the foreground within ${timeoutMs / 1000} s."
            },
        )
        val foreground = windows.last { it.root != null }
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
            packageName = foreground.root?.packageName ?: "unknown",
            windowTitle = foreground.title,
            capturedAt = Instant.now().toString(),
            screenWidthPx = width,
            screenHeightPx = height,
            windows = windows,
            png = png,
        )
    }

    /** Every window, bottom first. Only the target app's own windows get a tree. */
    private fun snapshotWindows(target: String): List<WindowSnapshot> =
        ui.windows.sortedBy { it.layer }.map { window ->
            val bounds = Rect()
            window.getBoundsInScreen(bounds)
            val root = if (window.type == AccessibilityWindowInfo.TYPE_APPLICATION) {
                window.root?.takeIf { it.packageName?.toString() == target }
            } else {
                null
            }
            WindowSnapshot(
                type = windowTypeName(window.type),
                layer = window.layer,
                title = window.title?.toString(),
                left = bounds.left,
                top = bounds.top,
                right = bounds.right,
                bottom = bounds.bottom,
                active = window.isActive,
                focused = window.isFocused,
                root = root?.let { snapshotOf(it) },
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
            labeledBy = labelText(node),
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
            textCollapsedChars = collapsedCharacters(node),
            children = children,
        )
    }

    // isChecked is deprecated on API 36 in favour of a tri-state getChecked(); the boolean is all protocol 1 needs.
    @Suppress("DEPRECATION")
    private fun isChecked(node: AccessibilityNodeInfo): Boolean = node.isChecked

    /** A field named by another element (labelFor, aria-labelledby) gets that element's words. */
    private fun labelText(node: AccessibilityNodeInfo): String? {
        val label = node.labeledBy ?: return null
        return (label.text ?: label.contentDescription)?.toString()
    }

    /**
     * Counts visible characters that Android lays out with no width or no position: an
     * ellipsis leaves the characters it hides that way. Null when the app does not report
     * character positions. Characters a container cuts off keep positions clipped to the
     * visible area, so they cannot be told apart this way.
     */
    private fun collapsedCharacters(node: AccessibilityNodeInfo): Int? {
        val text = node.text
        val key = AccessibilityNodeInfo.EXTRA_DATA_TEXT_CHARACTER_LOCATION_KEY
        if (text.isNullOrEmpty() || key !in node.availableExtraData) return null
        val length = minOf(text.length, MAX_CHARACTERS_CHECKED)
        val args = Bundle().apply {
            putInt(AccessibilityNodeInfo.EXTRA_DATA_TEXT_CHARACTER_LOCATION_ARG_START_INDEX, 0)
            putInt(AccessibilityNodeInfo.EXTRA_DATA_TEXT_CHARACTER_LOCATION_ARG_LENGTH, length)
        }
        if (!node.refreshWithExtraData(key, args)) return null
        val boxes = characterBoxes(node, key) ?: return null
        return (0 until length).count { index ->
            val visible = !text[index].isWhitespace()
            visible && hasNoArea(boxes.getOrNull(index) as? RectF)
        }
    }

    private fun hasNoArea(box: RectF?): Boolean = box == null || box.width() < 0.5f || box.height() < 0.5f

    // The typed getParcelableArray arrived in API 33; the untyped one still works below it.
    @Suppress("DEPRECATION")
    private fun characterBoxes(node: AccessibilityNodeInfo, key: String): Array<out android.os.Parcelable?>? =
        node.extras.getParcelableArray(key)

    /** Rendered text size (API 30+), which decides between WCAG's normal and large text thresholds. */
    private fun textSizePx(node: AccessibilityNodeInfo): Float? {
        if (Build.VERSION.SDK_INT < 30 || node.text.isNullOrEmpty()) return null
        if (AccessibilityNodeInfo.EXTRA_DATA_RENDERING_INFO_KEY !in node.availableExtraData) return null
        if (!node.refreshWithExtraData(AccessibilityNodeInfo.EXTRA_DATA_RENDERING_INFO_KEY, Bundle())) return null
        return node.extraRenderingInfo?.textSizeInPx?.takeIf { it > 0f }
    }
}
